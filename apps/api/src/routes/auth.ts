import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, signToken } from "../auth";
import { db, schema } from "../db";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRoutes = new Hono()
  .post("/login", zValidator("json", loginSchema), async (c) => {
    const { email, password } = c.req.valid("json");
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    const ok = user && (await Bun.password.verify(password, user.passwordHash));
    if (!ok) return c.json({ error: "Credenciales inválidas" }, 401);
    const token = await signToken(user);
    return c.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  })
  .get("/me", requireAuth, async (c) => {
    const { sub } = c.get("jwtPayload") as { sub: string };
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, Number(sub)));
    if (!user) return c.json({ error: "No encontrado" }, 404);
    return c.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  });
