import { db, client, schema } from "./index";

const demoUsers = [
  { email: "dueno@transport.gt", name: "Dueño Demo", role: "dueno" },
  { email: "gerente@transport.gt", name: "Gerente Demo", role: "gerente" },
  { email: "vendedor@transport.gt", name: "Vendedor Demo", role: "vendedor" },
  { email: "operativo@transport.gt", name: "Operativo Demo", role: "operativo" },
  { email: "cliente@ejemplo.gt", name: "Cliente Demo", role: "cliente" },
] as const;

const seedPassword = process.env.SEED_PASSWORD;
if (!seedPassword) throw new Error("SEED_PASSWORD no está definida");

const passwordHash = await Bun.password.hash(seedPassword);

for (const u of demoUsers) {
  await db
    .insert(schema.users)
    .values({ ...u, passwordHash })
    .onConflictDoNothing({ target: schema.users.email });
}

console.log(`Seed listo: ${demoUsers.length} usuarios demo (contraseña: SEED_PASSWORD)`);
await client.end();
