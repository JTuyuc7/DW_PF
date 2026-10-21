import { type SQL, and, asc, count, desc, eq, gte, inArray, lt, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Hono } from "hono";
import { z } from "zod";
import { isOwner, loadAccess, memberUnitIds, requireAuth, rolesIn } from "../auth";
import { dateString, todayGT } from "../dates";
import { db, schema } from "../db";
import { AppError, validate } from "../errors";
import { CAN_CREATE, ORDER_STATUSES, type OrderRoles, allowedTransitions, checkTransition } from "../orders/rules";
import type { Access, AppEnv } from "../types";

const { orders, orderItems, orderMessages, orderStatusEvents, products, users, businessUnits } = schema;

const supplier = alias(businessUnits, "supplier");
const requester = alias(businessUnits, "requester");

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------- Validación ----------

const idParam = z.object({ id: z.coerce.number().int().positive() });

const createSchema = z.object({
  kind: z.literal("interno"),
  supplierUnitId: z.number().int().positive(),
  requestingUnitId: z.number().int().positive(),
  dueDate: dateString,
  status: z.enum(["borrador", "solicitado"]).default("solicitado"),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().positive().max(999_999_999),
      }),
    )
    .min(1)
    .max(50)
    .refine((items) => new Set(items.map((i) => i.productId)).size === items.length, "Producto repetido"),
});

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(ORDER_STATUSES).optional(),
  businessUnitId: z.coerce.number().int().positive().optional(),
  relation: z.enum(["supplier", "requester"]).optional(),
  from: dateString.optional(),
  to: dateString.optional(),
});

const statusSchema = z.object({ status: z.enum(ORDER_STATUSES) });
const messageSchema = z.object({ body: z.string().trim().min(1).max(2000) });

// ---------- Acceso a datos ----------

const headerColumns = {
  id: orders.id,
  kind: orders.kind,
  status: orders.status,
  supplierUnitId: orders.supplierUnitId,
  supplierUnitName: supplier.name,
  requestingUnitId: orders.requestingUnitId,
  requestingUnitName: requester.name,
  dueDate: orders.dueDate,
  createdAt: orders.createdAt,
};

const headerQuery = (ex: Executor) =>
  ex
    .select(headerColumns)
    .from(orders)
    .innerJoin(supplier, eq(supplier.id, orders.supplierUnitId))
    .leftJoin(requester, eq(requester.id, orders.requestingUnitId));

type Header = Awaited<ReturnType<typeof headerQuery>>[number];

/** Un pedido es visible para el dueño y para quien tiene membresía en el giro que provee o en el que solicita. */
function canSee(a: Access, h: Pick<Header, "supplierUnitId" | "requestingUnitId">) {
  return isOwner(a) || memberUnitIds(a).some((u) => u === h.supplierUnitId || u === h.requestingUnitId);
}

function orderRoles(a: Access, h: Pick<Header, "supplierUnitId" | "requestingUnitId">): OrderRoles {
  return {
    supplier: rolesIn(a, h.supplierUnitId),
    requester: h.requestingUnitId === null ? [] : rolesIn(a, h.requestingUnitId),
  };
}

// Si el pedido no existe o el usuario no lo puede ver, la respuesta es la misma (404).
async function loadVisible(ex: Executor, a: Access, id: number): Promise<Header> {
  const [h] = await headerQuery(ex).where(eq(orders.id, id));
  if (!h || !canSee(a, h)) throw new AppError(404, "ORDER_NOT_FOUND", "Pedido no encontrado");
  return h;
}

const itemColumns = {
  orderId: orderItems.orderId,
  productId: orderItems.productId,
  productName: products.name,
  unit: products.unit,
  quantity: orderItems.quantity,
};

async function loadItems(ex: Executor, orderIds: number[]) {
  if (orderIds.length === 0) return [];
  return ex
    .select(itemColumns)
    .from(orderItems)
    .innerJoin(products, eq(products.id, orderItems.productId))
    .where(inArray(orderItems.orderId, orderIds))
    .orderBy(asc(orderItems.id));
}

async function orderDetail(ex: Executor, a: Access, h: Header) {
  const items = (await loadItems(ex, [h.id])).map(({ orderId: _orderId, ...item }) => item);
  const history = await ex
    .select({
      fromStatus: orderStatusEvents.fromStatus,
      toStatus: orderStatusEvents.toStatus,
      actorName: users.name,
      createdAt: orderStatusEvents.createdAt,
    })
    .from(orderStatusEvents)
    .innerJoin(users, eq(users.id, orderStatusEvents.actorUserId))
    .where(eq(orderStatusEvents.orderId, h.id))
    .orderBy(asc(orderStatusEvents.id));
  return { ...h, items, history, allowedTransitions: allowedTransitions(h.status, orderRoles(a, h)) };
}

