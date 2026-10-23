import { createHash, timingSafeEqual } from "node:crypto";
import { inArray } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { evaluateAlerts } from "../alerts/engine";
import { db, schema } from "../db";
import { AppError, validate } from "../errors";
import type { AppEnv } from "../types";

const { assets, gpsEvents } = schema;

const MAX_EVENTS = 500;
const MAX_FUTURE_MS = 5 * 60_000;

const event = z.object({
  deviceId: z.string().min(1).max(100),
  recordedAt: z.string().datetime({ offset: true, message: "Use fecha y hora ISO 8601 con zona horaria" }),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speedKmh: z.number().min(0).max(400),
});
const body = z.object({ events: z.array(event).min(1).max(MAX_EVENTS) });

const digest = (s: string) => createHash("sha256").update(s).digest();

// Ingesta del servicio GPS (contrato en docs/05-datos-y-apis.md, sección 6). Se autentica con un token de servicio,
// no con un usuario: quien llama es el proveedor o su simulador.
export const gpsRoutes = new Hono<AppEnv>().post("/ingest", validate("json", body), async (c) => {
  const expected = process.env.GPS_SERVICE_TOKEN;
  if (!expected) throw new AppError(503, "GPS_DISABLED", "La ingesta de GPS no está configurada");
  const given = c.req.header("x-service-token") ?? "";
  if (!timingSafeEqual(digest(given), digest(expected))) {
    throw new AppError(401, "UNAUTHORIZED", "Token de servicio ausente o inválido");
  }

  const { events } = c.req.valid("json");
  const known = await db
    .select({ id: assets.id, gpsExternalId: assets.gpsExternalId })
    .from(assets)
    .where(inArray(assets.gpsExternalId, [...new Set(events.map((e) => e.deviceId))]));
  const assetOf = new Map(known.map((a) => [a.gpsExternalId, a.id]));

  const limit = Date.now() + MAX_FUTURE_MS;
  const accepted: (typeof gpsEvents.$inferInsert)[] = [];
  const rejected: { deviceId: string; reason: string }[] = [];
  for (const e of events) {
    const assetId = assetOf.get(e.deviceId);
    if (assetId === undefined) rejected.push({ deviceId: e.deviceId, reason: "Dispositivo desconocido" });
    else if (new Date(e.recordedAt).getTime() > limit) rejected.push({ deviceId: e.deviceId, reason: "Fecha en el futuro" });
    else accepted.push({ assetId, recordedAt: new Date(e.recordedAt), lat: e.lat, lng: e.lng, speedKmh: e.speedKmh });
  }

  if (accepted.length > 0) {
    await db.insert(gpsEvents).values(accepted);
    // Una lectura nueva puede abrir o cerrar un exceso de velocidad: se evalúa de inmediato.
    await evaluateAlerts();
  }
  return c.json({ accepted: accepted.length, rejected }, accepted.length > 0 ? 201 : 422);
});