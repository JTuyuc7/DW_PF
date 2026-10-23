import { and, asc, count, desc, eq, gte, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { type B2BEnv, requireApiKey, requireScope } from "../b2b/auth";
import { dateString, todayGT } from "../dates";
import { db, schema } from "../db";
import { AppError, validate } from "../errors";
import { ORDER_STATUSES } from "../orders/rules";

const { orders, orderItems, orderStatusEvents, products, businessUnits } = schema;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

const idParam = z.object({ id: z.coerce.number().int().positive() });

const createSchema = z.object({
  // Identificador del pedido en el sistema del tercero. Hace idempotente la creación.
  externalRef: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[\x21-\x7e]+$/, "Use caracteres ASCII visibles, sin espacios"),
  dueDate: dateString,
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
  updatedSince: z.string().datetime({ offset: true, message: "Use fecha y hora ISO 8601 con zona horaria" }).optional(),
});

const round2 = (n: number) => Math.round(n * 100) / 100;

// Representación pública de un pedido: sin datos internos (usuarios, giros solicitantes ni existencias).
async function loadOrders(ex: Executor, clientId: number, where: ReturnType<typeof and>, limit?: { size: number; offset: number }) {
  const q = ex
    .select({
      id: orders.id,
      externalRef: orders.externalRef,
      status: orders.status,
      dueDate: orders.dueDate,
      supplierUnitId: orders.supplierUnitId,
      supplierName: businessUnits.name,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .innerJoin(businessUnits, eq(businessUnits.id, orders.supplierUnitId))
    .where(and(eq(orders.apiClientId, clientId), where))
    .orderBy(desc(orders.updatedAt), desc(orders.id));
  const headers = limit ? await q.limit(limit.size).offset(limit.offset) : await q;
  if (headers.length === 0) return [];
  const ids = headers.map((h) => h.id);
  const items = await ex
    .select({ orderId: orderItems.orderId, productId: orderItems.productId, productName: products.name, unit: products.unit, quantity: orderItems.quantity })
    .from(orderItems)
    .innerJoin(products, eq(products.id, orderItems.productId))
    .where(inArray(orderItems.orderId, ids))
    .orderBy(asc(orderItems.id));
  const history = await ex
    .select({ orderId: orderStatusEvents.orderId, fromStatus: orderStatusEvents.fromStatus, toStatus: orderStatusEvents.toStatus, at: orderStatusEvents.createdAt })
    .from(orderStatusEvents)
    .where(inArray(orderStatusEvents.orderId, ids))
    .orderBy(asc(orderStatusEvents.id));
  return headers.map(({ supplierUnitId, supplierName, ...h }) => ({
    ...h,
    supplier: { id: supplierUnitId, name: supplierName },
    items: items.filter((i) => i.orderId === h.id).map(({ orderId: _o, ...i }) => i),
    history: history.filter((e) => e.orderId === h.id).map(({ orderId: _o, ...e }) => e),
  }));
}

type Body = z.infer<typeof createSchema>;

// Un reenvío con el mismo contenido es el mismo pedido; con otro contenido es un error del integrador.
function sameRequest(existing: { dueDate: string; items: { productId: number; quantity: number }[] }, body: Body) {
  const a = new Map(existing.items.map((i) => [i.productId, round2(i.quantity)]));
  return existing.dueDate === body.dueDate && a.size === body.items.length && body.items.every((i) => a.get(i.productId) === round2(i.quantity));
}

const isUniqueViolation = (e: unknown) => {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
};

export const b2bRoutes = new Hono<B2BEnv>()
  .use("*", requireApiKey)

  // Productos que el cliente puede pedir (los de los giros que se le asignaron).
  .get("/products", requireScope("catalog:read"), async (c) => {
    const { unitIds } = c.get("apiClient");
    if (unitIds.length === 0) return c.json({ items: [] });
    const items = await db
      .select({ id: products.id, name: products.name, unit: products.unit, supplier: { id: businessUnits.id, name: businessUnits.name } })
      .from(products)
      .innerJoin(businessUnits, eq(businessUnits.id, products.businessUnitId))
      .where(inArray(products.businessUnitId, unitIds))
      .orderBy(asc(products.businessUnitId), asc(products.name));
    return c.json({ items });
  })

  .post("/orders", requireScope("orders:write"), validate("json", createSchema), async (c) => {
    const client = c.get("apiClient");
    const body = c.req.valid("json");

    const existing = async (ex: Executor) => (await loadOrders(ex, client.id, eq(orders.externalRef, body.externalRef)))[0];
    const replay = (order: NonNullable<Awaited<ReturnType<typeof existing>>>) => {
      if (!sameRequest(order, body)) {
        throw new AppError(409, "IDEMPOTENCY_CONFLICT", "Ya existe un pedido con esa externalRef y contenido distinto", [
          { field: "externalRef", issue: `corresponde al pedido ${order.id} con otros datos` },
        ]);
      }
      return c.json(order, 200);
    };

    // Primero se revisa el reenvío: una repetición válida no debe fallar por validaciones que dependen de la fecha de hoy.
    const prior = await existing(db);
    if (prior) return replay(prior);

    const today = todayGT();
    if (body.dueDate < today) {
      throw new AppError(422, "DUE_DATE_IN_PAST", "La fecha requerida no puede ser anterior a hoy", [{ field: "dueDate", issue: `mínimo ${today}` }]);
    }

    const found = await db
      .select({ id: products.id, businessUnitId: products.businessUnitId })
      .from(products)
      .where(inArray(products.id, body.items.map((i) => i.productId)));
    const missing = body.items.filter((i) => !found.some((p) => p.id === i.productId));
    if (missing.length > 0) {
      throw new AppError(422, "PRODUCT_NOT_FOUND", "Hay productos que no existen", missing.map((i) => ({ field: `items.${i.productId}`, issue: "no existe" })));
    }
    const notAllowed = found.filter((p) => !client.unitIds.includes(p.businessUnitId));
    if (notAllowed.length > 0) {
      throw new AppError(
        422,
        "PRODUCT_NOT_ALLOWED",
        "La clave no puede pedir productos de ese giro",
        notAllowed.map((p) => ({ field: `items.${p.id}`, issue: "no disponible para este cliente" })),
      );
    }
    const supplierUnitIds = [...new Set(found.map((p) => p.businessUnitId))];
    if (supplierUnitIds.length !== 1) {
      throw new AppError(422, "MIXED_SUPPLIERS", "Cada pedido debe incluir productos de un solo giro; cree un pedido por giro");
    }

    try {
      const id = await db.transaction(async (tx) => {
        const [order] = await tx
          .insert(orders)
          .values({
            kind: "tercero",
            supplierUnitId: supplierUnitIds[0],
            status: "solicitado",
            dueDate: body.dueDate,
            apiClientId: client.id,
            externalRef: body.externalRef,
          })
          .returning({ id: orders.id });
        await tx.insert(orderItems).values(body.items.map((i) => ({ orderId: order.id, ...i })));
        await tx.insert(orderStatusEvents).values({ orderId: order.id, fromStatus: null, toStatus: "solicitado", actorApiClientId: client.id });
        return order.id;
      });
      const [created] = await loadOrders(db, client.id, eq(orders.id, id));
      return c.json(created, 201);
    } catch (e) {
      // Dos solicitudes simultáneas con la misma referencia: gana una y la otra recibe el pedido existente.
      if (isUniqueViolation(e)) {
        const winner = await existing(db);
        if (winner) return replay(winner);
      }
      throw e;
    }
  })

  .get("/orders", requireScope("orders:read"), validate("query", listQuery), async (c) => {
    const client = c.get("apiClient");
    const q = c.req.valid("query");
    const where = and(q.status ? eq(orders.status, q.status) : undefined, q.updatedSince ? gte(orders.updatedAt, new Date(q.updatedSince)) : undefined);
    const [{ total }] = await db.select({ total: count() }).from(orders).where(and(eq(orders.apiClientId, client.id), where));
    const items = await loadOrders(db, client.id, where, { size: q.pageSize, offset: (q.page - 1) * q.pageSize });
    return c.json({ items, page: q.page, pageSize: q.pageSize, total });
  })

  // Un pedido de otro cliente no existe para este.
  .get("/orders/:id", requireScope("orders:read"), validate("param", idParam), async (c) => {
    const [order] = await loadOrders(db, c.get("apiClient").id, eq(orders.id, c.req.valid("param").id));
    if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Pedido no encontrado");
    return c.json(order);
  });
