import { eq } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import { jwt, sign } from "hono/jwt";
import { db, schema } from "./db";
import { AppError } from "./errors";
import type { Access, AppEnv, Membership, Role } from "./types";

const secret: string =
  process.env.JWT_SECRET ??
  (() => {
    throw new Error("JWT_SECRET no está definida");
  })();
const TTL_SECONDS = 60 * 60 * 8;

// El token solo identifica al usuario. Los roles se leen de la base en cada solicitud,
// de modo que un cambio de membresía surte efecto de inmediato.
export function signToken(user: { id: number }) {
  return sign({ sub: String(user.id), exp: Math.floor(Date.now() / 1000) + TTL_SECONDS }, secret);
}

export const requireAuth = jwt({ secret, alg: "HS256" });

export async function getMemberships(userId: number) {
  return db
    .select({
      businessUnitId: schema.memberships.businessUnitId,
      businessUnitName: schema.businessUnits.name,
      role: schema.memberships.role,
    })
    .from(schema.memberships)
    .leftJoin(schema.businessUnits, eq(schema.businessUnits.id, schema.memberships.businessUnitId))
    .where(eq(schema.memberships.userId, userId))
    .orderBy(schema.memberships.id);
}

export const loadAccess: MiddlewareHandler<AppEnv> = async (c, next) => {
  const userId = Number(c.get("jwtPayload").sub);
  const [user] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, userId));
  if (!user) throw new AppError(401, "UNAUTHORIZED", "Sesión no válida");
  const rows = await getMemberships(userId);
  const memberships: Membership[] = rows.map((m) => ({ businessUnitId: m.businessUnitId, role: m.role }));
  c.set("access", { userId, memberships } satisfies Access);
  await next();
};

/** El dueño (membresía sin giro) ve toda la organización. */
export const isOwner = (a: Access) => a.memberships.some((m) => m.role === "dueno" && m.businessUnitId === null);

/** Roles que el usuario tiene en un giro. */
export const rolesIn = (a: Access, unitId: number | null): Role[] =>
  a.memberships.filter((m) => m.businessUnitId === unitId).map((m) => m.role);

/** Giros en los que el usuario tiene alguna membresía. */
export const memberUnitIds = (a: Access): number[] => [
  ...new Set(a.memberships.flatMap((m) => (m.businessUnitId === null ? [] : [m.businessUnitId]))),
];
