import { eq, sql } from "drizzle-orm";
import { db, schema } from "./index";

// Datos de ejemplo con vida propia (pedidos en todos los estados, retrasos, reuniones, lecturas GPS) para que cada
// usuario demo vea información al entrar. Todo es inventado. Se siembra una sola vez: la marca es el cliente DEMO-001.
const MARKER_TAX_ID = "DEMO-001";

const DAY = 24 * 3600 * 1000;
const HOUR = 3600 * 1000;
const dayGT = (offset: number) => new Date(Date.now() - 6 * HOUR + offset * DAY).toISOString().slice(0, 10);
const ago = (ms: number) => new Date(Date.now() - ms);

type Status = (typeof schema.orderStatusEnum.enumValues)[number];

// Camino de estados hasta el actual, con quien ejecuta cada paso (la API aplica la misma máquina de estados).
const PATH: Record<Status, Status[]> = {
  borrador: ["borrador"],
  solicitado: ["solicitado"],
  aprobado: ["solicitado", "aprobado"],
  en_proceso: ["solicitado", "aprobado", "en_proceso"],
  despachado: ["solicitado", "aprobado", "en_proceso", "despachado"],
  entregado: ["solicitado", "aprobado", "en_proceso", "despachado", "entregado"],
  cancelado: ["solicitado", "cancelado"],
};

type DemoOrder = {
  from: string; // giro solicitante
  to: string; // giro proveedor
  by: string; // correo de quien lo crea
  product: string;
  quantity: number;
  status: Status;
  due: number; // días desde hoy (negativo = fecha vencida)
  age: number; // días desde que se creó
  messages?: [string, string][]; // [correo del autor, texto]
};

const demoOrders: DemoOrder[] = [
  // Extracción provee a Proceso: el gerente de Extracción tiene pedidos por aprobar, preparar y despachar, y dos vencidos.
  { from: "PRO", to: "EXT", by: "operativo@transport.gt", product: "Piedra caliza en bruto", quantity: 200, status: "solicitado", due: 10, age: 1 },
  { from: "PRO", to: "EXT", by: "gerente.proceso@transport.gt", product: "Material de relleno", quantity: 150, status: "aprobado", due: 7, age: 3 },
  {
    from: "PRO", to: "EXT", by: "operativo@transport.gt", product: "Piedra caliza en bruto", quantity: 80, status: "en_proceso", due: 3, age: 5,
    messages: [
      ["operativo@transport.gt", "¿Cuándo sale el camión? Necesitamos el material para la línea 2."],
      ["operativo.extraccion@transport.gt", "Estamos cargando; sale mañana temprano."],
    ],
  },
  { from: "PRO", to: "EXT", by: "operativo@transport.gt", product: "Piedra caliza en bruto", quantity: 120, status: "despachado", due: 2, age: 8 },
  { from: "PRO", to: "EXT", by: "gerente.proceso@transport.gt", product: "Piedra caliza en bruto", quantity: 60, status: "entregado", due: -5, age: 14 },
  { from: "PRO", to: "EXT", by: "operativo@transport.gt", product: "Material de relleno", quantity: 40, status: "cancelado", due: -3, age: 12 },
  {
    from: "PRO", to: "EXT", by: "operativo@transport.gt", product: "Piedra caliza en bruto", quantity: 90, status: "en_proceso", due: -6, age: 16,
    messages: [
      ["gerente.proceso@transport.gt", "El pedido lleva seis días de retraso. ¿Hay novedad?"],
      ["gerente@transport.gt", "Falta equipo de acarreo; lo reprogramamos esta semana."],
    ],
  },
  { from: "PRO", to: "EXT", by: "operativo@transport.gt", product: "Material de relleno", quantity: 50, status: "aprobado", due: -1, age: 9 },
  // Proceso provee a Extracción y a Maquinaria.
  { from: "EXT", to: "PRO", by: "operativo.extraccion@transport.gt", product: "Agregado triturado", quantity: 100, status: "solicitado", due: 5, age: 2 },
  { from: "EXT", to: "PRO", by: "gerente@transport.gt", product: "Piso cerámico", quantity: 300, status: "aprobado", due: 8, age: 4 },
  { from: "MAQ", to: "PRO", by: "gerente.maquinaria@transport.gt", product: "Agregado triturado", quantity: 60, status: "en_proceso", due: -2, age: 10 },
  // Servicios de Transporte y Maquinaria.
  { from: "EXT", to: "TMP", by: "operativo.extraccion@transport.gt", product: "Flete de materia prima", quantity: 6, status: "solicitado", due: 4, age: 1 },
  { from: "PRO", to: "TMP", by: "gerente.proceso@transport.gt", product: "Flete de materia prima", quantity: 4, status: "aprobado", due: 6, age: 3 },
  { from: "EXT", to: "MAQ", by: "gerente@transport.gt", product: "Alquiler de excavadora", quantity: 40, status: "en_proceso", due: 2, age: 6 },
];

