import { eq } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import { db, schema } from "../db";
import { AppError } from "../errors";
import { type Scope, hashApiKey, looksLikeApiKey } from "./keys";

export type ApiClient = { id: number; name: string; scopes: string[]; unitIds: number[] };

export type B2BEnv = {
  Variables: { requestId: string; apiClient: ApiClient };
};

/** Autentica con `Authorization: Bearer <clave>`. Las claves inactivas o desconocidas responden igual (401). */
export const requireApiKey: MiddlewareHandler<B2BEnv> = async (c, next) => {
  const header = c.req.header("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const invalid = () => new AppError(401, "UNAUTHORIZED", "Clave de API ausente o inválida");
  if (!looksLikeApiKey(key)) throw invalid();

  const [client] = await db.select().from(schema.apiClients).where(eq(schema.apiClients.keyHash, hashApiKey(key)));
  if (!client || !client.active) throw invalid();

  // La marca de último uso es informativa; no debe frenar la solicitud ni hacerla fallar.
  void db.update(schema.apiClients).set({ lastUsedAt: new Date() }).where(eq(schema.apiClients.id, client.id)).catch(() => {});

  c.set("apiClient", { id: client.id, name: client.name, scopes: client.scopes, unitIds: client.unitIds });
  await next();
};

/** Exige un alcance; sin él, 403 indicando cuál falta. */
export const requireScope =
  (scope: Scope): MiddlewareHandler<B2BEnv> =>
  async (c, next) => {
    if (!c.get("apiClient").scopes.includes(scope)) {
      throw new AppError(403, "INSUFFICIENT_SCOPE", `La clave no tiene el alcance '${scope}'`);
    }
    await next();
  };
