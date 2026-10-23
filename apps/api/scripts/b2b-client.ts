// Da de alta un cliente de la API B2B y muestra su clave UNA sola vez (en la base solo queda el hash).
//
//   bun run b2b:client -- "Cementos Ejemplo, S. A." --units EXT,PRO
//   bun run b2b:client -- "Solo lectura" --units EXT --scopes catalog:read,orders:read
//
// --units: códigos de los giros a los que puede pedir (obligatorio). --scopes: por defecto todos.
import { inArray } from "drizzle-orm";
import { SCOPES, generateApiKey } from "../src/b2b/keys";
import { client, db, schema } from "../src/db";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const name = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const unitCodes = flag("units")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
const scopes = flag("scopes")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [...SCOPES];

if (!name || unitCodes.length === 0) {
  console.error('Uso: bun run b2b:client -- "Nombre del cliente" --units EXT,PRO [--scopes orders:read,orders:write,catalog:read]');
  process.exit(1);
}
const badScope = scopes.find((s) => !(SCOPES as readonly string[]).includes(s));
if (badScope) {
  console.error(`Alcance desconocido: ${badScope}. Válidos: ${SCOPES.join(", ")}`);
  process.exit(1);
}

const units = await db.select().from(schema.businessUnits).where(inArray(schema.businessUnits.code, unitCodes));
const unknown = unitCodes.filter((c) => !units.some((u) => u.code === c));
if (unknown.length > 0) {
  console.error(`Giros desconocidos: ${unknown.join(", ")}`);
  process.exit(1);
}

const { key, keyPrefix, keyHash } = generateApiKey();
const [created] = await db
  .insert(schema.apiClients)
  .values({ name, keyPrefix, keyHash, scopes, unitIds: units.map((u) => u.id) })
  .returning({ id: schema.apiClients.id });

console.log(`Cliente #${created.id} "${name}" creado. Giros: ${unitCodes.join(", ")}. Alcances: ${scopes.join(", ")}.`);
console.log(`\nClave (guárdela ahora, no se vuelve a mostrar):\n\n  ${key}\n`);
await client.end();
