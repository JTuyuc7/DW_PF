import { db, client, schema } from "./index";

const demoUsers = [
  { email: "dueno@transport.gt", name: "Dueño Demo", role: "dueno" },
  { email: "gerente@transport.gt", name: "Gerente Demo", role: "gerente" },
  { email: "vendedor@transport.gt", name: "Vendedor Demo", role: "vendedor" },
  { email: "operativo@transport.gt", name: "Operativo Demo", role: "operativo" },
  { email: "cliente@ejemplo.gt", name: "Cliente Demo", role: "cliente" },
] as const;

const passwordHash = await Bun.password.hash("demo1234");

for (const u of demoUsers) {
  await db
    .insert(schema.users)
    .values({ ...u, passwordHash })
    .onConflictDoNothing({ target: schema.users.email });
}

console.log(`Seed listo: ${demoUsers.length} usuarios demo (contraseña: demo1234)`);
await client.end();
