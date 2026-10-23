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

export const ALERT_TYPES = ["pedido_retrasado", "stock_bajo", "exceso_velocidad"] as const;
export type AlertType = (typeof ALERT_TYPES)[number];
export type Severity = "info" | "aviso" | "critica";

export type Alert = {
  id: number;
  type: AlertType;
  severity: Severity;
  status: "abierta" | "atendida";
  businessUnitId: number;
  businessUnitName: string;
  /** Datos que originaron la alerta; su forma depende del tipo (ver `apps/api/src/alerts/engine.ts`). */
  payload: Record<string, any>;
  createdAt: string;
  attendedAt: string | null;
  attendedByName: string | null;
  resolvedAt: string | null;
  /** La condición cesó sola y nadie la marcó. */
  autoResolved: boolean;
};

export type AlertList = Paged<Alert> & { open: Record<Severity, number> & { total: number } };

export type Situation = "normal" | "vigilar" | "atencion";

export type UnitOverview = {
  id: number;
  code: string;
  name: string;
  type: string;
  openAsSupplier: number;
  openAsRequester: number;
  overdue: number;
  deliveredInPeriod: number;
  openAlerts: number;
  criticalAlerts: number;
  assets: number;
  assetsMoving: number;
  situation: Situation;
};

export type Overview = {
  period: { from: string; to: string };
  totals: {
    openOrders: number;
    overdueOrders: number;
    openAlerts: number;
    criticalAlerts: number;
    deliveredInPeriod: number;
    assetsMoving: number;
    assets: number;
  };
  units: UnitOverview[];
  criticalAlerts: Pick<Alert, "id" | "type" | "businessUnitId" | "businessUnitName" | "payload" | "createdAt">[];
};

export const ASSET_STATUSES = ["en_ruta", "activa", "detenido", "exceso", "sin_senal"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export type Reading = { recordedAt: string; lat: number; lng: number; speedKmh: number };

export type Asset = {
  id: number;
  name: string;
  kind: "camion" | "maquinaria";
  gpsExternalId: string;
  businessUnitId: number;
  businessUnitName: string;
  lastReading: Reading | null;
  status: AssetStatus;
};

export type AssetList = { items: Asset[]; maxSpeedKmh: number; staleMinutes: number };
export type AssetEvents = { asset: { id: number; name: string; businessUnitId: number }; items: (Reading & { id: number })[]; maxSpeedKmh: number };
