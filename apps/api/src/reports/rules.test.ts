import { describe, expect, test } from "bun:test";
import { monthBounds, situation, startOfNextDayGT } from "./rules";

describe("situación del giro", () => {
  test("sin retrasos ni alertas es normal", () => {
    expect(situation({ overdue: 0, criticalAlerts: 0, openAlerts: 0 })).toBe("normal");
  });
  test("un retraso o una alerta simple piden vigilar", () => {
    expect(situation({ overdue: 1, criticalAlerts: 0, openAlerts: 0 })).toBe("vigilar");
    expect(situation({ overdue: 0, criticalAlerts: 0, openAlerts: 2 })).toBe("vigilar");
  });
  test("una alerta crítica o dos retrasos piden atención", () => {
    expect(situation({ overdue: 0, criticalAlerts: 1, openAlerts: 1 })).toBe("atencion");
    expect(situation({ overdue: 2, criticalAlerts: 0, openAlerts: 0 })).toBe("atencion");
  });
});

describe("períodos", () => {
  test("límites del mes, incluido febrero bisiesto", () => {
    expect(monthBounds("2026-10-22")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(monthBounds("2028-02-10")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthBounds("2026-12-31")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
  test("el día de Guatemala termina a las 06:00 UTC del siguiente", () => {
    expect(startOfNextDayGT("2026-10-31").toISOString()).toBe("2026-11-01T06:00:00.000Z");
  });
});
