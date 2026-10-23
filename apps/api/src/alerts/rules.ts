import type { Role } from "../types";

export const ALERT_TYPES = ["pedido_retrasado", "stock_bajo", "exceso_velocidad"] as const;
export type AlertType = (typeof ALERT_TYPES)[number];
export type Severity = "info" | "aviso" | "critica";

/** Reglas iniciales (docs/05-datos-y-apis.md, sección 6). `params` se puede ajustar en la tabla `alert_rules`. */
export const DEFAULT_RULES: Record<AlertType, { params: Record<string, number>; targetRoles: Role[] }> = {
  // Avisa al proveedor, que es quien debe atender el pedido.
  pedido_retrasado: { params: { criticalAfterDays: 3 }, targetRoles: ["gerente", "operativo"] },
  stock_bajo: { params: {}, targetRoles: ["gerente", "operativo"] },
  // Una lectura más vieja que `staleMinutes` ya no cuenta como exceso vigente.
  exceso_velocidad: { params: { maxSpeedKmh: 80, staleMinutes: 15 }, targetRoles: ["gerente", "operativo"] },
};

/** Días de retraso respecto de la fecha comprometida (ambas AAAA-MM-DD); 0 si no está vencido. */
export function daysLate(dueDate: string, today: string): number {
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86_400_000));
}

export function overdueSeverity(late: number, criticalAfterDays: number): Severity {
  return late >= criticalAfterDays ? "critica" : "aviso";
}

/** Sin existencias es crítico; por debajo del mínimo, un aviso. */
export function stockSeverity(quantity: number): Severity {
  return quantity <= 0 ? "critica" : "aviso";
}

/** Exceso vigente: la velocidad supera el límite y la lectura es reciente. */
export function isSpeeding(speedKmh: number, recordedAt: Date, params: { maxSpeedKmh: number; staleMinutes: number }, now: Date) {
  const ageMinutes = (now.getTime() - recordedAt.getTime()) / 60_000;
  return speedKmh > params.maxSpeedKmh && ageMinutes <= params.staleMinutes;
}

/** ¿Recibe la alerta quien tiene estas membresías? El dueño recibe todas; el resto, según rol y giro afectado. */
export function isRecipient(
  memberships: { businessUnitId: number | null; role: Role }[],
  alert: { businessUnitId: number },
  targetRoles: readonly Role[],
) {
  return memberships.some(
    (m) =>
      (m.role === "dueno" && m.businessUnitId === null) ||
      (m.businessUnitId === alert.businessUnitId && targetRoles.includes(m.role)),
  );
}
