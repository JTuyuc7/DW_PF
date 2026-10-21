import { describe, expect, test } from "bun:test";
import { createRateLimiter } from "../rateLimit";
import { MEETING_STATUSES, canMoveMeeting } from "./rules";

describe("canMoveMeeting", () => {
  test("una solicitud se confirma o se cancela", () => {
    expect(canMoveMeeting("solicitada", "confirmada")).toBe(true);
    expect(canMoveMeeting("solicitada", "cancelada")).toBe(true);
  });

  test("no se puede marcar como realizada una reunión sin confirmar", () => {
    expect(canMoveMeeting("solicitada", "realizada")).toBe(false);
  });

  test("una reunión confirmada se realiza o se cancela", () => {
    expect(canMoveMeeting("confirmada", "realizada")).toBe(true);
    expect(canMoveMeeting("confirmada", "cancelada")).toBe(true);
  });

  test("los estados finales no tienen salida", () => {
    for (const to of MEETING_STATUSES) {
      expect(canMoveMeeting("realizada", to)).toBe(false);
      expect(canMoveMeeting("cancelada", to)).toBe(false);
    }
  });
});

describe("createRateLimiter", () => {
  const HOUR = 3600_000;

  test("permite hasta el máximo y luego indica cuánto esperar", () => {
    let t = 0;
    const limiter = createRateLimiter(2, HOUR, () => t);
    expect(limiter.retryAfter("a")).toBeNull();
    limiter.record("a");
    t += 10_000;
    limiter.record("a");
    expect(limiter.retryAfter("a")).toBe(3590);
  });

  test("cada cliente tiene su propio contador", () => {
    const limiter = createRateLimiter(1, HOUR);
    limiter.record("a");
    expect(limiter.retryAfter("a")).not.toBeNull();
    expect(limiter.retryAfter("b")).toBeNull();
  });

  test("libera el cupo cuando pasa la ventana", () => {
    let t = 0;
    const limiter = createRateLimiter(1, HOUR, () => t);
    limiter.record("a");
    expect(limiter.retryAfter("a")).not.toBeNull();
    t += HOUR + 1;
    expect(limiter.retryAfter("a")).toBeNull();
  });

  test("con máximo 0 no limita", () => {
    const limiter = createRateLimiter(0, HOUR);
    for (let i = 0; i < 100; i++) limiter.record("a");
    expect(limiter.retryAfter("a")).toBeNull();
  });
});
