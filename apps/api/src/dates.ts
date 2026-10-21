import { z } from "zod";

/** Fecha de hoy en Guatemala (UTC-6) con formato AAAA-MM-DD. */
export const todayGT = (offsetDays = 0) =>
  new Date(Date.now() - 6 * 3600 * 1000 + offsetDays * 24 * 3600 * 1000).toISOString().slice(0, 10);

/** Día calendario con formato AAAA-MM-DD, descartando fechas imposibles como 2026-02-30. */
export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use el formato AAAA-MM-DD")
  .refine((s) => {
    // Zod ejecuta este paso aunque el formato ya haya fallado, y toISOString() lanza error con una fecha inválida.
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
  }, "Fecha no válida");
