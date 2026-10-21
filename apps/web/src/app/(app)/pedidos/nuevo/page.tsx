"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ErrorNotice } from "@/components/ErrorNotice";
import { useSession } from "@/components/SessionProvider";
import { api } from "@/lib/api";
import { formatQty, requestingUnits, todayGT, unitSymbol } from "@/lib/format";
import type { Availability, BusinessUnit, OrderDetail } from "@/lib/types";
import { btnPrimary, btnSecondary, input, panel } from "@/lib/ui";

type Line = { productId: string; quantity: string };
const emptyLine: Line = { productId: "", quantity: "" };

export default function NewOrderPage() {
  const router = useRouter();
  const { user } = useSession();
  const myUnits = useMemo(() => requestingUnits(user.memberships), [user]);

  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [requesterId, setRequesterId] = useState<number | null>(myUnits[0]?.id ?? null);
  const [supplierId, setSupplierId] = useState("");
  const [stock, setStock] = useState<Availability[]>([]);
  const [lines, setLines] = useState<Line[]>([emptyLine]);
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api<{ items: BusinessUnit[] }>("/public/business-units", { auth: false })
      .then((d) => setUnits(d.items))
      .catch(setError);
  }, []);

  // Al cambiar de proveedor cambian los productos disponibles, así que se reinician las líneas.
  useEffect(() => {
    setLines([emptyLine]);
    setStock([]);
    if (!supplierId) return;
    let cancelled = false;
    api<{ items: Availability[] }>(`/inventory/availability?businessUnitId=${supplierId}`)
      .then((d) => !cancelled && setStock(d.items))
      .catch((e) => !cancelled && setError(e));
    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  if (myUnits.length === 0) {
    return (
      <div className="flex max-w-xl flex-col gap-3">
        <h1 className="text-xl font-semibold">Nuevo pedido</h1>
        <p className="text-sm text-muted">
          Su rol no permite crear pedidos. Solo pueden hacerlo operativos y gerentes del giro que solicita.
        </p>
        <Link href="/pedidos" className="text-sm font-medium text-brand underline">
          Volver a pedidos
        </Link>
      </div>
    );
  }

  const requesterName = myUnits.find((u) => u.id === requesterId)?.name;
  const suppliers = units.filter((u) => u.id !== requesterId);
  const productOf = (id: string) => stock.find((p) => String(p.productId) === id);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  async function submit(status: "borrador" | "solicitado") {
    setError(null);
    if (!supplierId) return setError(new Error("Elija el giro proveedor."));
    if (!dueDate) return setError(new Error("Indique la fecha requerida."));
    if (dueDate < todayGT()) return setError(new Error("La fecha requerida no puede ser anterior a hoy."));
    for (const l of lines) {
      if (!l.productId) return setError(new Error("Elija un producto en cada línea."));
      if (!(Number(l.quantity) > 0)) return setError(new Error("La cantidad de cada línea debe ser mayor que cero."));
    }

    setSubmitting(true);
    try {
      const created = await api<OrderDetail>("/orders", {
        method: "POST",
        body: {
          kind: "interno",
          supplierUnitId: Number(supplierId),
          requestingUnitId: requesterId,
          dueDate,
          status,
          items: lines.map((l) => ({ productId: Number(l.productId), quantity: Number(l.quantity) })),
        },
      });
      router.push(`/pedidos/${created.id}`);
    } catch (e) {
      setError(e);
      setSubmitting(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <Link href="/pedidos" className="text-sm text-muted underline">
          ← Pedidos
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Nuevo pedido interno</h1>
        <p className="text-sm text-muted">Solicite materia prima o servicios a otro giro del grupo.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit("solicitado");
        }}
        className={`${panel} flex flex-col gap-5 p-5`}
      >
        <ErrorNotice error={error} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Giro solicitante
            {myUnits.length === 1 ? (
              <input value={requesterName} disabled className={input} />
            ) : (
              <select
                value={requesterId ?? ""}
                onChange={(e) => setRequesterId(Number(e.target.value))}
                className={input}
              >
                {myUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            )}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Giro proveedor
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required className={input}>
              <option value="">Seleccionar…</option>
              {suppliers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium">Productos</legend>
          {lines.map((line, index) => {
            const product = productOf(line.productId);
            const exceeds = product && Number(line.quantity) > product.available;
            return (
              <div key={index} className="rounded-md border border-line p-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
                  <label className="flex flex-col gap-1 text-sm">
                    Producto
                    <select
                      value={line.productId}
                      onChange={(e) => updateLine(index, { productId: e.target.value })}
                      disabled={!supplierId}
                      required
                      className={input}
                    >
                      <option value="">{supplierId ? "Seleccionar…" : "Elija primero el proveedor"}</option>
                      {stock.map((p) => (
                        <option
                          key={p.productId}
                          value={p.productId}
                          disabled={lines.some((l, i) => i !== index && l.productId === String(p.productId))}
                        >
                          {p.productName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Cantidad{product ? ` (${unitSymbol(product.unit)})` : ""}
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={line.quantity}
                      onChange={(e) => updateLine(index, { quantity: e.target.value })}
                      required
                      className={`${input} tabular-nums`}
                    />
                  </label>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLines(lines.filter((_, i) => i !== index))}
                      className="rounded-md px-2 py-2 text-sm text-muted underline hover:text-danger"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                {product && (
                  <p className={`mt-2 text-xs tabular-nums ${exceeds ? "text-warn" : "text-muted"}`}>
                    Disponible en el proveedor: {formatQty(product.available, product.unit)}
                    {exceeds && ". La cantidad supera la existencia actual; el pedido puede crearse, pero no podrá despacharse hasta que haya existencias."}
                  </p>
                )}
              </div>
            );
          })}
          {stock.length > lines.length && (
            <button type="button" onClick={() => setLines([...lines, emptyLine])} className="self-start text-sm font-medium text-brand underline">
              + Agregar otro producto
            </button>
          )}
        </fieldset>

        <label className="flex max-w-xs flex-col gap-1 text-sm font-medium">
          Fecha requerida
          <input
            type="date"
            value={dueDate}
            min={todayGT()}
            onChange={(e) => setDueDate(e.target.value)}
            required
            className={`${input} tabular-nums`}
          />
        </label>

        <div className="flex flex-wrap gap-3 border-t border-line pt-4">
          <button type="button" disabled={submitting} onClick={() => submit("borrador")} className={btnSecondary}>
            Guardar borrador
          </button>
          <button disabled={submitting} className={btnPrimary}>
            {submitting ? "Enviando…" : "Solicitar"}
          </button>
        </div>
      </form>
    </div>
  );
}
