import { and, asc, count, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { alias } from "drizzle-orm/pg-core";
import { Hono } from "hono";
import { z } from "zod";
import { isOwner, loadAccess, requireAuth, rolesIn } from "../auth";
import { dateString, todayGT } from "../dates";
import { db, schema } from "../db";
import { AppError, validate } from "../errors";
import { ATTENTION_STATUSES, OPEN_STATUSES, ORDER_STATUSES, type OrderStatus } from "../orders/rules";
import { monthBounds, situation, startOfDayGT, startOfNextDayGT } from "../reports/rules";
import type { AppEnv, Role } from "../types";

const { orders, orderItems, products, sites, inventoryItems, businessUnits, meetings, alerts, alertRules, assets, gpsEvents, orderStatusEvents, apiClients } = schema;
const requester = alias(businessUnits, "requester");

const overviewQuery = z
  .object({ from: dateString.optional(), to: dateString.optional() })
  .refine((q) => (q.from === undefined) === (q.to === undefined), "Indique ambas fechas (from y to) o ninguna")
  .refine((q) => !q.from || !q.to || q.from <= q.to, "from no puede ser posterior a to")
  .refine((q) => !q.from || !q.to || Date.parse(q.to) - Date.parse(q.from) <= 366 * 86_400_000, "El período no puede superar un año");

const idParam = z.object({ id: z.coerce.number().int().positive() });

/** Roles que consultan el panel de un giro (además del dueño). */
const PANEL_ROLES: readonly Role[] = ["gerente", "operativo"];

const sum = (byStatus: Record<OrderStatus, number>, statuses: readonly OrderStatus[]) =>
  statuses.reduce((total, s) => total + byStatus[s], 0);

// Pedidos del giro en un lado (proveedor o solicitante): total por estado y cuántos están retrasados.
async function sideSummary(column: PgColumn, unitId: number, today: string) {
  const rows = await db
    .select({
      status: orders.status,
      total: count(),
      overdue: sql<number>`count(*) filter (where ${orders.dueDate} < ${today} and ${inArray(orders.status, [...ATTENTION_STATUSES])})`.mapWith(Number),
    })
    .from(orders)
    .where(eq(column, unitId))
    .groupBy(orders.status);

  const byStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
  for (const r of rows) byStatus[r.status] = r.total;
  return { byStatus, open: sum(byStatus, OPEN_STATUSES), overdue: rows.reduce((t, r) => t + r.overdue, 0) };
}

export const reportRoutes = new Hono<AppEnv>()
  .use("*", requireAuth, loadAccess)

  // Indicadores consolidados de los seis giros para el dueño (P06). Los pedidos entregados se cuentan en el período
  // (por la fecha de la confirmación de recepción); el resto de las cifras describen el estado actual.
  .get("/overview", validate("query", overviewQuery), async (c) => {
    if (!isOwner(c.get("access"))) throw new AppError(403, "FORBIDDEN", "Solo el dueño consulta el panel consolidado");
    const q = c.req.valid("query");
    const period = q.from && q.to ? { from: q.from, to: q.to } : monthBounds(todayGT());
    const today = todayGT();

    const units = await db.select({ id: businessUnits.id, code: businessUnits.code, name: businessUnits.name, type: businessUnits.type }).from(businessUnits).orderBy(asc(businessUnits.id));

    const overdueExpr = sql<number>`count(*) filter (where ${orders.dueDate} < ${today} and ${inArray(orders.status, [...ATTENTION_STATUSES])})`.mapWith(Number);
    const openExpr = sql<number>`count(*) filter (where ${inArray(orders.status, [...OPEN_STATUSES])})`.mapWith(Number);
    const supplierRows = await db.select({ unitId: orders.supplierUnitId, open: openExpr, overdue: overdueExpr }).from(orders).groupBy(orders.supplierUnitId);
    const requesterRows = await db
      .select({ unitId: orders.requestingUnitId, open: openExpr })
      .from(orders)
      .where(sql`${orders.requestingUnitId} is not null`)
      .groupBy(orders.requestingUnitId);
    const [orderTotals] = await db.select({ open: openExpr, overdue: overdueExpr }).from(orders);

    const deliveredRows = await db
      .select({ unitId: orders.supplierUnitId, total: count() })
      .from(orderStatusEvents)
      .innerJoin(orders, eq(orders.id, orderStatusEvents.orderId))
      .where(
        and(
          eq(orderStatusEvents.toStatus, "entregado"),
          gte(orderStatusEvents.createdAt, startOfDayGT(period.from)),
          lt(orderStatusEvents.createdAt, startOfNextDayGT(period.to)),
        ),
      )
      .groupBy(orders.supplierUnitId);

    const alertRows = await db
      .select({ unitId: alerts.businessUnitId, severity: alerts.severity, total: count() })
      .from(alerts)
      .where(eq(alerts.status, "abierta"))
      .groupBy(alerts.businessUnitId, alerts.severity);

    // Flota: "en ruta" = la última lectura es reciente y marca movimiento.
    const latest = await db
      .selectDistinctOn([gpsEvents.assetId], { assetId: gpsEvents.assetId, recordedAt: gpsEvents.recordedAt, speedKmh: gpsEvents.speedKmh })
      .from(gpsEvents)
      .orderBy(gpsEvents.assetId, desc(gpsEvents.recordedAt));
    const fleet = await db.select({ id: assets.id, unitId: assets.businessUnitId }).from(assets);
    const now = Date.now();
    const moving = new Set(latest.filter((e) => now - e.recordedAt.getTime() <= 15 * 60_000 && e.speedKmh > 0).map((e) => e.assetId));

    const rows = units.map((u) => {
      const sup = supplierRows.find((r) => r.unitId === u.id);
      const req = requesterRows.find((r) => r.unitId === u.id);
      const mine = alertRows.filter((r) => r.unitId === u.id);
      const alertCount = (sev: string) => mine.find((r) => r.severity === sev)?.total ?? 0;
      const openAlerts = mine.reduce((t, r) => t + r.total, 0);
      const criticalAlerts = alertCount("critica");
      const overdue = sup?.overdue ?? 0;
      const unitAssets = fleet.filter((a) => a.unitId === u.id);
      return {
        ...u,
        openAsSupplier: sup?.open ?? 0,
        openAsRequester: req?.open ?? 0,
        overdue,
        deliveredInPeriod: deliveredRows.find((r) => r.unitId === u.id)?.total ?? 0,
        openAlerts,
        criticalAlerts,
        assets: unitAssets.length,
        assetsMoving: unitAssets.filter((a) => moving.has(a.id)).length,
        situation: situation({ overdue, criticalAlerts, openAlerts }),
      };
    });

    // Alertas críticas abiertas, las más recientes primero.
    const critical = await db
      .select({
        id: alerts.id,
        type: alertRules.type,
        businessUnitId: alerts.businessUnitId,
        businessUnitName: businessUnits.name,
        payload: alerts.payload,
        createdAt: alerts.createdAt,
      })
      .from(alerts)
      .innerJoin(alertRules, eq(alertRules.id, alerts.ruleId))
      .innerJoin(businessUnits, eq(businessUnits.id, alerts.businessUnitId))
      .where(and(eq(alerts.status, "abierta"), eq(alerts.severity, "critica")))
      .orderBy(desc(alerts.createdAt), desc(alerts.id))
      .limit(5);

    return c.json({
      period,
      totals: {
        openOrders: orderTotals.open,
        overdueOrders: orderTotals.overdue,
        openAlerts: rows.reduce((t, r) => t + r.openAlerts, 0),
        criticalAlerts: rows.reduce((t, r) => t + r.criticalAlerts, 0),
        deliveredInPeriod: rows.reduce((t, r) => t + r.deliveredInPeriod, 0),
        assetsMoving: rows.reduce((t, r) => t + r.assetsMoving, 0),
        assets: fleet.length,
      },
      units: rows,
      criticalAlerts: critical,
    });
  })

  // Indicadores de un giro para su panel (P02).
  .get("/business-units/:id", validate("param", idParam), async (c) => {
    const access = c.get("access");
    const { id } = c.req.valid("param");
    const owner = isOwner(access);
    const roles = rolesIn(access, id);
    if (!owner && !roles.some((r) => PANEL_ROLES.includes(r))) {
      throw new AppError(403, "FORBIDDEN", "Su rol no permite consultar el panel de este giro");
    }

    const [unit] = await db
      .select({ id: businessUnits.id, name: businessUnits.name, type: businessUnits.type })
      .from(businessUnits)
      .where(eq(businessUnits.id, id));
    if (!unit) throw new AppError(404, "UNIT_NOT_FOUND", "Giro no encontrado");

    const today = todayGT();
    const [asSupplier, asRequester] = await Promise.all([
      sideSummary(orders.supplierUnitId, id, today),
      sideSummary(orders.requestingUnitId, id, today),
    ]);

    // Pedidos que el giro debe atender, los de fecha más próxima (o ya vencida) primero.
    const pending = await db
      .select({
        id: orders.id,
        status: orders.status,
        requestingUnitName: sql<string | null>`coalesce(${requester.name}, ${apiClients.name})`,
        dueDate: orders.dueDate,
      })
      .from(orders)
      .leftJoin(requester, eq(requester.id, orders.requestingUnitId))
      .leftJoin(apiClients, eq(apiClients.id, orders.apiClientId))
      .where(and(eq(orders.supplierUnitId, id), inArray(orders.status, [...ATTENTION_STATUSES])))
      .orderBy(asc(orders.dueDate), asc(orders.id))
      .limit(5);
    const lines = pending.length
      ? await db
          .select({ orderId: orderItems.orderId, productName: products.name, unit: products.unit, quantity: orderItems.quantity })
          .from(orderItems)
          .innerJoin(products, eq(products.id, orderItems.productId))
          .where(inArray(orderItems.orderId, pending.map((o) => o.id)))
          .orderBy(asc(orderItems.id))
      : [];
    const toAttend = pending.map((o) => ({
      ...o,
      overdue: o.dueDate < today,
      items: lines.filter((l) => l.orderId === o.id).map(({ orderId: _orderId, ...item }) => item),
    }));

    // Existencias por debajo del mínimo en las sedes del giro.
    const lowRows = await db
      .select({
        siteName: sites.name,
        productName: products.name,
        unit: products.unit,
        quantity: inventoryItems.quantity,
        minThreshold: inventoryItems.minThreshold,
      })
      .from(inventoryItems)
      .innerJoin(sites, eq(sites.id, inventoryItems.siteId))
      .innerJoin(products, eq(products.id, inventoryItems.productId))
      .where(and(eq(sites.businessUnitId, id), lt(inventoryItems.quantity, inventoryItems.minThreshold)))
      .orderBy(asc(sites.name), asc(products.name));

    // Solicitudes de reunión del giro: solo cantidades, para quien gerencia el giro y el dueño.
    let meetingCounts: { requested: number; confirmed: number } | null = null;
    if (owner || roles.includes("gerente")) {
      const rows = await db
        .select({ status: meetings.status, total: count() })
        .from(meetings)
        .where(and(eq(meetings.businessUnitId, id), inArray(meetings.status, ["solicitada", "confirmada"])))
        .groupBy(meetings.status);
      meetingCounts = {
        requested: rows.find((r) => r.status === "solicitada")?.total ?? 0,
        confirmed: rows.find((r) => r.status === "confirmada")?.total ?? 0,
      };
    }

    return c.json({
      businessUnit: unit,
      asSupplier: { ...asSupplier, toAttend: sum(asSupplier.byStatus, ATTENTION_STATUSES) },
      asRequester,
      toAttend,
      lowStock: { count: lowRows.length, items: lowRows.slice(0, 10) },
      meetings: meetingCounts,
    });
  });
