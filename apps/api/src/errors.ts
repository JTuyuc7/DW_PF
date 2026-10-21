import { zValidator } from "@hono/zod-validator";
import type { Context, ErrorHandler, NotFoundHandler, ValidationTargets } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ZodTypeAny } from "zod";
import type { AppEnv } from "./types";

export type ErrorDetail = { field?: string; issue: string };

export class AppError extends Error {
  constructor(
    public status: ContentfulStatusCode,
    public code: string,
    message: string,
    public details?: ErrorDetail[],
  ) {
    super(message);
  }
}

// Formato de error uniforme (ver docs/05-datos-y-apis.md, sección 5.3).
export function errorBody(c: Context<AppEnv>, code: string, message: string, details?: ErrorDetail[]) {
  return { error: { code, message, ...(details ? { details } : {}), requestId: c.get("requestId") } };
}

export const onError: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof AppError) {
    return c.json(errorBody(c, err.code, err.message, err.details), err.status);
  }
  if (err instanceof HTTPException) {
    if (err.status === 401) return c.json(errorBody(c, "UNAUTHORIZED", "Token ausente o inválido"), 401);
    if (err.status === 400) return c.json(errorBody(c, "BAD_REQUEST", "Solicitud mal formada"), 400);
  }
  // Nunca se devuelven mensajes de la base de datos ni trazas; solo el requestId para correlacionar.
  console.error(`[${c.get("requestId")}]`, err);
  return c.json(errorBody(c, "INTERNAL_ERROR", "Error interno del servidor"), 500);
};

export const notFound: NotFoundHandler<AppEnv> = (c) =>
  c.json(errorBody(c, "NOT_FOUND", "Recurso no encontrado"), 404);

// Validación Zod con el mismo formato de error que el resto de la API.
export const validate = <Target extends keyof ValidationTargets, Schema extends ZodTypeAny>(
  target: Target,
  schema: Schema,
) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(
        errorBody(
          c as unknown as Context<AppEnv>,
          "VALIDATION_ERROR",
          "Los datos enviados no son válidos",
          result.error.issues.map((i) => ({ field: i.path.join(".") || undefined, issue: i.message })),
        ),
        400,
      );
    }
  });
