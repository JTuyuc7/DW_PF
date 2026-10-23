import { count, eq } from "drizzle-orm";
import { ALERT_TYPES, DEFAULT_RULES } from "../alerts/rules";
import { SCOPES, hashApiKey, looksLikeApiKey } from "../b2b/keys";
import { seedDemoData } from "./demo";
import { client, db, schema } from "./index";

const seedPassword = process.env.SEED_PASSWORD;
if (!seedPassword) throw new Error("SEED_PASSWORD no está definida");

// Datos de ejemplo para desarrollo. El catálogo de productos es provisional.
const units = [
  { code: "EXT", name: "Extracción minera", type: "extraccion", description: "Materia prima en bruto." },
  { code: "PRO", name: "Proceso de materia prima", type: "proceso", description: "Transformación en producto terminado." },
  { code: "MAQ", name: "Venta y alquiler de maquinaria", type: "maquinaria", description: "Alquiler y venta de equipo pesado." },
  { code: "TMP", name: "Transporte de materia prima", type: "transporte_materia", description: "Traslado de materia prima hacia planta." },
  { code: "TPR", name: "Transporte de productos", type: "transporte_producto", description: "Entrega de producto a clientes y puertos." },
  { code: "CON", name: "Servicios de construcción", type: "construccion", description: "Obra civil: puentes, carreteras y edificios." },
] as const;

const sitesByUnit: Record<string, string[]> = {
  EXT: ["Cobán", "El Progreso", "Quetzaltenango", "Petén"],
  PRO: ["Zacapa", "Huehuetenango", "Petén"],
  MAQ: ["Guatemala", "Quetzaltenango", "Zacapa", "Petén"],
  TMP: ["Guatemala"],
  TPR: ["Guatemala"],
  CON: ["Guatemala"],
};

const productsByUnit: Record<string, { name: string; unit: string }[]> = {
  EXT: [
    { name: "Piedra caliza en bruto", unit: "tonelada" },
    { name: "Material de relleno", unit: "tonelada" },
  ],
  PRO: [
    { name: "Agregado triturado", unit: "tonelada" },
    { name: "Piso cerámico", unit: "m2" },
  ],
  MAQ: [{ name: "Alquiler de excavadora", unit: "hora" }],
  TMP: [{ name: "Flete de materia prima", unit: "viaje" }],
  TPR: [{ name: "Flete de producto", unit: "viaje" }],
  CON: [{ name: "Obra civil", unit: "m2" }],
};

// [giro, sede, producto, existencia, mínimo]
const stock: [string, string, string, number, number][] = [
  ["EXT", "Cobán", "Piedra caliza en bruto", 1000, 200],
  ["EXT", "Quetzaltenango", "Piedra caliza en bruto", 450, 100],
  ["EXT", "El Progreso", "Material de relleno", 600, 100],
  ["PRO", "Zacapa", "Agregado triturado", 300, 50],
  ["PRO", "Zacapa", "Piso cerámico", 2000, 400],
  // Existencias bajo el mínimo (generan alertas de stock) y capacidad de los giros de servicio.
  ["EXT", "Petén", "Material de relleno", 0, 50],
  ["PRO", "Huehuetenango", "Agregado triturado", 20, 60],
  ["MAQ", "Guatemala", "Alquiler de excavadora", 400, 80],
  ["MAQ", "Quetzaltenango", "Alquiler de excavadora", 12, 40],
  ["TMP", "Guatemala", "Flete de materia prima", 24, 8],
  ["TPR", "Guatemala", "Flete de producto", 30, 10],
  ["CON", "Guatemala", "Obra civil", 5000, 500],
];