// [empresa, NIT, contacto, giro, estado, vendedor, días hasta la reunión o desde que se pidió, mensaje]
const demoMeetings: [string, string | null, string, string, "solicitada" | "confirmada" | "realizada" | "cancelada", string | null, number, string][] = [
  ["Constructora Ejemplo, S. A.", MARKER_TAX_ID, "Mariana López", "EXT", "solicitada", "vendedor@transport.gt", 1, "Necesitamos cotizar 500 toneladas de piedra caliza para una obra en Cobán."],
  ["Cementos del Norte, S. A.", "DEMO-002", "Luis Ramírez", "EXT", "confirmada", "vendedor@transport.gt", 3, "Interesados en un contrato mensual de material de relleno."],
  ["Prefabricados Ejemplo", "DEMO-003", "Ana Morales", "PRO", "solicitada", "vendedor.proceso@transport.gt", 0, "Piso cerámico para 2,000 m2 de bodega."],
  ["Inmobiliaria Ejemplo", "DEMO-004", "Carlos Pérez", "PRO", "confirmada", "vendedor.proceso@transport.gt", 5, "Agregado triturado para un proyecto de vivienda."],
  ["Obras Viales Ejemplo", "DEMO-005", "Rosa Castillo", "PRO", "realizada", "vendedor@transport.gt", -6, "Visita a la planta de Zacapa."],
  ["Agroexportadora Ejemplo", "DEMO-006", "Jorge Méndez", "MAQ", "solicitada", null, 0, "Alquiler de excavadora por tres meses."],
];

// Dispositivo, lecturas recientes (km/h, de la más antigua a la más reciente) y posición base.
const readings: Record<string, { speeds: number[]; lat: number; lng: number }> = {
  "GPS-TMP-01": { speeds: [52, 58, 61, 66, 72, 78, 91, 104], lat: 15.47, lng: -90.37 },
  "GPS-TMP-02": { speeds: [48, 55, 57, 60, 59, 62, 58, 56], lat: 14.97, lng: -89.53 },
  "GPS-TPR-01": { speeds: [60, 64, 70, 75, 83, 88, 96, 92], lat: 14.63, lng: -90.51 },
  "GPS-MAQ-01": { speeds: [0, 6, 9, 8, 11, 7, 9, 10], lat: 14.84, lng: -91.52 },
  "GPS-EXT-01": { speeds: [5, 7, 6, 0, 0, 4, 8, 6], lat: 15.47, lng: -90.4 },
};

