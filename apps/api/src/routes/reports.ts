import { and, asc, count, eq, inArray, lt, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { alias } from "drizzle-orm/pg-core";
import { Hono } from "hono";
import { z } from "zod";
import { isOwner, loadAccess, requireAuth, rolesIn } from "../auth";
import { todayGT } from "../dates";
import { db, schema } from "../db";
import { AppError, validate } from "../errors";
import { ATTENTION_STATUSES, OPEN_STATUSES, ORDER_STATUSES, type OrderStatus } from "../orders/rules";
import type { AppEnv, Role } from "../types";

const { orders, orderItems, products, sites, inventoryItems, businessUnits, meetings } = schema;
const requester = alias(businessUnits, "requester");

const idParam = z.object({ id: z.coerce.number().int().positive() });

/** Roles que consultan el panel de un giro (además del dueño). */
const PANEL_ROLES: readonly Role[] = ["gerente", "operativo"];

const sum = (byStatus: Record<OrderStatus, number>, statuses: readonly OrderStatus[]) =>
  statuses.reduce((total, s) => total + byStatus[s], 0);

// Pedidos del giro en un lado (proveedor o solicitante): total por estado y cuántos están retrasados.
async function sideSummary(column: PgColumn, unitId: number, today: string) {
  const rows = await db
    .select({
      status: orders.status,
      total: count(),
      overdue: sql<number>`count(*) filter (where ${orders.dueDate} < ${today} and ${inArray(orders.status, [...ATTENTION_STATUSES])})`.mapWith(Number),
    })
    .from(orders)
    .where(eq(column, unitId))
    .groupBy(orders.status);

  const byStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
  for (const r of rows) byStatus[r.status] = r.total;
  return { byStatus, open: sum(byStatus, OPEN_STATUSES), overdue: rows.reduce((t, r) => t + r.overdue, 0) };
}

export const reportRoutes = new Hono<AppEnv>()
  .use("*", requireAuth, loadAccess)

  // Indicadores de un giro para su panel (P02).
  .get("/business-units/:id", validate("param", idParam), async (c) => {
    const access = c.get("access");
    const { id } = c.req.valid("param");
    const owner = isOwner(access);
    const roles = rolesIn(access, id);
    if (!owner && !roles.some((r) => PANEL_ROLES.includes(r))) {
      throw new AppError(403, "FORBIDDEN", "Su rol no permite consultar el panel de este giro");
    }

    const [unit] = await db
      .select({ id: businessUnits.id, name: businessUnits.name, type: businessUnits.type })
      .from(businessUnits)
      .where(eq(businessUnits.id, id));
    if (!unit) throw new AppError(404, "UNIT_NOT_FOUND", "Giro no encontrado");

    const today = todayGT();
    const [asSupplier, asRequester] = await Promise.all([
      sideSummary(orders.supplierUnitId, id, today),
      sideSummary(orders.requestingUnitId, id, today),
    ]);

    // Pedidos que el giro debe atender, los de fecha más próxima (o ya vencida) primero.
    const pending = await db
      .select({
        id: orders.id,
        status: orders.status,
        requestingUnitName: requester.name,
        dueDate: orders.dueDate,
      })
      .from(orders)
      .leftJoin(requester, eq(requester.id, orders.requestingUnitId))
      .where(and(eq(orders.supplierUnitId, id), inArray(orders.status, [...ATTENTION_STATUSES])))
      .orderBy(asc(orders.dueDate), asc(orders.id))
      .limit(5);
    const lines = pending.length
      ? await db
          .select({ orderId: orderItems.orderId, productName: products.name, unit: products.unit, quantity: orderItems.quantity })
          .from(orderItems)
          .innerJoin(products, eq(products.id, orderItems.productId))
          .where(inArray(orderItems.orderId, pending.map((o) => o.id)))
          .orderBy(asc(orderItems.id))
      : [];
    const toAttend = pending.map((o) => ({
      ...o,
      overdue: o.dueDate < today,
      items: lines.filter((l) => l.orderId === o.id).map(({ orderId: _orderId, ...item }) => item),
    }));

    // Existencias por debajo del mínimo en las sedes del giro.
    const lowRows = await db
      .select({
        siteName: sites.name,
        productName: products.name,
        unit: products.unit,
        quantity: inventoryItems.quantity,
        minThreshold: inventoryItems.minThreshold,
      })
      .from(inventoryItems)
      .innerJoin(sites, eq(sites.id, inventoryItems.siteId))
      .innerJoin(products, eq(products.id, inventoryItems.productId))
      .where(and(eq(sites.businessUnitId, id), lt(inventoryItems.quantity, inventoryItems.minThreshold)))
      .orderBy(asc(sites.name), asc(products.name));

    // Solicitudes de reunión del giro: solo cantidades, para quien gerencia el giro y el dueño.
    let meetingCounts: { requested: number; confirmed: number } | null = null;
    if (owner || roles.includes("gerente")) {
      const rows = await db
        .select({ status: meetings.status, total: count() })
        .from(meetings)
        .where(and(eq(meetings.businessUnitId, id), inArray(meetings.status, ["solicitada", "confirmada"])))
        .groupBy(meetings.status);
      meetingCounts = {
        requested: rows.find((r) => r.status === "solicitada")?.total ?? 0,
        confirmed: rows.find((r) => r.status === "confirmada")?.total ?? 0,
      };
    }

    return c.json({
      businessUnit: unit,
      asSupplier: { ...asSupplier, toAttend: sum(asSupplier.byStatus, ATTENTION_STATUSES) },
      asRequester,
      toAttend,
      lowStock: { count: lowRows.length, items: lowRows.slice(0, 10) },
      meetings: meetingCounts,
    });
  });
