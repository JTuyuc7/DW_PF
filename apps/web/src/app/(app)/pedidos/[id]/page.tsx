"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorNotice } from "@/components/ErrorNotice";
import { OverdueTag, StatusBadge } from "@/components/StatusBadge";
import { ApiError, api } from "@/lib/api";
import { STATUS_LABEL, TRANSITION_LABEL, formatDate, formatDateTime, formatQty, isOverdue } from "@/lib/format";
import type { OrderDetail, OrderMessage, OrderStatus } from "@/lib/types";
import { btnDanger, btnPrimary, btnSecondary, input, panel, panelTitle } from "@/lib/ui";

const FLOW: OrderStatus[] = ["solicitado", "aprobado", "en_proceso", "despachado", "entregado"];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([api<OrderDetail>(`/orders/${id}`), api<{ items: OrderMessage[] }>(`/orders/${id}/messages`)])
      .then(([o, m]) => {
        if (cancelled) return;
        setOrder(o);
        setMessages(m.items);
      })
      .catch((e) => !cancelled && setLoadError(e));
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function move(status: OrderStatus) {
    setBusy(true);
    setActionError(null);
    try {
      setOrder(await api<OrderDetail>(`/orders/${id}/status`, { method: "PATCH", body: { status } }));
      setConfirmCancel(false);
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(false);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    setActionError(null);
    try {
      const m = await api<OrderMessage>(`/orders/${id}/messages`, { method: "POST", body: { body: draft } });
      setMessages([...messages, m]);
      setDraft("");
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    const notFound = loadError instanceof ApiError && loadError.status === 404;
    return (
      <div className="flex max-w-xl flex-col gap-3">
        {notFound ? <p className="text-sm">No se encontró el pedido, o no tiene permiso para verlo.</p> : <ErrorNotice error={loadError} />}
        <Link href="/pedidos" className="text-sm font-medium text-brand underline">
          Volver a pedidos
        </Link>
      </div>
    );
  }
  if (!order) return <p className="text-sm text-muted" aria-busy="true">Cargando…</p>;

  const reached = new Set(order.history.map((h) => h.toStatus));
  const steps = reached.has("borrador") ? (["borrador", ...FLOW] as OrderStatus[]) : FLOW;
  const actions = order.allowedTransitions.filter((s) => s !== "cancelado");
  const canCancel = order.allowedTransitions.includes("cancelado");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/pedidos" className="text-sm text-muted underline">
          ← Pedidos
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tabular-nums">Pedido {order.id}</h1>
          <StatusBadge status={order.status} />
          {isOverdue(order) && <OverdueTag />}
        </div>
      </div>

      <ol aria-label="Progreso del pedido" className="flex flex-wrap items-center gap-2 text-xs">
        {steps.map((s, i) => {
          const done = reached.has(s);
          const current = order.status === s;
          return (
            <li key={s} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden className="text-line">→</span>}
              <span
                aria-current={current ? "step" : undefined}
                className={`rounded-full border px-2.5 py-1 ${
                  current
                    ? "border-brand bg-brand font-medium text-white"
                    : done
                      ? "border-line bg-brand-soft text-ink"
                      : "border-line text-muted"
                }`}
              >
                {STATUS_LABEL[s]}
              </span>
            </li>
          );
        })}
        {order.status === "cancelado" && (
          <li className="flex items-center gap-2">
            <span aria-hidden className="text-line">→</span>
            <span aria-current="step" className="rounded-full border border-danger bg-danger px-2.5 py-1 font-medium text-white">
              Cancelado
            </span>
          </li>
        )}
      </ol>

      <ErrorNotice error={actionError} />

      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-5">
          <section className={panel}>
            <h2 className={panelTitle}>Datos del pedido</h2>
            <dl className="grid gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted">Proveedor</dt>
                <dd className="font-medium">{order.supplierUnitName}</dd>
              </div>
              <div>
                <dt className="text-muted">Solicitante</dt>
                <dd className="font-medium">{order.requestingUnitName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Fecha requerida</dt>
                <dd className="font-medium tabular-nums">{formatDate(order.dueDate)}</dd>
              </div>
            </dl>
            <div className="overflow-x-auto border-t border-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-paper text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Producto</th>
                    <th className="px-4 py-2 text-right font-semibold">Cantidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {order.items.map((i) => (
                    <tr key={i.productId}>
                      <td className="px-4 py-2.5">{i.productName}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatQty(i.quantity, i.unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(actions.length > 0 || canCancel) && (
              <div className="flex flex-wrap items-center gap-3 border-t border-line p-4">
                {actions.map((s) => (
                  <button key={s} disabled={busy} onClick={() => move(s)} className={btnPrimary}>
                    {TRANSITION_LABEL[s]}
                  </button>
                ))}
                {canCancel &&
                  (confirmCancel ? (
                    <span className="flex flex-wrap items-center gap-2 text-sm">
                      ¿Cancelar este pedido? No se puede deshacer.
                      <button disabled={busy} onClick={() => move("cancelado")} className={btnDanger}>
                        Sí, cancelar
                      </button>
                      <button disabled={busy} onClick={() => setConfirmCancel(false)} className={btnSecondary}>
                        No
                      </button>
                    </span>
                  ) : (
                    <button disabled={busy} onClick={() => setConfirmCancel(true)} className={btnDanger}>
                      {TRANSITION_LABEL.cancelado}
                    </button>
                  ))}
              </div>
            )}
          </section>

          <section className={panel}>
            <h2 className={panelTitle}>Historial</h2>
            <ul className="divide-y divide-line text-sm">
              {[...order.history].reverse().map((h, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span>
                    <StatusBadge status={h.toStatus} /> <span className="text-muted">por {h.actorName}</span>
                  </span>
                  <time className="text-xs tabular-nums text-muted">{formatDateTime(h.createdAt)}</time>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className={`${panel} flex h-fit flex-col`}>
          <h2 className={panelTitle}>Mensajes</h2>
          <ul className="flex max-h-96 flex-col gap-3 overflow-y-auto p-4 text-sm">
            {messages.length === 0 && <li className="text-muted">Aún no hay mensajes en este pedido.</li>}
            {messages.map((m) => (
              <li key={m.id} className="border-l-2 border-line pl-3">
                <p className="text-xs text-muted">
                  {m.authorName} · <time className="tabular-nums">{formatDateTime(m.createdAt)}</time>
                </p>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </li>
            ))}
          </ul>
          <form onSubmit={send} className="flex flex-col gap-2 border-t border-line p-4">
            <label htmlFor="message" className="sr-only">
              Escribir mensaje
            </label>
            <textarea
              id="message"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Escribir mensaje…"
              className={input}
            />
            <button disabled={busy || !draft.trim()} className={`${btnSecondary} self-end`}>
              Enviar
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