export async function seedDemoData() {
  const [marker] = await db.select({ id: schema.customers.id }).from(schema.customers).where(eq(schema.customers.taxId, MARKER_TAX_ID));
  if (marker) return false;

  const units = new Map((await db.select().from(schema.businessUnits)).map((u) => [u.code, u.id]));
  const users = new Map((await db.select().from(schema.users)).map((u) => [u.email, u.id]));
  const products = new Map((await db.select().from(schema.products)).map((p) => [`${p.businessUnitId}:${p.name}`, p.id]));
  const userId = (email: string) => {
    const id = users.get(email);
    if (!id) throw new Error(`Usuario demo desconocido: ${email}`);
    return id;
  };
  const unitId = (code: string) => units.get(code)!;
  const actors: Record<string, Record<"supplier" | "requester", string>> = {
    // Quién ejecuta los pasos del lado proveedor / solicitante en la historia de un pedido.
    EXT: { supplier: "gerente@transport.gt", requester: "operativo.extraccion@transport.gt" },
    PRO: { supplier: "gerente.proceso@transport.gt", requester: "operativo@transport.gt" },
    MAQ: { supplier: "gerente.maquinaria@transport.gt", requester: "gerente.maquinaria@transport.gt" },
    TMP: { supplier: "gerente.transporte@transport.gt", requester: "gerente.transporte@transport.gt" },
  };

  await db.transaction(async (tx) => {
    // --- Pedidos con historial, mensajes y el descuento de inventario de los ya despachados
    for (const o of demoOrders) {
      const created = ago(o.age * DAY);
      const [order] = await tx
        .insert(schema.orders)
        .values({
          kind: "interno",
          supplierUnitId: unitId(o.to),
          requestingUnitId: unitId(o.from),
          status: o.status,
          dueDate: dayGT(o.due),
          createdByUserId: userId(o.by),
          createdAt: created,
          updatedAt: ago(Math.max(0, o.age - PATH[o.status].length) * DAY),
        })
        .returning({ id: schema.orders.id });
      const productId = products.get(`${unitId(o.to)}:${o.product}`);
      if (!productId) throw new Error(`Producto demo desconocido: ${o.product}`);
      await tx.insert(schema.orderItems).values({ orderId: order.id, productId, quantity: o.quantity });

      let prev: Status | null = null;
      const path = PATH[o.status];
      for (const [i, to] of path.entries()) {
        const requesterSide = to === "solicitado" || to === "borrador" || to === "entregado";
        const actor = to === "solicitado" ? o.by : requesterSide ? actors[o.from].requester : actors[o.to].supplier;
        await tx.insert(schema.orderStatusEvents).values({
          orderId: order.id,
          fromStatus: prev,
          toStatus: to,
          actorUserId: userId(actor),
          createdAt: new Date(created.getTime() + (i * Math.max(o.age, 1) * DAY) / (path.length + 1)),
        });
        prev = to;
      }
      for (const [i, [author, body]] of (o.messages ?? []).entries()) {
        await tx.insert(schema.orderMessages).values({
          orderId: order.id,
          authorUserId: userId(author),
          body,
          createdAt: new Date(created.getTime() + (i + 1) * 3 * HOUR),
        });
      }

      // Despachado o entregado: el proveedor ya descontó existencias de la sede con más stock.
      if (o.status === "despachado" || o.status === "entregado") {
        const [row] = await tx
          .select({ siteId: schema.inventoryItems.siteId })
          .from(schema.inventoryItems)
          .innerJoin(schema.sites, eq(schema.sites.id, schema.inventoryItems.siteId))
          .where(sql`${schema.sites.businessUnitId} = ${unitId(o.to)} and ${schema.inventoryItems.productId} = ${productId}`)
          .orderBy(sql`${schema.inventoryItems.quantity} desc`)
          .limit(1);
        if (row) {
          await tx
            .update(schema.inventoryItems)
            .set({ quantity: sql`${schema.inventoryItems.quantity} - ${o.quantity}` })
            .where(sql`${schema.inventoryItems.siteId} = ${row.siteId} and ${schema.inventoryItems.productId} = ${productId}`);
        }
      }
    }

    // --- Reuniones de clientes
    for (const [company, taxId, contact, unit, status, seller, days, message] of demoMeetings) {
      const [customer] = await tx
        .insert(schema.customers)
        .values({ name: company, taxId })
        .onConflictDoUpdate({ target: schema.customers.taxId, set: { name: company } })
        .returning({ id: schema.customers.id });
      const slug = company.toLowerCase().replace(/[^a-z]+/g, "").slice(0, 14);
      const scheduled = status === "confirmada" || status === "realizada";
      await tx.insert(schema.meetings).values({
        customerId: customer.id,
        businessUnitId: unitId(unit),
        sellerUserId: seller ? userId(seller) : null,
        status,
        contactName: contact,
        contactEmail: `contacto@${slug}.example`,
        contactPhone: "5555-0100",
        message,
        preferredDate: status === "solicitada" ? dayGT(7) : null,
        scheduledAt: scheduled ? new Date(Date.now() + days * DAY) : null,
        createdAt: ago(status === "solicitada" ? Math.max(days, 0) * DAY + HOUR : 7 * DAY),
      });
    }

    // --- Lecturas GPS de la última media hora: dos camiones terminan por encima del límite
    const assets = await tx.select().from(schema.assets);
    for (const asset of assets) {
      const r = readings[asset.gpsExternalId];
      if (!r) continue;
      await tx.insert(schema.gpsEvents).values(
        r.speeds.map((speedKmh, i) => ({
          assetId: asset.id,
          recordedAt: ago((r.speeds.length - i) * 4 * 60 * 1000 - 60 * 1000),
          lat: +(r.lat + i * 0.002).toFixed(6),
          lng: +(r.lng + i * 0.0015).toFixed(6),
          speedKmh,
        })),
      );
    }
  });
  return true;
}