// [correo, nombre, membresías (giro nulo = toda la organización)]
const demoUsers: [string, string, { unit: string | null; role: (typeof schema.membershipRoleEnum.enumValues)[number] }[]][] = [
  ["dueno@transport.gt", "Dueño Demo", [{ unit: null, role: "dueno" }]],
  ["gerente@transport.gt", "Gerente Extracción Demo", [{ unit: "EXT", role: "gerente" }]],
  ["operativo.extraccion@transport.gt", "Operativo Extracción Demo", [{ unit: "EXT", role: "operativo" }]],
  ["gerente.proceso@transport.gt", "Gerente Proceso Demo", [{ unit: "PRO", role: "gerente" }]],
  ["operativo@transport.gt", "Operativo Proceso Demo", [{ unit: "PRO", role: "operativo" }]],
  ["vendedor@transport.gt", "Vendedor Demo", [{ unit: "EXT", role: "vendedor" }, { unit: "PRO", role: "vendedor" }]],
  ["vendedor.proceso@transport.gt", "Vendedor Proceso Demo", [{ unit: "PRO", role: "vendedor" }]],
  ["gerente.maquinaria@transport.gt", "Gerente Maquinaria Demo", [{ unit: "MAQ", role: "gerente" }]],
  ["gerente.transporte@transport.gt", "Gerente Transporte Demo", [{ unit: "TMP", role: "gerente" }]],
  ["administrativo@transport.gt", "Administrativo Demo", [{ unit: "EXT", role: "administrativo" }]],
  // Sin membresías: los clientes se modelarán con su propia entidad.
  ["cliente@ejemplo.gt", "Cliente Demo", []],
];

await db.insert(schema.businessUnits).values([...units]).onConflictDoNothing({ target: schema.businessUnits.code });
const unitId = new Map((await db.select().from(schema.businessUnits)).map((u) => [u.code, u.id]));
const idOf = (code: string) => {
  const id = unitId.get(code);
  if (!id) throw new Error(`Giro desconocido: ${code}`);
  return id;
};

for (const [code, names] of Object.entries(sitesByUnit)) {
  await db
    .insert(schema.sites)
    .values(names.map((name) => ({ businessUnitId: idOf(code), name, department: name })))
    .onConflictDoNothing();
}
const siteId = new Map(
  (await db.select().from(schema.sites)).map((s) => [`${s.businessUnitId}:${s.name}`, s.id]),
);

for (const [code, items] of Object.entries(productsByUnit)) {
  await db
    .insert(schema.products)
    .values(items.map((p) => ({ ...p, businessUnitId: idOf(code), public: true })))
    .onConflictDoNothing();
}
const productId = new Map(
  (await db.select().from(schema.products)).map((p) => [`${p.businessUnitId}:${p.name}`, p.id]),
);

for (const [code, site, product, quantity, minThreshold] of stock) {
  await db
    .insert(schema.inventoryItems)
    .values({
      siteId: siteId.get(`${idOf(code)}:${site}`)!,
      productId: productId.get(`${idOf(code)}:${product}`)!,
      quantity,
      minThreshold,
    })
    .onConflictDoNothing();
}

// Flota con GPS: [giro, tipo, nombre, id del dispositivo]
const fleet: [string, "camion" | "maquinaria", string, string][] = [
  ["TMP", "camion", "Camión TMP-01", "GPS-TMP-01"],
  ["TMP", "camion", "Camión TMP-02", "GPS-TMP-02"],
  ["TPR", "camion", "Camión TPR-01", "GPS-TPR-01"],
  ["MAQ", "maquinaria", "Excavadora MAQ-01", "GPS-MAQ-01"],
  ["EXT", "maquinaria", "Cargador EXT-01", "GPS-EXT-01"],
];
await db
  .insert(schema.assets)
  .values(fleet.map(([code, kind, name, gpsExternalId]) => ({ businessUnitId: idOf(code), kind, name, gpsExternalId })))
  .onConflictDoNothing({ target: schema.assets.gpsExternalId });
await db
  .insert(schema.alertRules)
  .values(ALERT_TYPES.map((type) => ({ type, ...DEFAULT_RULES[type] })))
  .onConflictDoNothing({ target: schema.alertRules.type });

const passwordHash = await Bun.password.hash(seedPassword);
for (const [email, name, memberships] of demoUsers) {
  await db.insert(schema.users).values({ email, name, passwordHash }).onConflictDoNothing({ target: schema.users.email });
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (memberships.length > 0) {
    await db
      .insert(schema.memberships)
      .values(memberships.map((m) => ({ userId: user.id, businessUnitId: m.unit ? idOf(m.unit) : null, role: m.role })))
      .onConflictDoNothing();
  }
}

