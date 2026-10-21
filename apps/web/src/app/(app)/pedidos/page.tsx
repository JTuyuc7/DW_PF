"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ErrorNotice } from "@/components/ErrorNotice";
import { useSession } from "@/components/SessionProvider";
import { OverdueTag, StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { STATUS_LABEL, formatDate, formatQty, isOverdue, requestingUnits } from "@/lib/format";
import { ORDER_STATUSES, type OrderStatus, type OrderSummary, type Paged } from "@/lib/types";
import { btnPrimary, btnSecondary, input, panel } from "@/lib/ui";

const PAGE_SIZE = 20;

type Tab = "todos" | "atender" | "solicitados";
const TABS: { id: Tab; label: string }[] = [
  { id: "atender", label: "Que debo atender" },
  { id: "solicitados", label: "Solicitados por mi giro" },
  { id: "todos", label: "Todos" },
];
const RELATION: Record<Tab, string> = { todos: "", atender: "&relation=supplier", solicitados: "&relation=requester" };

export default function OrdersPage() {
  const { user } = useSession();
  const canCreate = useMemo(() => requestingUnits(user.memberships).length > 0, [user]);
  const [tab, setTab] = useState<Tab>(canCreate ? "atender" : "todos");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<OrderSummary> | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<Paged<OrderSummary>>(`/orders?page=${page}&pageSize=${PAGE_SIZE}${status ? `&status=${status}` : ""}${RELATION[tab]}`)
      .then((d) => !cancelled && (setData(d), setError(null)))
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tab, status, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Pedidos</h1>
        {canCreate && (
          <Link href="/pedidos/nuevo" className={btnPrimary}>
            + Nuevo pedido
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Vista de pedidos" className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => (setTab(t.id), setPage(1))}
              className={tab === t.id ? `${btnPrimary} py-1.5` : `${btnSecondary} py-1.5`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm">
          Estado
          <select
            value={status}
            onChange={(e) => (setStatus(e.target.value as OrderStatus | ""), setPage(1))}
            className={`${input} w-auto`}
          >
            <option value="">Todos</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ErrorNotice error={error} />

      <div className={`${panel} overflow-x-auto`} aria-busy={loading}>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-paper text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-2.5 font-semibold">N.º</th>
              <th className="px-4 py-2.5 font-semibold">Proveedor</th>
              <th className="px-4 py-2.5 font-semibold">Solicitante</th>
              <th className="px-4 py-2.5 font-semibold">Productos</th>
              <th className="px-4 py-2.5 font-semibold">Fecha requerida</th>
              <th className="px-4 py-2.5 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data?.items.map((o) => (
              <tr key={o.id} className="hover:bg-brand-soft/50">
                <td className="px-4 py-3 font-medium tabular-nums">
                  <Link href={`/pedidos/${o.id}`} className="text-brand underline">
                    {o.id}
                  </Link>
                </td>
                <td className="px-4 py-3">{o.supplierUnitName}</td>
                <td className="px-4 py-3">{o.requestingUnitName ?? "—"}</td>
                <td className="px-4 py-3">
                  {o.items.map((i) => (
                    <p key={i.productId} className="tabular-nums">
                      {formatQty(i.quantity, i.unit)} · {i.productName}
                    </p>
                  ))}
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                  {formatDate(o.dueDate)} {isOverdue(o) && <OverdueTag />}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={o.status} />
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  No hay pedidos con estos filtros.
                  {canCreate && tab !== "todos" && " Pruebe la vista “Todos” o cree uno nuevo."}
                </td>
              </tr>
            )}
            {!data && loading && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  Cargando…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span className="tabular-nums">
            {data.total} {data.total === 1 ? "pedido" : "pedidos"} · página {data.page} de {pages}
          </span>
          <div className="flex gap-2">
            <button className={btnSecondary} disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Anterior
            </button>
            <button className={btnSecondary} disabled={page >= pages} onClick={() => setPage(page + 1)}>
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