/** Descuenta las existencias del giro proveedor al despachar. Falla si no alcanzan. */
async function deductStock(tx: Tx, supplierUnitId: number, items: { productId: number; quantity: number }[]) {
  const { inventoryItems, sites } = schema;
  for (const item of items) {
    const stock = await tx
      .select({ siteId: inventoryItems.siteId, quantity: inventoryItems.quantity })
      .from(inventoryItems)
      .innerJoin(sites, eq(sites.id, inventoryItems.siteId))
      .where(and(eq(sites.businessUnitId, supplierUnitId), eq(inventoryItems.productId, item.productId)))
      .orderBy(desc(inventoryItems.quantity))
      .for("update", { of: inventoryItems });

    const available = round2(stock.reduce((sum, s) => sum + s.quantity, 0));
    if (available < item.quantity) {
      throw new AppError(422, "INSUFFICIENT_STOCK", "Las existencias del giro proveedor no alcanzan para despachar", [
        { field: `items.${item.productId}`, issue: `Solicitado ${item.quantity}, disponible ${available}` },
      ]);
    }

    let remaining = item.quantity;
    for (const row of stock) {
      if (remaining <= 0) break;
      const take = Math.min(row.quantity, remaining);
      await tx
        .update(inventoryItems)
        .set({ quantity: round2(row.quantity - take) })
        .where(and(eq(inventoryItems.siteId, row.siteId), eq(inventoryItems.productId, item.productId)));
      remaining = round2(remaining - take);
    }
  }
}

// ---------- Rutas ----------

