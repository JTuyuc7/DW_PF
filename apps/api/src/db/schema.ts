import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const businessUnitTypeEnum = pgEnum("business_unit_type", [
  "extraccion",
  "proceso",
  "maquinaria",
  "transporte_materia",
  "transporte_producto",
  "construccion",
]);

export const membershipRoleEnum = pgEnum("membership_role", [
  "dueno",
  "gerente",
  "vendedor",
  "operativo",
  "administrativo",
]);

export const orderKindEnum = pgEnum("order_kind", ["interno", "cliente", "tercero"]);

export const orderStatusEnum = pgEnum("order_status", [
  "borrador",
  "solicitado",
  "aprobado",
  "en_proceso",
  "despachado",
  "entregado",
  "cancelado",
]);

export const meetingStatusEnum = pgEnum("meeting_status", ["solicitada", "confirmada", "realizada", "cancelada"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const businessUnits = pgTable("business_units", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  type: businessUnitTypeEnum("type").notNull(),
  description: text("description").notNull().default(""),
});

export const sites = pgTable(
  "sites",
  {
    id: serial("id").primaryKey(),
    businessUnitId: integer("business_unit_id")
      .notNull()
      .references(() => businessUnits.id),
    name: text("name").notNull(),
    department: text("department").notNull(),
  },
  (t) => [unique("sites_unit_name_uq").on(t.businessUnitId, t.name)],
);

// Un usuario tiene uno o más roles; cada uno aplica a un giro (nulo = toda la organización).
export const memberships = pgTable(
  "memberships",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    businessUnitId: integer("business_unit_id").references(() => businessUnits.id),
    role: membershipRoleEnum("role").notNull(),
  },
  (t) => [
    // Sin duplicados por usuario, giro y rol. Dos índices parciales porque NULL no se compara como igual.
    uniqueIndex("memberships_unit_role_uq")
      .on(t.userId, t.businessUnitId, t.role)
      .where(sql`${t.businessUnitId} IS NOT NULL`),
    uniqueIndex("memberships_global_role_uq")
      .on(t.userId, t.role)
      .where(sql`${t.businessUnitId} IS NULL`),
    index("memberships_user_idx").on(t.userId),
  ],
);

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    businessUnitId: integer("business_unit_id")
      .notNull()
      .references(() => businessUnits.id),
    name: text("name").notNull(),
    unit: text("unit").notNull(),
    public: boolean("public").notNull().default(false),
  },
  (t) => [unique("products_unit_name_uq").on(t.businessUnitId, t.name)],
);

export const inventoryItems = pgTable(
  "inventory_items",
  {
    siteId: integer("site_id")
      .notNull()
      .references(() => sites.id),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    quantity: numeric("quantity", { precision: 14, scale: 2, mode: "number" }).notNull().default(0),
    minThreshold: numeric("min_threshold", { precision: 14, scale: 2, mode: "number" })
      .notNull()
      .default(0),
  },
  (t) => [
    primaryKey({ columns: [t.siteId, t.productId] }),
    check("inventory_quantity_nonneg", sql`${t.quantity} >= 0`),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    kind: orderKindEnum("kind").notNull(),
    supplierUnitId: integer("supplier_unit_id")
      .notNull()
      .references(() => businessUnits.id),
    requestingUnitId: integer("requesting_unit_id").references(() => businessUnits.id),
    status: orderStatusEnum("status").notNull().default("solicitado"),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    check(
      "orders_internal_units",
      sql`${t.kind} <> 'interno' OR (${t.requestingUnitId} IS NOT NULL AND ${t.requestingUnitId} <> ${t.supplierUnitId})`,
    ),
    index("orders_supplier_idx").on(t.supplierUnitId, t.status),
    index("orders_requesting_idx").on(t.requestingUnitId, t.status),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    quantity: numeric("quantity", { precision: 14, scale: 2, mode: "number" }).notNull(),
  },
  (t) => [
    unique("order_items_order_product_uq").on(t.orderId, t.productId),
    check("order_items_quantity_positive", sql`${t.quantity} > 0`),
  ],
);

export const orderMessages = pgTable(
  "order_messages",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    authorUserId: integer("author_user_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("order_messages_order_idx").on(t.orderId)],
);

// Empresa o persona que solicita una reunión. El NIT, si se indica, identifica al cliente entre solicitudes.
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  taxId: text("tax_id").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Solicitud de reunión hecha desde la sala de ventas. El vendedor se asigna al crearla (nulo si el giro no tiene).
export const meetings = pgTable(
  "meetings",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id),
    businessUnitId: integer("business_unit_id")
      .notNull()
      .references(() => businessUnits.id),
    sellerUserId: integer("seller_user_id").references(() => users.id),
    status: meetingStatusEnum("status").notNull().default("solicitada"),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    contactPhone: text("contact_phone").notNull(),
    message: text("message").notNull().default(""),
    preferredDate: date("preferred_date", { mode: "string" }),
    scheduledAt: timestamp("scheduled_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("meetings_seller_idx").on(t.sellerUserId, t.status),
    index("meetings_unit_idx").on(t.businessUnitId, t.status),
  ],
);

// Historial de estados: alimenta la línea de tiempo del detalle del pedido.
export const orderStatusEvents = pgTable(
  "order_status_events",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: orderStatusEnum("from_status"),
    toStatus: orderStatusEnum("to_status").notNull(),
    actorUserId: integer("actor_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("order_status_events_order_idx").on(t.orderId)],
);
