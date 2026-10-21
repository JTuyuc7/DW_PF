import type { Role } from "../types";

export const ORDER_STATUSES = [
  "borrador",
  "solicitado",
  "aprobado",
  "en_proceso",
  "despachado",
  "entregado",
  "cancelado",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Lado del pedido desde el que actúa el usuario: el giro que provee o el que solicita. */
type Side = "supplier" | "requester";
type Grant = { side: Side; roles: readonly Role[] };

const STAFF: readonly Role[] = ["operativo", "gerente"];
const MANAGER: readonly Role[] = ["gerente"];

const cancel: Grant[] = [
  { side: "supplier", roles: MANAGER },
  { side: "requester", roles: MANAGER },
];

// Máquina de estados de docs/05-datos-y-apis.md, sección 5.6, con quién puede ejecutar cada paso.
export const TRANSITIONS: Record<OrderStatus, Partial<Record<OrderStatus, Grant[]>>> = {
  borrador: { solicitado: [{ side: "requester", roles: STAFF }] },
  solicitado: { aprobado: [{ side: "supplier", roles: MANAGER }], cancelado: cancel },
  aprobado: { en_proceso: [{ side: "supplier", roles: STAFF }], cancelado: cancel },
  en_proceso: { despachado: [{ side: "supplier", roles: STAFF }], cancelado: cancel },
  despachado: { entregado: [{ side: "requester", roles: STAFF }] },
  entregado: {},
  cancelado: {},
};

/** Roles del usuario en cada lado de un pedido. */
export type OrderRoles = Record<Side, readonly Role[]>;

export type TransitionCheck = "ok" | "invalid" | "forbidden";

export function checkTransition(from: OrderStatus, to: OrderStatus, roles: OrderRoles): TransitionCheck {
  const grants = TRANSITIONS[from][to];
  if (!grants) return "invalid";
  return grants.some((g) => roles[g.side].some((r) => g.roles.includes(r))) ? "ok" : "forbidden";
}

/** Estados a los que el usuario puede llevar el pedido ahora mismo. */
export function allowedTransitions(from: OrderStatus, roles: OrderRoles): OrderStatus[] {
  return (Object.keys(TRANSITIONS[from]) as OrderStatus[]).filter((to) => checkTransition(from, to, roles) === "ok");
}

/** Estados en los que el giro proveedor tiene algo pendiente por hacer. También son los que pueden estar retrasados. */
export const ATTENTION_STATUSES = ["solicitado", "aprobado", "en_proceso"] as const satisfies readonly OrderStatus[];

/** Pedidos en curso: ya solicitados y todavía sin cerrar (el despachado espera la confirmación de recepción). */
export const OPEN_STATUSES = [...ATTENTION_STATUSES, "despachado"] as const satisfies readonly OrderStatus[];

/** Roles que pueden crear un pedido interno en nombre del giro solicitante. */
export const CAN_CREATE: readonly Role[] = STAFF;