export const orderRoutes = new Hono<AppEnv>()
  .use("*", requireAuth, loadAccess)

  .get("/", validate("query", listQuery), async (c) => {
    const access = c.get("access");
    const q = c.req.valid("query");
    const owner = isOwner(access);
    const mine = memberUnitIds(access);
    const empty = { items: [], page: q.page, pageSize: q.pageSize, total: 0 };
    if (!owner && mine.length === 0) return c.json(empty);

    // Qué pedidos puede ver el usuario.
    const visible = owner ? undefined : or(inArray(orders.supplierUnitId, mine), inArray(orders.requestingUnitId, mine));

    // Filtro por giro y por lado ("que debo atender" = proveedor; "solicitados por mi giro" = solicitante).
    let relation: SQL | undefined;
    if (q.businessUnitId) {
      const id = q.businessUnitId;
      relation =
        q.relation === "supplier"
          ? eq(orders.supplierUnitId, id)
          : q.relation === "requester"
            ? eq(orders.requestingUnitId, id)
            : or(eq(orders.supplierUnitId, id), eq(orders.requestingUnitId, id));
    } else if (q.relation && !owner) {
      relation =
        q.relation === "supplier" ? inArray(orders.supplierUnitId, mine) : inArray(orders.requestingUnitId, mine);
    }

    // Las fechas se interpretan en hora de Guatemala (UTC-6).
    const from = q.from ? new Date(`${q.from}T00:00:00-06:00`) : undefined;
    const toExclusive = q.to ? new Date(new Date(`${q.to}T00:00:00-06:00`).getTime() + 24 * 3600 * 1000) : undefined;

    const where = and(
      visible,
      relation,
      q.status ? eq(orders.status, q.status) : undefined,
      from ? gte(orders.createdAt, from) : undefined,
      toExclusive ? lt(orders.createdAt, toExclusive) : undefined,
    );

    const [{ total }] = await db.select({ total: count() }).from(orders).where(where);
    const headers = await headerQuery(db)
      .where(where)
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize);

    const items = await loadItems(db, headers.map((h) => h.id));
    return c.json({
      items: headers.map((h) => ({
        ...h,
        items: items.filter((i) => i.orderId === h.id).map(({ orderId: _orderId, ...item }) => item),
      })),
      page: q.page,
      pageSize: q.pageSize,
      total,
    });
  })

  .post("/", validate("json", createSchema), async (c) => {
    const access = c.get("access");
    const body = c.req.valid("json");

    if (!rolesIn(access, body.requestingUnitId).some((r) => CAN_CREATE.includes(r))) {
      throw new AppError(403, "FORBIDDEN", "Su rol no permite crear pedidos para este giro");
    }
    if (body.supplierUnitId === body.requestingUnitId) {
      throw new AppError(422, "SAME_UNIT", "El giro proveedor debe ser distinto del giro solicitante", [
        { field: "supplierUnitId", issue: "debe ser distinto de requestingUnitId" },
      ]);
    }

    // La fecha requerida no puede ser anterior a hoy (hora de Guatemala).
    const today = todayGT();
    if (body.dueDate < today) {
      throw new AppError(422, "DUE_DATE_IN_PAST", "La fecha requerida no puede ser anterior a hoy", [
        { field: "dueDate", issue: `mínimo ${today}` },
      ]);
    }

    const units = await db
      .select({ id: businessUnits.id })
      .from(businessUnits)
      .where(inArray(businessUnits.id, [body.supplierUnitId, body.requestingUnitId]));
    if (units.length !== 2) throw new AppError(422, "UNIT_NOT_FOUND", "El giro proveedor o el solicitante no existe");

    const found = await db
      .select({ id: products.id, businessUnitId: products.businessUnitId })
      .from(products)
      .where(inArray(products.id, body.items.map((i) => i.productId)));
    const invalid = body.items.filter(
      (i) => !found.some((p) => p.id === i.productId && p.businessUnitId === body.supplierUnitId),
    );
    if (invalid.length > 0) {
      throw new AppError(
        422,
        "PRODUCT_NOT_FROM_SUPPLIER",
        "Hay productos que no pertenecen al giro proveedor",
        invalid.map((i) => ({ field: `items.${i.productId}`, issue: "no pertenece al giro proveedor" })),
      );
    }

    const id = await db.transaction(async (tx) => {
      const [order] = await tx
        .insert(orders)
        .values({
          kind: body.kind,
          supplierUnitId: body.supplierUnitId,
          requestingUnitId: body.requestingUnitId,
          status: body.status,
          dueDate: body.dueDate,
          createdByUserId: access.userId,
        })
        .returning({ id: orders.id });
      await tx.insert(orderItems).values(body.items.map((i) => ({ orderId: order.id, ...i })));
      await tx
        .insert(orderStatusEvents)
        .values({ orderId: order.id, fromStatus: null, toStatus: body.status, actorUserId: access.userId });
      return order.id;
    });

    const header = await loadVisible(db, access, id);
    return c.json(await orderDetail(db, access, header), 201);
  })

  .get("/:id", validate("param", idParam), async (c) => {
    const access = c.get("access");
    const header = await loadVisible(db, access, c.req.valid("param").id);
    return c.json(await orderDetail(db, access, header));
  })

  .patch("/:id/status", validate("param", idParam), validate("json", statusSchema), async (c) => {
    const access = c.get("access");
    const { id } = c.req.valid("param");
    const { status: to } = c.req.valid("json");

    await db.transaction(async (tx) => {
      // Se bloquea la fila para que dos cambios simultáneos no se pisen.
      const [locked] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, id)).for("update");
      if (!locked) throw new AppError(404, "ORDER_NOT_FOUND", "Pedido no encontrado");
      const header = await loadVisible(tx, access, id);
      const from = header.status;

      const check = checkTransition(from, to, orderRoles(access, header));
      if (check === "invalid") {
        throw new AppError(409, "ORDER_INVALID_TRANSITION", `No se puede pasar de '${from}' a '${to}'.`, [
          { field: "status", issue: "transición no permitida" },
        ]);
      }
      if (check === "forbidden") {
        throw new AppError(403, "FORBIDDEN", `Su rol no permite pasar el pedido a '${to}'`);
      }

      if (to === "despachado") {
        const items = await loadItems(tx, [id]);
        await deductStock(tx, header.supplierUnitId, items);
      }

      await tx.update(orders).set({ status: to, updatedAt: new Date() }).where(eq(orders.id, id));
      await tx
        .insert(orderStatusEvents)
        .values({ orderId: id, fromStatus: from, toStatus: to, actorUserId: access.userId });
    });

    const header = await loadVisible(db, access, id);
    return c.json(await orderDetail(db, access, header));
  })

  .get("/:id/messages", validate("param", idParam), async (c) => {
    const access = c.get("access");
    const { id } = c.req.valid("param");
    await loadVisible(db, access, id);
    const items = await db
      .select({
        id: orderMessages.id,
        authorName: users.name,
        body: orderMessages.body,
        createdAt: orderMessages.createdAt,
      })
      .from(orderMessages)
      .innerJoin(users, eq(users.id, orderMessages.authorUserId))
      .where(eq(orderMessages.orderId, id))
      .orderBy(asc(orderMessages.id));
    return c.json({ items });
  })

  .post("/:id/messages", validate("param", idParam), validate("json", messageSchema), async (c) => {
    const access = c.get("access");
    const { id } = c.req.valid("param");
    await loadVisible(db, access, id);
    const [message] = await db
      .insert(orderMessages)
      .values({ orderId: id, authorUserId: access.userId, body: c.req.valid("json").body })
      .returning({ id: orderMessages.id, body: orderMessages.body, createdAt: orderMessages.createdAt });
    const [author] = await db.select({ name: users.name }).from(users).where(eq(users.id, access.userId));
    return c.json({ ...message, authorName: author.name }, 201);
  });
