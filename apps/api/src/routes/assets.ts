import { and, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { DEFAULT_RULES } from "../alerts/rules";
import { isOwner, loadAccess, memberUnitIds, requireAuth, rolesIn } from "../auth";
import { db, schema } from "../db";
import { AppError, validate } from "../errors";
import { ASSET_STATUSES, assetStatus } from "../fleet/rules";
import type { Access, AppEnv, Role } from "../types";

const { assets, gpsEvents, businessUnits, alertRules } = schema;

/** Roles que consultan la flota de un giro (además del dueño). */
const FLEET_ROLES: readonly Role[] = ["gerente", "operativo"];

const idParam = z.object({ id: z.coerce.number().int().positive() });
const listQuery = z.object({
  kind: z.enum(["camion", "maquinaria"]).optional(),
  status: z.enum(ASSET_STATUSES).optional(),
  businessUnitId: z.coerce.number().int().positive().optional(),
});
const eventsQuery = z.object({ limit: z.coerce.number().int().min(1).max(200).default(60) });

// El límite de velocidad y la antigüedad de una lectura son los parámetros de la regla de alertas, para que la pantalla
// y las alertas coincidan siempre.
async function speedParams() {
  const [rule] = await db.select({ params: alertRules.params }).from(alertRules).where(eq(alertRules.type, "exceso_velocidad"));
  const p = { ...DEFAULT_RULES.exceso_velocidad.params, ...(rule?.params ?? {}) };
  return { maxSpeedKmh: p.maxSpeedKmh, staleMinutes: p.staleMinutes };
}

function visibleUnits(access: Access): number[] | "all" {
  if (isOwner(access)) return "all";
  return memberUnitIds(access).filter((u) => rolesIn(access, u).some((r) => FLEET_ROLES.includes(r)));
}

export const assetRoutes = new Hono<AppEnv>()
  .use("*", requireAuth, loadAccess)

  // Activos con su última lectura y estado.
  .get("/", validate("query", listQuery), async (c) => {
    const units = visibleUnits(c.get("access"));
    if (units !== "all" && units.length === 0) throw new AppError(403, "FORBIDDEN", "Su rol no permite consultar la flota");
    const q = c.req.valid("query");

    const rows = await db
      .select({
        id: assets.id,
        name: assets.name,
        kind: assets.kind,
        gpsExternalId: assets.gpsExternalId,
        businessUnitId: assets.businessUnitId,
        businessUnitName: businessUnits.name,
      })
      .from(assets)
      .innerJoin(businessUnits, eq(businessUnits.id, assets.businessUnitId))
      .where(
        and(
          units === "all" ? undefined : inArray(assets.businessUnitId, units),
          q.kind ? eq(assets.kind, q.kind) : undefined,
          q.businessUnitId ? eq(assets.businessUnitId, q.businessUnitId) : undefined,
        ),
      )
      .orderBy(assets.businessUnitId, assets.name);

    const latest = rows.length
      ? await db
          .selectDistinctOn([gpsEvents.assetId], {
            assetId: gpsEvents.assetId,
            recordedAt: gpsEvents.recordedAt,
            lat: gpsEvents.lat,
            lng: gpsEvents.lng,
            speedKmh: gpsEvents.speedKmh,
          })
          .from(gpsEvents)
          .where(inArray(gpsEvents.assetId, rows.map((r) => r.id)))
          .orderBy(gpsEvents.assetId, desc(gpsEvents.recordedAt))
      : [];

    const params = await speedParams();
    const now = new Date();
    const items = rows
      .map((a) => {
        const { assetId: _assetId, ...last } = latest.find((e) => e.assetId === a.id) ?? ({} as never);
        const lastReading = "recordedAt" in last ? last : null;
        return { ...a, lastReading, status: assetStatus(a.kind, lastReading, params, now) };
      })
      .filter((a) => !q.status || a.status === q.status);
    return c.json({ items, maxSpeedKmh: params.maxSpeedKmh, staleMinutes: params.staleMinutes });
  })

  // Historial reciente de un activo, de la lectura más nueva a la más antigua.
  .get("/:id/events", validate("param", idParam), validate("query", eventsQuery), async (c) => {
    const units = visibleUnits(c.get("access"));
    const { id } = c.req.valid("param");
    const { limit } = c.req.valid("query");
    const [asset] = await db.select({ id: assets.id, businessUnitId: assets.businessUnitId, name: assets.name }).from(assets).where(eq(assets.id, id));
    // Para quien no tiene acceso a la flota de ese giro, el activo no existe.
    if (!asset || (units !== "all" && !units.includes(asset.businessUnitId))) {
      throw new AppError(404, "ASSET_NOT_FOUND", "Activo no encontrado");
    }
    const items = await db
      .select({ id: gpsEvents.id, recordedAt: gpsEvents.recordedAt, lat: gpsEvents.lat, lng: gpsEvents.lng, speedKmh: gpsEvents.speedKmh })
      .from(gpsEvents)
      .where(eq(gpsEvents.assetId, id))
      .orderBy(desc(gpsEvents.recordedAt), desc(gpsEvents.id))
      .limit(limit);
    return c.json({ asset, items, maxSpeedKmh: (await speedParams()).maxSpeedKmh });
  });
