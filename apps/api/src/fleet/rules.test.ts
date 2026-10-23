import { describe, expect, test } from "bun:test";
import { assetStatus } from "./rules";

const params = { maxSpeedKmh: 80, staleMinutes: 15 };
const now = new Date("2026-10-22T12:00:00Z");
const reading = (speedKmh: number, minutesAgo = 1) => ({ speedKmh, recordedAt: new Date(now.getTime() - minutesAgo * 60_000) });

describe("estado de un activo", () => {
  test("sin lecturas o con lectura vieja está sin señal, aunque la velocidad fuera alta", () => {
    expect(assetStatus("camion", null, params, now)).toBe("sin_senal");
    expect(assetStatus("camion", reading(120, 30), params, now)).toBe("sin_senal");
  });
  test("por encima del límite es exceso; en el límite exacto no", () => {
    expect(assetStatus("camion", reading(81), params, now)).toBe("exceso");
    expect(assetStatus("camion", reading(80), params, now)).toBe("en_ruta");
  });
  test("en movimiento: en ruta si es camión, activa si es maquinaria", () => {
    expect(assetStatus("camion", reading(55), params, now)).toBe("en_ruta");
    expect(assetStatus("maquinaria", reading(6), params, now)).toBe("activa");
  });
  test("velocidad cero con señal es detenido", () => {
    expect(assetStatus("camion", reading(0), params, now)).toBe("detenido");
    expect(assetStatus("maquinaria", reading(0), params, now)).toBe("detenido");
  });
});
