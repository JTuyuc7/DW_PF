import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { databaseUrl } from "./url";

export const client = postgres(databaseUrl());
export const db = drizzle(client, { schema });
export { schema };
