import { and, asc, count, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { getConnInfo } from "hono/bun";
import { z } from "zod";
import { dateString, todayGT } from "../dates";
import { db, schema } from "../db";
import { AppError, validate } from "../errors";
import { OPEN_MEETING_STATUSES } from "../meetings/rules";
import { createRateLimiter } from "../rateLimit";
import type { AppEnv } from "../types";

const productsQuery = z.object({
  businessUnitId: z.coerce.number().int().positive().optional(),
});

const meetingRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().max(120).default(""),
  taxId: z
    .string()
    .trim()
    .max(20)
    .regex(/^[0-9A-Za-z\- ]*$/, "Use solo letras, números y guiones")
    .default(""),
  email: z.string().trim().toLowerCase().email("Correo no válido").max(160),
  phone: z.string().trim().regex(/^[0-9+()\-\s]{7,20}$/, "Teléfono no válido"),
  businessUnitId: z.number().int().positive(),
  preferredDate: z.union([dateString, z.literal("")]).default(""),
  message: z.string().trim().max(1000).default(""),
  // Campo trampa: las personas no lo ven; si llega con texto, la solicitud la envió un programa.
  website: z.string().max(200).default(""),
});

// Máximo de solicitudes exitosas por dirección IP y hora. 0 desactiva el límite (útil en desarrollo).
const meetingLimiter = createRateLimiter(Number(process.env.MEETING_RATE_LIMIT ?? 10), 3600_000);

function clientKey(c: Parameters<typeof getConnInfo>[0]) {
  try {
    return getConnInfo(c).remote.address ?? "desconocido";
  } catch {
    return "desconocido";
  }
}

const MAX_DAYS_AHEAD = 180;

// Sala de ventas: contenido y formularios sin autenticación.
export const publicRoutes = new Hono<AppEnv>()
  .get("/business-units", async (c) => {
    const units = await db
      .select({
        id: schema.businessUnits.id,
        code: schema.businessUnits.code,
        name: schema.businessUnits.name,
        type: schema.businessUnits.type,
        description: schema.businessUnits.description,
      })
      .from(schema.businessUnits)
      .orderBy(asc(schema.businessUnits.id));
    const sites = await db
      .select({ businessUnitId: schema.sites.businessUnitId, department: schema.sites.department })
      .from(schema.sites)
      .orderBy(asc(schema.sites.id));
    // Departamentos donde opera cada giro (los giros sin sedes registradas devuelven una lista vacía).
    const items = units.map((u) => ({
      ...u,
      sites: sites.filter((s) => s.businessUnitId === u.id).map((s) => s.department),
    }));
    return c.json({ items });
  })

  .get("/products", validate("query", productsQuery), async (c) => {
    const { businessUnitId } = c.req.valid("query");
    const items = await db
      .select({
        id: schema.products.id,
        name: schema.products.name,
        unit: schema.products.unit,
        businessUnitId: schema.products.businessUnitId,
        businessUnitName: schema.businessUnits.name,
      })
      .from(schema.products)
      .innerJoin(schema.businessUnits, eq(schema.businessUnits.id, schema.products.businessUnitId))
      .where(
        and(eq(schema.products.public, true), businessUnitId ? eq(schema.products.businessUnitId, businessUnitId) : undefined),
      )
      .orderBy(asc(schema.products.businessUnitId), asc(schema.products.name));
    return c.json({ items });
  })

  .post("/meeting-requests", validate("json", meetingRequestSchema), async (c) => {
    const body = c.req.valid("json");
    const key = clientKey(c);

    const wait = meetingLimiter.retryAfter(key);
    if (wait !== null) {
      c.header("Retry-After", String(wait));
      throw new AppError(429, "TOO_MANY_REQUESTS", "Ha enviado varias solicitudes seguidas. Intente de nuevo más tarde.");
    }

    // Respuesta idéntica a la exitosa, para que un programa no sepa que fue detectado.
    const accepted = {
      status: "solicitada",
      message: "Recibimos su solicitud. Un vendedor lo contactará para confirmar la fecha.",
    };
    if (body.website) return c.json(accepted, 201);

    if (body.preferredDate && (body.preferredDate < todayGT() || body.preferredDate > todayGT(MAX_DAYS_AHEAD))) {
      throw new AppError(422, "PREFERRED_DATE_INVALID", `La fecha preferida debe estar entre hoy y los próximos ${MAX_DAYS_AHEAD} días`, [
        { field: "preferredDate", issue: `entre ${todayGT()} y ${todayGT(MAX_DAYS_AHEAD)}` },
      ]);
    }

    const [unit] = await db.select({ id: schema.businessUnits.id }).from(schema.businessUnits).where(eq(schema.businessUnits.id, body.businessUnitId));
    if (!unit) throw new AppError(422, "UNIT_NOT_FOUND", "El giro de interés no existe", [{ field: "businessUnitId", issue: "no existe" }]);

    // El NIT se guarda sin espacios ni guiones para reconocer al mismo cliente en solicitudes futuras.
    const taxId = body.taxId.replace(/[\s-]/g, "").toUpperCase() || null;

    await db.transaction(async (tx) => {
      let customerId: number;
      if (taxId) {
        await tx
          .insert(schema.customers)
          .values({ name: body.company || body.name, taxId })
          .onConflictDoNothing({ target: schema.customers.taxId });
        [{ id: customerId }] = await tx.select({ id: schema.customers.id }).from(schema.customers).where(eq(schema.customers.taxId, taxId));
      } else {
        [{ id: customerId }] = await tx
          .insert(schema.customers)
          .values({ name: body.company || body.name })
          .returning({ id: schema.customers.id });
      }

      // Se asigna el vendedor del giro con menos reuniones abiertas; si el giro no tiene vendedores queda sin asignar.
      const [seller] = await tx
        .select({ userId: schema.memberships.userId })
        .from(schema.memberships)
        .leftJoin(
          schema.meetings,
          and(eq(schema.meetings.sellerUserId, schema.memberships.userId), inArray(schema.meetings.status, [...OPEN_MEETING_STATUSES])),
        )
        .where(and(eq(schema.memberships.role, "vendedor"), eq(schema.memberships.businessUnitId, body.businessUnitId)))
        .groupBy(schema.memberships.userId)
        .orderBy(asc(count(schema.meetings.id)), asc(schema.memberships.userId))
        .limit(1);

      await tx.insert(schema.meetings).values({
        customerId,
        businessUnitId: body.businessUnitId,
        sellerUserId: seller?.userId ?? null,
        contactName: body.name,
        contactEmail: body.email,
        contactPhone: body.phone,
        message: body.message,
        preferredDate: body.preferredDate || null,
      });
    });

    meetingLimiter.record(key);
    return c.json(accepted, 201);
  });
