import type { Membership, OrderStatus, OrderSummary, Role } from "./types";

const TZ = "America/Guatemala";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  borrador: "Borrador",
  solicitado: "Solicitado",
  aprobado: "Aprobado",
  en_proceso: "En proceso",
  despachado: "Despachado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export const ROLE_LABEL: Record<Role, string> = {
  dueno: "Dueño",
  gerente: "Gerente",
  vendedor: "Vendedor",
  operativo: "Operativo",
  administrativo: "Administrativo",
};

/** Texto del botón que lleva un pedido al estado indicado. */
export const TRANSITION_LABEL: Record<OrderStatus, string> = {
  borrador: "Volver a borrador",
  solicitado: "Solicitar",
  aprobado: "Aprobar",
  en_proceso: "Iniciar proceso",
  despachado: "Marcar como despachado",
  entregado: "Confirmar recepción",
  cancelado: "Cancelar pedido",
};

const UNIT_SYMBOL: Record<string, string> = { tonelada: "t", m2: "m²", hora: "h", viaje: "viaje" };

export const unitSymbol = (unit: string) => UNIT_SYMBOL[unit] ?? unit;

export function formatQty(quantity: number, unit: string) {
  return `${quantity.toLocaleString("es-GT")} ${unitSymbol(unit)}`;
}

/** "2026-11-05" -> "05/11/2026", sin pasar por Date para evitar corrimientos de zona horaria. */
export function formatDate(day: string) {
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-GT", { timeZone: TZ, dateStyle: "short", timeStyle: "short" });
}

/** Fecha de hoy en Guatemala (UTC-6) con formato AAAA-MM-DD. */
export function todayGT() {
  return new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Un pedido está retrasado si su fecha requerida ya pasó y todavía está pendiente del proveedor (igual que en el panel de la API). */
export function isOverdue(order: Pick<OrderSummary, "dueDate" | "status">) {
  return order.dueDate < todayGT() && ["solicitado", "aprobado", "en_proceso"].includes(order.status);
}

export function describeMembership(m: Membership) {
  return `${ROLE_LABEL[m.role]} · ${m.businessUnitName ?? "toda la organización"}`;
}

/** Giros en los que el usuario puede crear pedidos internos (operativo o gerente). */
export function requestingUnits(memberships: Membership[]) {
  const units = new Map<number, string>();
  for (const m of memberships) {
    if (m.businessUnitId !== null && (m.role === "operativo" || m.role === "gerente")) {
      units.set(m.businessUnitId, m.businessUnitName ?? `Giro ${m.businessUnitId}`);
    }
  }
  return [...units].map(([id, name]) => ({ id, name }));
}

export const MEETING_STATUS_LABEL = {
  solicitada: "Solicitada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  cancelada: "Cancelada",
} as const;

/** Fecha de hoy en Guatemala desplazada `days` días, con formato AAAA-MM-DD. */
export function dayGT(days: number) {
  return new Date(Date.now() - 6 * 3600 * 1000 + days * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Roles que atienden reuniones: vendedores, gerentes y el dueño. */
export function handlesMeetings(memberships: Membership[]) {
  return memberships.some((m) => m.role === "vendedor" || m.role === "gerente" || m.role === "dueno");
}

/** Giros cuyo panel puede ver la persona por su membresía (gerente u operativo). El dueño ve todos. */
export function panelUnits(memberships: Membership[]) {
  const units = new Map<number, string>();
  for (const m of memberships) {
    if (m.businessUnitId !== null && (m.role === "gerente" || m.role === "operativo")) {
      units.set(m.businessUnitId, m.businessUnitName ?? `Giro ${m.businessUnitId}`);
    }
  }
  return [...units].map(([id, name]) => ({ id, name }));
}

export const isOwnerOf = (memberships: Membership[]) => memberships.some((m) => m.role === "dueno" && m.businessUnitId === null);

export const hasPanel = (memberships: Membership[]) => isOwnerOf(memberships) || panelUnits(memberships).length > 0;

export const ALERT_TYPE_LABEL = {
  pedido_retrasado: "Pedido retrasado",
  stock_bajo: "Stock bajo",
  exceso_velocidad: "Exceso de velocidad",
} as const;

export const SEVERITY_LABEL = { info: "Informativa", aviso: "Aviso", critica: "Crítica" } as const;

/** Quienes reciben alertas hoy: el dueño y los gerentes u operativos de un giro (las reglas apuntan a esos roles). */
export const receivesAlerts = (memberships: Membership[]) => isOwnerOf(memberships) || panelUnits(memberships).length > 0;

export const SITUATION_LABEL = { normal: "Normal", vigilar: "Vigilar", atencion: "Atención" } as const;

/** Frase corta que resume una alerta, para listas donde no cabe el detalle. */
export function alertSummary(a: { type: keyof typeof ALERT_TYPE_LABEL; payload: Record<string, any> }) {
  const p = a.payload;
  if (a.type === "pedido_retrasado") return `Pedido #${p.orderId}: ${p.daysLate} ${p.daysLate === 1 ? "día" : "días"} de retraso`;
  if (a.type === "stock_bajo") return `${p.productName} en ${p.siteName}: ${formatQty(p.quantity, p.unit)} (mínimo ${formatQty(p.minThreshold, p.unit)})`;
  return `${p.assetName}: ${p.speedKmh} km/h (límite ${p.maxSpeedKmh})`;
}

export const ASSET_STATUS_LABEL = {
  en_ruta: "En ruta",
  activa: "Activa",
  detenido: "Detenido",
  exceso: "Exceso de velocidad",
  sin_senal: "Sin señal",
} as const;

/** Antigüedad legible de un instante ISO ("hace 3 min"). */
export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "hace segundos";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}
