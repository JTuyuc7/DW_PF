export const ASSET_STATUSES = ["en_ruta", "activa", "detenido", "exceso", "sin_senal"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

/**
 * Estado de un activo según su última lectura. Sin señal gana a todo (una lectura vieja no dice nada del presente);
 * después el exceso de velocidad; luego el movimiento, que se llama "en ruta" en un camión y "activa" en maquinaria.
 */
export function assetStatus(
  kind: "camion" | "maquinaria",
  last: { recordedAt: Date; speedKmh: number } | null,
  params: { maxSpeedKmh: number; staleMinutes: number },
  now: Date,
): AssetStatus {
  if (!last || (now.getTime() - last.recordedAt.getTime()) / 60_000 > params.staleMinutes) return "sin_senal";
  if (last.speedKmh > params.maxSpeedKmh) return "exceso";
  if (last.speedKmh > 0) return kind === "camion" ? "en_ruta" : "activa";
  return "detenido";
}
