import type { MiddlewareHandler } from "hono";
import { jwt, sign } from "hono/jwt";

const secret = process.env.JWT_SECRET;
if (!secret) throw new Error("JWT_SECRET no está definida");
const TTL_SECONDS = 60 * 60 * 8;

export type Role = "dueno" | "gerente" | "vendedor" | "operativo" | "cliente";

export function signToken(user: { id: number; role: Role }) {
  return sign(
    { sub: String(user.id), role: user.role, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS },
    secret,
  );
}

export const requireAuth = jwt({ secret, alg: "HS256" });

export const requireRole = (...roles: Role[]): MiddlewareHandler =>
  async (c, next) => {
    const payload = c.get("jwtPayload") as { role: Role };
    if (!roles.includes(payload.role)) return c.json({ error: "Acceso denegado" }, 403);
    await next();
  };
