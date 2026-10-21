import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { isOwner, loadAccess, requireAuth, rolesIn } from "../auth";
import { db, schema } from "../db";
import { AppError, validate } from "../errors";
import { CAN_CREATE } from "../orders/rules";
import type { AppEnv, Role } from "../types";

const READ_ROLES: readonly Role[] = ["operativo", "gerente"];

const inventoryQuery = z.object({
  businessUnitId: z.coerce.number().int().positive().optional(),
});

const adjustParams = z.object({
  siteId: z.coerce.number().int().positive(),
  productId: z.coerce.number().int().positive(),
});

const adjustBody = z.object({ quantity: z.number().min(0).max(999_999_999) });

const availabilityQuery = z.object({
  businessUnitId: z.coerce.number().int().positive(),
});

export const inventoryRoutes = new Hono<AppEnv>()
  .use("*", requireAuth, loadAccess)

  // Productos de un giro con la existencia total disponible, sin detalle por sede. Lo consulta quien puede
  // crear pedidos (por ejemplo, Proceso al elegir qué pedir a Extracción) sin acceder al inventario del proveedor.
  .get("/availability", validate("query", availabilityQuery), async (c) => {
    const access = c.get("access");
    const allowed = isOwner(access) || access.memberships.some((m) => CAN_CREATE.includes(m.role));
    if (!allowed) throw new AppError(403, "FORBIDDEN", "No tiene permiso para consultar la disponibilidad");

    const { businessUnitId } = c.req.valid("query");
    const rows = await db
      .select({
        productId: schema.products.id,
        productName: schema.products.name,
        unit: schema.products.unit,
        available: sql<number>`coalesce(sum(${schema.inventoryItems.quantity}), 0)`.mapWith(Number),
      })
      .from(schema.products)
      .leftJoin(schema.inventoryItems, eq(schema.inventoryItems.productId, schema.products.id))
      .where(eq(schema.products.businessUnitId, businessUnitId))
      .groupBy(schema.products.id)
      .orderBy(asc(schema.products.name));
    return c.json({ items: rows });
  })

  .get("/", validate("query", inventoryQuery), async (c) => {
    const access = c.get("access");
    const { businessUnitId } = c.req.valid("query");

    // El dueño ve todo; operativos y gerentes, solo los giros donde tienen ese rol.
    const owner = isOwner(access);
    const units = [
      ...new Set(
        access.memberships.flatMap((m) => (m.businessUnitId !== null && READ_ROLES.includes(m.role) ? [m.businessUnitId] : [])),
      ),
    ];
    if (!owner && units.length === 0) {
      throw new AppError(403, "FORBIDDEN", "No tiene permiso para consultar el inventario");
    }

    const rows = await db
      .select({
        siteId: schema.sites.id,
        siteName: schema.sites.name,
        businessUnitId: schema.sites.businessUnitId,
        businessUnitName: schema.businessUnits.name,
        productId: schema.products.id,
        productName: schema.products.name,
        unit: schema.products.unit,
        quantity: schema.inventoryItems.quantity,
        minThreshold: schema.inventoryItems.minThreshold,
      })
      .from(schema.inventoryItems)
      .innerJoin(schema.sites, eq(schema.sites.id, schema.inventoryItems.siteId))
      .innerJoin(schema.products, eq(schema.products.id, schema.inventoryItems.productId))
      .innerJoin(schema.businessUnits, eq(schema.businessUnits.id, schema.sites.businessUnitId))
      .where(
        and(
          owner ? undefined : inArray(schema.sites.businessUnitId, units),
          businessUnitId ? eq(schema.sites.businessUnitId, businessUnitId) : undefined,
        ),
      )
      .orderBy(asc(schema.sites.businessUnitId), asc(schema.sites.name), asc(schema.products.name));

    return c.json({ items: rows.map((r) => ({ ...r, belowMinimum: r.quantity < r.minThreshold })) });
  })

  // Ajuste manual de existencias (conteo físico, recepción de material). Solo operativos y gerentes del giro dueño de la sede.
  .patch("/:siteId/:productId", validate("param", adjustParams), validate("json", adjustBody), async (c) => {
    const access = c.get("access");
    const { siteId, productId } = c.req.valid("param");
    const { quantity } = c.req.valid("json");

    const [row] = await db
      .select({ businessUnitId: schema.sites.businessUnitId })
      .from(schema.inventoryItems)
      .innerJoin(schema.sites, eq(schema.sites.id, schema.inventoryItems.siteId))
      .where(and(eq(schema.inventoryItems.siteId, siteId), eq(schema.inventoryItems.productId, productId)));
    if (!row) throw new AppError(404, "INVENTORY_NOT_FOUND", "No hay existencias registradas para esa sede y producto");
    if (!rolesIn(access, row.businessUnitId).some((r) => READ_ROLES.includes(r))) {
      throw new AppError(403, "FORBIDDEN", "Su rol no permite ajustar el inventario de este giro");
    }

    const [updated] = await db
      .update(schema.inventoryItems)
      .set({ quantity })
      .where(and(eq(schema.inventoryItems.siteId, siteId), eq(schema.inventoryItems.productId, productId)))
      .returning({ siteId: schema.inventoryItems.siteId, productId: schema.inventoryItems.productId, quantity: schema.inventoryItems.quantity, minThreshold: schema.inventoryItems.minThreshold });
    return c.json({ ...updated, belowMinimum: updated.quantity < updated.minThreshold });
  });
