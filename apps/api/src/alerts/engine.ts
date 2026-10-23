import { and, eq, inArray, like, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { todayGT } from "../dates";
import { db, schema } from "../db";
import { ATTENTION_STATUSES } from "../orders/rules";
import { ALERT_TYPES, type AlertType, DEFAULT_RULES, type Severity, daysLate, isSpeeding, overdueSeverity, stockSeverity } from "./rules";

const { alerts, alertRules, orders, orderItems, products, sites, inventoryItems, businessUnits, assets, gpsEvents, apiClients } = schema;
const requester = alias(businessUnits, "requester");

/** Condición vigente detectada en este barrido. `key` la identifica entre barridos. */
type Condition = { key: string; businessUnitId: number; severity: Severity; payload: Record<string, unknown> };
type Rule = typeof alertRules.$inferSelect;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Crea las reglas que falten con sus valores iniciales. Los cambios hechos a una regla existente se respetan. */
export async function ensureRules() {
  await db
    .insert(alertRules)
    .values(ALERT_TYPES.map((type) => ({ type, ...DEFAULT_RULES[type] })))
    .onConflictDoNothing({ target: alertRules.type });
}

async function overdueOrders(rule: Rule): Promise<Condition[]> {
  const today = todayGT();
  const criticalAfter = rule.params.criticalAfterDays ?? 3;
  const rows = await db
    .select({
      id: orders.id,
      status: orders.status,
      dueDate: orders.dueDate,
      supplierUnitId: orders.supplierUnitId,
      requestingUnitName: sql<string | null>`coalesce(${requester.name}, ${apiClients.name})`,
    })
    .from(orders)
    .leftJoin(requester, eq(requester.id, orders.requestingUnitId))
    .leftJoin(apiClients, eq(apiClients.id, orders.apiClientId))
    .where(and(inArray(orders.status, [...ATTENTION_STATUSES]), lt(orders.dueDate, today)));
  if (rows.length === 0) return [];

  const lines = await db
    .select({ orderId: orderItems.orderId, productName: products.name, unit: products.unit, quantity: orderItems.quantity })
    .from(orderItems)
    .innerJoin(products, eq(products.id, orderItems.productId))
    .where(inArray(orderItems.orderId, rows.map((r) => r.id)));

  return rows.map((o) => {
    const late = daysLate(o.dueDate, today);
    return {
      key: `pedido_retrasado:${o.id}`,
      businessUnitId: o.supplierUnitId,
      severity: overdueSeverity(late, criticalAfter),
      payload: {
        orderId: o.id,
        status: o.status,
        dueDate: o.dueDate,
        daysLate: late,
        requestingUnitName: o.requestingUnitName,
        items: lines.filter((l) => l.orderId === o.id).map(({ orderId: _orderId, ...item }) => item),
      },
    };
  });
}

async function lowStock(): Promise<Condition[]> {
  const rows = await db
    .select({
      siteId: sites.id,
      siteName: sites.name,
      businessUnitId: sites.businessUnitId,
      productId: products.id,
      productName: products.name,
      unit: products.unit,
      quantity: inventoryItems.quantity,
      minThreshold: inventoryItems.minThreshold,
    })
    .from(inventoryItems)
    .innerJoin(sites, eq(sites.id, inventoryItems.siteId))
    .innerJoin(products, eq(products.id, inventoryItems.productId))
    .where(lt(inventoryItems.quantity, inventoryItems.minThreshold));
  return rows.map(({ businessUnitId, ...detail }) => ({
    key: `stock_bajo:${detail.siteId}:${detail.productId}`,
    businessUnitId,
    severity: stockSeverity(detail.quantity),
    payload: detail,
  }));
}

// Se evalúa la última lectura de cada activo: el exceso dura mientras la lectura más reciente siga por encima del límite.
async function speeding(rule: Rule): Promise<Condition[]> {
  const max = rule.params.maxSpeedKmh ?? 80;
  const stale = rule.params.staleMinutes ?? 15;
  const latest = await db
    .selectDistinctOn([gpsEvents.assetId], {
      assetId: gpsEvents.assetId,
      recordedAt: gpsEvents.recordedAt,
      lat: gpsEvents.lat,
      lng: gpsEvents.lng,
      speedKmh: gpsEvents.speedKmh,
    })
    .from(gpsEvents)
    .orderBy(gpsEvents.assetId, sql`${gpsEvents.recordedAt} desc`);

  const now = new Date();
  const hot = latest.filter((e) => isSpeeding(e.speedKmh, e.recordedAt, { maxSpeedKmh: max, staleMinutes: stale }, now));
  if (hot.length === 0) return [];

  const info = await db
    .select({ id: assets.id, name: assets.name, kind: assets.kind, businessUnitId: assets.businessUnitId })
    .from(assets)
    .where(inArray(assets.id, hot.map((e) => e.assetId)));
  return hot.flatMap((e) => {
    const asset = info.find((a) => a.id === e.assetId);
    if (!asset) return [];
    return [
      {
        key: `exceso_velocidad:${e.assetId}`,
        businessUnitId: asset.businessUnitId,
        severity: "critica" as const,
        payload: {
          assetId: asset.id,
          assetName: asset.name,
          kind: asset.kind,
          speedKmh: e.speedKmh,
          maxSpeedKmh: max,
          recordedAt: e.recordedAt.toISOString(),
          lat: e.lat,
          lng: e.lng,
        },
      },
    ];
  });
}

const collectors: Record<AlertType, (rule: Rule) => Promise<Condition[]>> = {
  pedido_retrasado: overdueOrders,
  stock_bajo: () => lowStock(),
  exceso_velocidad: speeding,
};

// Compara las condiciones vigentes con las alertas activas de la regla: crea las nuevas y cierra las que ya no aplican.
async function sync(tx: Tx, rule: Rule, conditions: Condition[]) {
  const active = await tx
    .select({ id: alerts.id, dedupeKey: alerts.dedupeKey })
    .from(alerts)
    .where(and(eq(alerts.ruleId, rule.id), sql`${alerts.resolvedAt} is null`, like(alerts.dedupeKey, `${rule.type}:%`)));
  const activeKeys = new Set(active.map((a) => a.dedupeKey));
  const currentKeys = new Set(conditions.map((c) => c.key));

  const fresh = conditions.filter((c) => !activeKeys.has(c.key));
  if (fresh.length > 0) {
    await tx
      .insert(alerts)
      .values(fresh.map((c) => ({ ruleId: rule.id, businessUnitId: c.businessUnitId, severity: c.severity, dedupeKey: c.key, payload: c.payload })))
      .onConflictDoNothing();
  }

  const gone = active.filter((a) => !currentKeys.has(a.dedupeKey));
  if (gone.length > 0) {
    // Una alerta que nadie atendió y cuya condición cesó pasa a "atendida" sin responsable (resolución automática).
    await tx
      .update(alerts)
      .set({ resolvedAt: new Date(), status: "atendida", attendedAt: sql`coalesce(${alerts.attendedAt}, now())` })
      .where(inArray(alerts.id, gone.map((a) => a.id)));
  }

  // Las que siguen vigentes se refrescan: la velocidad o los días de retraso cambian entre barridos.
  for (const c of conditions.filter((c) => activeKeys.has(c.key))) {
    await tx
      .update(alerts)
      .set({ payload: c.payload, severity: c.severity })
      .where(and(eq(alerts.dedupeKey, c.key), sql`${alerts.resolvedAt} is null`));
  }

  return { created: fresh.length, resolved: gone.length };
}

export type EvaluationResult = Record<AlertType, { created: number; resolved: number }>;

// Los barridos se encadenan: cada llamada evalúa el estado actual (no reutiliza uno que empezó antes del cambio).
let chain: Promise<unknown> = Promise.resolve();

/** Evalúa todas las reglas activas. Los barridos no se solapan. */
export function evaluateAlerts(): Promise<EvaluationResult> {
  const next = chain.then(run, run);
  chain = next.catch(() => {});
  return next;
}

async function run(): Promise<EvaluationResult> {
  await ensureRules();
  const rules = await db.select().from(alertRules);
  const result = {} as EvaluationResult;
  for (const rule of rules) {
    // Una regla desactivada no produce condiciones, de modo que sus alertas vigentes se cierran.
    const conditions = rule.active ? await collectors[rule.type](rule) : [];
    result[rule.type] = await db.transaction((tx) => sync(tx, rule, conditions));
  }
  return result;
}

/** Barrido periódico dentro del proceso de la API (en producción pasaría a una función por evento, ADR-006). */
export function startAlertScheduler(intervalSeconds: number) {
  if (intervalSeconds <= 0) return;
  const tick = () => evaluateAlerts().catch((err) => console.error("Falló el barrido de alertas:", err));
  void tick();
  setInterval(tick, intervalSeconds * 1000).unref();
}