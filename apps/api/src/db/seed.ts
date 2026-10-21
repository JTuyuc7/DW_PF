import { count, eq } from "drizzle-orm";
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

console.log(`Seed listo: ${units.length} giros, ${demoUsers.length} usuarios demo (contraseña: SEED_PASSWORD)`);
await client.end();
