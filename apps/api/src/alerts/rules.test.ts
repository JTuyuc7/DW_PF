import { describe, expect, test } from "bun:test";
import { daysLate, isRecipient, isSpeeding, overdueSeverity, stockSeverity } from "./rules";

describe("retraso de pedidos", () => {
  test("cuenta días calendario y no es negativo", () => {
    expect(daysLate("2026-10-10", "2026-10-13")).toBe(3);
    expect(daysLate("2026-10-13", "2026-10-13")).toBe(0);
    expect(daysLate("2026-10-20", "2026-10-13")).toBe(0);
  });

  test("pasa a crítica al llegar al umbral", () => {
    expect(overdueSeverity(2, 3)).toBe("aviso");
    expect(overdueSeverity(3, 3)).toBe("critica");
  });
});

describe("stock bajo", () => {
  test("sin existencias es crítico", () => {
    expect(stockSeverity(0)).toBe("critica");
    expect(stockSeverity(15)).toBe("aviso");
  });
});

describe("exceso de velocidad", () => {
  const params = { maxSpeedKmh: 80, staleMinutes: 15 };
  const now = new Date("2026-10-22T12:00:00Z");
  const ago = (min: number) => new Date(now.getTime() - min * 60_000);

  test("supera el límite con lectura reciente", () => {
    expect(isSpeeding(95, ago(2), params, now)).toBe(true);
  });
  test("en el límite exacto no hay exceso", () => {
    expect(isSpeeding(80, ago(2), params, now)).toBe(false);
  });
  test("una lectura vieja ya no cuenta", () => {
    expect(isSpeeding(120, ago(30), params, now)).toBe(false);
  });
});

describe("destinatarios", () => {
  const target = ["gerente", "operativo"] as const;
  const alert = { businessUnitId: 1 };

  test("el dueño recibe las de todos los giros", () => {
    expect(isRecipient([{ businessUnitId: null, role: "dueno" }], alert, target)).toBe(true);
  });
  test("gerente y operativo del giro afectado", () => {
    expect(isRecipient([{ businessUnitId: 1, role: "gerente" }], alert, target)).toBe(true);
    expect(isRecipient([{ businessUnitId: 1, role: "operativo" }], alert, target)).toBe(true);
  });
  test("otro giro no la recibe", () => {
    expect(isRecipient([{ businessUnitId: 2, role: "gerente" }], alert, target)).toBe(false);
  });
  test("un rol que la regla no apunta no la recibe", () => {
    expect(isRecipient([{ businessUnitId: 1, role: "vendedor" }], alert, target)).toBe(false);
    expect(isRecipient([{ businessUnitId: 1, role: "administrativo" }], alert, target)).toBe(false);
  });
});
