import { createHash, randomBytes } from "node:crypto";

/** Alcances que puede tener una clave de API. */
export const SCOPES = ["catalog:read", "orders:read", "orders:write"] as const;
export type Scope = (typeof SCOPES)[number];

const PREFIX = "tp_live_";

/** Clave nueva: se muestra una sola vez; en la base solo quedan su hash y un prefijo para reconocerla. */
export function generateApiKey() {
  const key = PREFIX + randomBytes(32).toString("base64url");
  return { key, keyPrefix: key.slice(0, PREFIX.length + 4), keyHash: hashApiKey(key) };
}

export const hashApiKey = (key: string) => createHash("sha256").update(key).digest("hex");

/** ¿Tiene la forma de una clave emitida por este sistema? Evita consultar la base con basura. */
export const looksLikeApiKey = (key: string) => /^tp_live_[A-Za-z0-9_-]{43}$/.test(key);
