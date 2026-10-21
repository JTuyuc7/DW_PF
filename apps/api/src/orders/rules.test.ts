import { describe, expect, test } from "bun:test";
import { ORDER_STATUSES, allowedTransitions, checkTransition } from "./rules";

const none = { supplier: [], requester: [] } as const;

describe("checkTransition", () => {
  test("el gerente del proveedor aprueba un pedido solicitado", () => {
    expect(checkTransition("solicitado", "aprobado", { supplier: ["gerente"], requester: [] })).toBe("ok");
  });

  test("el operativo del proveedor no puede aprobar", () => {
    expect(checkTransition("solicitado", "aprobado", { supplier: ["operativo"], requester: [] })).toBe("forbidden");
  });

  test("el solicitante no puede aprobar su propio pedido", () => {
    expect(checkTransition("solicitado", "aprobado", { supplier: [], requester: ["gerente"] })).toBe("forbidden");
  });

  test("solo el solicitante confirma la recepción", () => {
    expect(checkTransition("despachado", "entregado", { supplier: ["gerente"], requester: [] })).toBe("forbidden");
    expect(checkTransition("despachado", "entregado", { supplier: [], requester: ["operativo"] })).toBe("ok");
  });

  test("una transición fuera de la máquina de estados es inválida, aun con permisos", () => {
    const all = { supplier: ["gerente", "operativo"], requester: ["gerente", "operativo"] } as const;
    expect(checkTransition("entregado", "aprobado", all)).toBe("invalid");
    expect(checkTransition("solicitado", "entregado", all)).toBe("invalid");
    expect(checkTransition("cancelado", "solicitado", all)).toBe("invalid");
  });

  test("cancelar es posible antes de despachar y no después", () => {
    const manager = { supplier: ["gerente"], requester: [] } as const;
    for (const s of ["solicitado", "aprobado", "en_proceso"] as const) {
      expect(checkTransition(s, "cancelado", manager)).toBe("ok");
    }
    expect(checkTransition("despachado", "cancelado", manager)).toBe("invalid");
  });

  test("los estados finales no tienen salida", () => {
    expect(allowedTransitions("entregado", { supplier: ["gerente"], requester: ["gerente"] })).toEqual([]);
    expect(allowedTransitions("cancelado", { supplier: ["gerente"], requester: ["gerente"] })).toEqual([]);
  });
});

describe("allowedTransitions", () => {
  test("sin roles en el pedido no hay acciones", () => {
    for (const s of ORDER_STATUSES) expect(allowedTransitions(s, none)).toEqual([]);
  });

  test("el gerente proveedor ve aprobar y cancelar sobre un pedido solicitado", () => {
    expect(allowedTransitions("solicitado", { supplier: ["gerente"], requester: [] }).sort()).toEqual([
      "aprobado",
      "cancelado",
    ]);
  });
});
