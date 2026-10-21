// Formas de las respuestas de la API (docs/05-datos-y-apis.md).

export type Role = "dueno" | "gerente" | "vendedor" | "operativo" | "administrativo";

export type Membership = { businessUnitId: number | null; businessUnitName: string | null; role: Role };

export type User = { id: number; name: string; email: string; memberships: Membership[] };

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

export type OrderItem = { productId: number; productName: string; unit: string; quantity: number };

export type OrderSummary = {
  id: number;
  kind: "interno" | "cliente" | "tercero";
  status: OrderStatus;
  supplierUnitId: number;
  supplierUnitName: string;
  requestingUnitId: number | null;
  requestingUnitName: string | null;
  dueDate: string;
  createdAt: string;
  items: OrderItem[];
};

export type OrderEvent = {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorName: string;
  createdAt: string;
};

export type OrderDetail = OrderSummary & { history: OrderEvent[]; allowedTransitions: OrderStatus[] };

export type Paged<T> = { items: T[]; page: number; pageSize: number; total: number };

export type OrderMessage = { id: number; authorName: string; body: string; createdAt: string };

export type BusinessUnit = {
  id: number;
  code: string;
  name: string;
  type: string;
  description: string;
  sites: string[];
};

export type PublicProduct = {
  id: number;
  name: string;
  unit: string;
  businessUnitId: number;
  businessUnitName: string;
};

export type Availability = { productId: number; productName: string; unit: string; available: number };

export const MEETING_STATUSES = ["solicitada", "confirmada", "realizada", "cancelada"] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export type Meeting = {
  id: number;
  status: MeetingStatus;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  company: string;
  taxId: string | null;
  businessUnitId: number;
  businessUnitName: string;
  sellerUserId: number | null;
  sellerName: string | null;
  message: string;
  preferredDate: string | null;
  scheduledAt: string | null;
  createdAt: string;
};

export type PanelOrder = {
  id: number;
  status: OrderStatus;
  requestingUnitName: string | null;
  dueDate: string;
  overdue: boolean;
  items: { productName: string; unit: string; quantity: number }[];
};

export type PanelReport = {
  businessUnit: { id: number; name: string; type: string };
  asSupplier: { byStatus: Record<OrderStatus, number>; open: number; overdue: number; toAttend: number };
  asRequester: { byStatus: Record<OrderStatus, number>; open: number; overdue: number };
  toAttend: PanelOrder[];
  lowStock: {
    count: number;
    items: { siteName: string; productName: string; unit: string; quantity: number; minThreshold: number }[];
  };
  meetings: { requested: number; confirmed: number } | null;
};
