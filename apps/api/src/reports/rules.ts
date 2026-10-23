export type Situation = "normal" | "vigilar" | "atencion";

/** Situación de un giro para el panel del dueño, según sus retrasos y alertas abiertas. */
export function situation(u: { overdue: number; criticalAlerts: number; openAlerts: number }): Situation {
  if (u.criticalAlerts > 0 || u.overdue >= 2) return "atencion";
  if (u.overdue > 0 || u.openAlerts > 0) return "vigilar";
  return "normal";
}

/** Primer y último día (AAAA-MM-DD) del mes de una fecha AAAA-MM-DD. */
export function monthBounds(day: string): { from: string; to: string } {
  const [y, m] = day.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

/** Instante UTC en que empieza un día de Guatemala (UTC-6, sin horario de verano). */
export const startOfDayGT = (day: string) => new Date(`${day}T06:00:00Z`);

/** Instante UTC en que empieza el día siguiente al indicado, hora de Guatemala. */
export const startOfNextDayGT = (day: string) => new Date(startOfDayGT(day).getTime() + 24 * 3600 * 1000);