// Un pedido de ejemplo (Proceso solicita a Extracción) para tener datos al explorar la API.
const [{ total }] = await db.select({ total: count() }).from(schema.orders);
if (total === 0) {
  const [requester] = await db.select().from(schema.users).where(eq(schema.users.email, "operativo@transport.gt"));
  const dueDate = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const [order] = await db
    .insert(schema.orders)
    .values({
      kind: "interno",
      supplierUnitId: idOf("EXT"),
      requestingUnitId: idOf("PRO"),
      status: "solicitado",
      dueDate,
      createdByUserId: requester.id,
    })
    .returning({ id: schema.orders.id });
  await db.insert(schema.orderItems).values({
    orderId: order.id,
    productId: productId.get(`${idOf("EXT")}:Piedra caliza en bruto`)!,
    quantity: 120,
  });
  await db
    .insert(schema.orderStatusEvents)
    .values({ orderId: order.id, fromStatus: null, toStatus: "solicitado", actorUserId: requester.id });
}

// Cliente de la API B2B de ejemplo, con la clave de B2B_DEMO_API_KEY (solo desarrollo) y un par de pedidos de tercero.
const demoKey = process.env.B2B_DEMO_API_KEY;
if (demoKey) {
  if (!looksLikeApiKey(demoKey)) throw new Error("B2B_DEMO_API_KEY no tiene el formato de una clave (tp_live_ + 43 caracteres)");
  await db
    .insert(schema.apiClients)
    .values({
      name: "Cementos Ejemplo, S. A.",
      keyPrefix: demoKey.slice(0, 12),
      keyHash: hashApiKey(demoKey),
      scopes: [...SCOPES],
      unitIds: [idOf("EXT"), idOf("PRO")],
    })
    .onConflictDoNothing({ target: schema.apiClients.keyHash });
  const [apiClient] = await db.select().from(schema.apiClients).where(eq(schema.apiClients.keyHash, hashApiKey(demoKey)));
  const [{ ordersOfClient }] = await db
    .select({ ordersOfClient: count() })
    .from(schema.orders)
    .where(eq(schema.orders.apiClientId, apiClient.id));
  if (ordersOfClient === 0) {
    const [manager] = await db.select().from(schema.users).where(eq(schema.users.email, "gerente.proceso@transport.gt"));
    const day = (offset: number) => new Date(Date.now() - 6 * 3600 * 1000 + offset * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const thirdParty: [string, string, string, number, "solicitado" | "aprobado", number][] = [
      ["OC-2026-0147", "EXT", "Piedra caliza en bruto", 150, "solicitado", 9],
      ["OC-2026-0152", "PRO", "Piso cerámico", 500, "aprobado", 12],
    ];
    for (const [externalRef, unit, product, quantity, status, due] of thirdParty) {
      const [order] = await db
        .insert(schema.orders)
        .values({ kind: "tercero", supplierUnitId: idOf(unit), status, dueDate: day(due), apiClientId: apiClient.id, externalRef })
        .returning({ id: schema.orders.id });
      await db.insert(schema.orderItems).values({ orderId: order.id, productId: productId.get(`${idOf(unit)}:${product}`)!, quantity });
      await db.insert(schema.orderStatusEvents).values({ orderId: order.id, fromStatus: null, toStatus: "solicitado", actorApiClientId: apiClient.id });
      if (status === "aprobado") {
        await db.insert(schema.orderStatusEvents).values({ orderId: order.id, fromStatus: "solicitado", toStatus: "aprobado", actorUserId: manager.id });
      }
    }
  }
}

const demo = await seedDemoData();

console.log(`${demo ? "Datos de ejemplo cargados (pedidos, reuniones y lecturas GPS). " : ""}Seed listo: ${units.length} giros, ${demoUsers.length} usuarios demo (contraseña: SEED_PASSWORD)`);
await client.end();
