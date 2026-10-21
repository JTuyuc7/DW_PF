import { type SQL, and, count, desc, eq, inArray, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Hono } from "hono";
import { z } from "zod";
import { isOwner, loadAccess, requireAuth } from "../auth";
import { db, schema } from "../db";
import { AppError, validate } from "../errors";
import { MEETING_STATUSES, canMoveMeeting } from "../meetings/rules";
import type { Access, AppEnv } from "../types";

const { meetings, customers, businessUnits, users } = schema;
const seller = alias(users, "seller");

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

const idParam = z.object({ id: z.coerce.number().int().positive() });

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(MEETING_STATUSES).optional(),
});

const statusSchema = z.object({
  status: z.enum(MEETING_STATUSES),
  scheduledAt: z.string().datetime({ offset: true, message: "Use fecha y hora ISO 8601 con zona horaria" }).optional(),
});

const columns = {
  id: meetings.id,
  status: meetings.status,
  contactName: meetings.contactName,
  contactEmail: meetings.contactEmail,
  contactPhone: meetings.contactPhone,
  company: customers.name,
  taxId: customers.taxId,
  businessUnitId: meetings.businessUnitId,
  businessUnitName: businessUnits.name,
  sellerUserId: meetings.sellerUserId,
  sellerName: seller.name,
  message: meetings.message,
  preferredDate: meetings.preferredDate,
  scheduledAt: meetings.scheduledAt,
  createdAt: meetings.createdAt,
};

const baseQuery = (ex: Executor) =>
  ex
    .select(columns)
    .from(meetings)
    .innerJoin(customers, eq(customers.id, meetings.customerId))
    .innerJoin(businessUnits, eq(businessUnits.id, meetings.businessUnitId))
    .leftJoin(seller, eq(seller.id, meetings.sellerUserId));

type Meeting = Awaited<ReturnType<typeof baseQuery>>[number];

/** Giros donde el usuario es gerente: ve y gestiona sus reuniones, incluidas las que no tienen vendedor. */
const managedUnits = (a: Access) => [
  ...new Set(a.memberships.flatMap((m) => (m.role === "gerente" && m.businessUnitId !== null ? [m.businessUnitId] : []))),
];

const isSellerRole = (a: Access) => a.memberships.some((m) => m.role === "vendedor");

/** Puede gestionar la reunión quien la tiene asignada o el gerente de su giro. */
const canManage = (a: Access, m: Pick<Meeting, "sellerUserId" | "businessUnitId">) =>
  m.sellerUserId === a.userId || managedUnits(a).includes(m.businessUnitId);

// Estos datos incluyen contacto de personas externas: solo los ve quien atiende la reunión y el dueño.
const canView = (a: Access, m: Pick<Meeting, "sellerUserId" | "businessUnitId">) => isOwner(a) || canManage(a, m);

export const meetingRoutes = new Hono<AppEnv>()
  .use("*", requireAuth, loadAccess)

  .get("/", validate("query", listQuery), async (c) => {
    const access = c.get("access");
    const q = c.req.valid("query");
    const managed = managedUnits(access);
    const owner = isOwner(access);
    if (!owner && managed.length === 0 && !isSellerRole(access)) {
      throw new AppError(403, "FORBIDDEN", "Su rol no permite consultar reuniones");
    }

    let visible: SQL | undefined;
    if (!owner) {
      visible = managed.length > 0
        ? or(eq(meetings.sellerUserId, access.userId), inArray(meetings.businessUnitId, managed))
        : eq(meetings.sellerUserId, access.userId);
    }
    const where = and(visible, q.status ? eq(meetings.status, q.status) : undefined);

    const [{ total }] = await db.select({ total: count() }).from(meetings).where(where);
    const items = await baseQuery(db)
      .where(where)
      .orderBy(desc(meetings.createdAt), desc(meetings.id))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize);
    return c.json({ items, page: q.page, pageSize: q.pageSize, total });
  })

  .patch("/:id/status", validate("param", idParam), validate("json", statusSchema), async (c) => {
    const access = c.get("access");
    const { id } = c.req.valid("param");
    const { status: to, scheduledAt } = c.req.valid("json");

    await db.transaction(async (tx) => {
      // Se bloquea la fila para que dos cambios simultáneos no se pisen.
      const [locked] = await tx.select({ id: meetings.id }).from(meetings).where(eq(meetings.id, id)).for("update");
      if (!locked) throw new AppError(404, "MEETING_NOT_FOUND", "Reunión no encontrada");
      const [meeting] = await baseQuery(tx).where(eq(meetings.id, id));
      if (!canView(access, meeting)) throw new AppError(404, "MEETING_NOT_FOUND", "Reunión no encontrada");
      if (!canManage(access, meeting)) throw new AppError(403, "FORBIDDEN", "Su rol no permite cambiar esta reunión");

      if (!canMoveMeeting(meeting.status, to)) {
        throw new AppError(409, "MEETING_INVALID_TRANSITION", `No se puede pasar de '${meeting.status}' a '${to}'.`, [
          { field: "status", issue: "transición no permitida" },
        ]);
      }

      let when: Date | undefined;
      if (to === "confirmada") {
        if (!scheduledAt) {
          throw new AppError(422, "SCHEDULE_REQUIRED", "Indique la fecha y hora de la reunión para confirmarla", [
            { field: "scheduledAt", issue: "requerido al confirmar" },
          ]);
        }
        when = new Date(scheduledAt);
        if (when.getTime() <= Date.now()) {
          throw new AppError(422, "SCHEDULE_IN_PAST", "La fecha de la reunión debe ser futura", [
            { field: "scheduledAt", issue: "debe ser posterior a este momento" },
          ]);
        }
      }

      await tx
        .update(meetings)
        .set({ status: to, updatedAt: new Date(), ...(when ? { scheduledAt: when } : {}) })
        .where(eq(meetings.id, id));
    });

    const [updated] = await baseQuery(db).where(eq(meetings.id, id));
    return c.json(updated);
  });
