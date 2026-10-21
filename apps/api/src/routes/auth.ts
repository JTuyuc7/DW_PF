import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getMemberships, loadAccess, requireAuth, signToken } from "../auth";
import { db, schema } from "../db";
import { AppError, validate } from "../errors";
import type { AppEnv } from "../types";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

async function userPayload(user: { id: number; name: string; email: string }) {
  return { id: user.id, name: user.name, email: user.email, memberships: await getMemberships(user.id) };
}

export const authRoutes = new Hono<AppEnv>()
  .post("/login", validate("json", loginSchema), async (c) => {
    const { email, password } = c.req.valid("json");
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    const ok = user && (await Bun.password.verify(password, user.passwordHash));
    if (!ok) throw new AppError(401, "INVALID_CREDENTIALS", "Correo o contraseña incorrectos");
    return c.json({ token: await signToken(user), user: await userPayload(user) });
  })
  .get("/me", requireAuth, loadAccess, async (c) => {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, c.get("access").userId));
    return c.json(await userPayload(user));
  });
