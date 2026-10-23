import { type SQL, and, count, desc, eq, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { evaluateAlerts } from "../alerts/engine";
import { ALERT_TYPES } from "../alerts/rules";
import { isOwner, loadAccess, requireAuth } from "../auth";
import { db, schema } from "../db";
import { AppError, validate } from "../errors";
import type { Access, AppEnv } from "../types";

const { alerts, alertRules, businessUnits, users } = schema;

const idParam = z.object({ id: z.coerce.number().int().positive() });

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["abierta", "atendida"]).default("abierta"),
  severity: z.enum(["info", "aviso", "critica"]).optional(),
  type: z.enum(ALERT_TYPES).optional(),
  businessUnitId: z.coerce.number().int().positive().optional(),
});

const patchBody = z.object({ status: z.literal("atendida") });

// Alertas que le corresponden al usuario: todas para el dueño; para el resto, las de los giros donde tiene
// uno de los roles a los que apunta la regla. Sin membresías en giros no recibe ninguna.
function audience(access: Access): SQL | undefined {
  if (isOwner(access)) return undefined;
  const scoped = access.memberships.flatMap((m) =>
    m.businessUnitId === null
      ? []
      : [and(eq(alerts.businessUnitId, m.businessUnitId), sql`${m.role}::membership_role = any(${alertRules.targetRoles})`)],
  );
  return scoped.length > 0 ? or(...scoped) : sql`false`;
}

const columns = {
  id: alerts.id,
  type: alertRules.type,
  severity: alerts.severity,
  status: alerts.status,
  businessUnitId: alerts.businessUnitId,
  businessUnitName: businessUnits.name,
  payload: alerts.payload,
  createdAt: alerts.createdAt,
  attendedAt: alerts.attendedAt,
  attendedByName: users.name,
  resolvedAt: alerts.resolvedAt,
};

const base = () =>
  db
    .select(columns)
    .from(alerts)
    .innerJoin(alertRules, eq(alertRules.id, alerts.ruleId))
    .innerJoin(businessUnits, eq(businessUnits.id, alerts.businessUnitId))
    .leftJoin(users, eq(users.id, alerts.attendedByUserId));

// "Resuelta automáticamente": cesó la condición y nadie la marcó.
const present = <T extends { attendedByName: string | null; status: string }>(row: T) => ({
  ...row,
  autoResolved: row.status === "atendida" && row.attendedByName === null,
});

export const alertRoutes = new Hono<AppEnv>()
  .use("*", requireAuth, loadAccess)

  .get("/", validate("query", listQuery), async (c) => {
    const access = c.get("access");
    const q = c.req.valid("query");
    const visible = audience(access);
    const where = and(
      visible,
      eq(alerts.status, q.status),
      q.severity ? eq(alerts.severity, q.severity) : undefined,
      q.type ? eq(alertRules.type, q.type) : undefined,
      q.businessUnitId ? eq(alerts.businessUnitId, q.businessUnitId) : undefined,
    );

    const [{ total }] = await db
      .select({ total: count() })
      .from(alerts)
      .innerJoin(alertRules, eq(alertRules.id, alerts.ruleId))
      .where(where);

    // Abiertas por severidad, para insignias e indicadores; respeta el filtro de giro pero no los demás.
    const openRows = await db
      .select({ severity: alerts.severity, total: count() })
      .from(alerts)
      .innerJoin(alertRules, eq(alertRules.id, alerts.ruleId))
      .where(and(visible, eq(alerts.status, "abierta"), q.businessUnitId ? eq(alerts.businessUnitId, q.businessUnitId) : undefined))
      .groupBy(alerts.severity);
    const open = { info: 0, aviso: 0, critica: 0, total: 0 };
    for (const r of openRows) {
      open[r.severity] = r.total;
      open.total += r.total;
    }

    // Las abiertas, las más graves primero; las atendidas, las más recientes.
    const severityRank = sql`case ${alerts.severity} when 'critica' then 0 when 'aviso' then 1 else 2 end`;
    const order = q.status === "abierta" ? [severityRank, desc(alerts.createdAt)] : [desc(alerts.attendedAt)];
    const items = await base()
      .where(where)
      .orderBy(...order, desc(alerts.id))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize);

    return c.json({ items: items.map(present), page: q.page, pageSize: q.pageSize, total, open });
  })

  // Marca la alerta como atendida. Solo quien la recibe; para el resto, la alerta no existe.
  .patch("/:id", validate("param", idParam), validate("json", patchBody), async (c) => {
    const access = c.get("access");
    const { id } = c.req.valid("param");
    const [row] = await base().where(and(eq(alerts.id, id), audience(access)));
    if (!row) throw new AppError(404, "ALERT_NOT_FOUND", "Alerta no encontrada");
    if (row.status === "atendida") return c.json(present(row));

    await db
      .update(alerts)
      .set({ status: "atendida", attendedAt: new Date(), attendedByUserId: access.userId })
      .where(and(eq(alerts.id, id), eq(alerts.status, "abierta")));
    const [updated] = await base().where(eq(alerts.id, id));
    return c.json(present(updated));
  })

  // Dispara un barrido de reglas sin esperar al programado. Solo el dueño.
  .post("/evaluate", async (c) => {
    if (!isOwner(c.get("access"))) throw new AppError(403, "FORBIDDEN", "Solo el dueño puede forzar la evaluación de reglas");
    return c.json({ result: await evaluateAlerts() });
  });

// Reglas vigentes, solo lectura (la edición queda diseñada: docs/05, sección 5).
export const alertRuleRoutes = new Hono<AppEnv>()
  .use("*", requireAuth, loadAccess)
  .get("/", async (c) => {
    const access = c.get("access");
    const canRead = isOwner(access) || access.memberships.some((m) => m.role === "gerente");
    if (!canRead) throw new AppError(403, "FORBIDDEN", "Su rol no permite consultar las reglas de alertas");
    const items = await db.select().from(alertRules).orderBy(alertRules.id);
    return c.json({ items });
  });