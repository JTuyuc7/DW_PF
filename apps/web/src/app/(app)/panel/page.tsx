"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ErrorNotice } from "@/components/ErrorNotice";
import { useSession } from "@/components/SessionProvider";
import { OverdueTag, StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { formatDate, formatQty, isOwnerOf, panelUnits } from "@/lib/format";
import type { BusinessUnit, PanelReport } from "@/lib/types";
import { btnSecondary, input, panel, panelTitle } from "@/lib/ui";

type Unit = { id: number; name: string };

export default function PanelPage() {
  const { user } = useSession();
  const router = useRouter();
  const owner = isOwnerOf(user.memberships);
  const own = useMemo(() => panelUnits(user.memberships), [user]);

  const [units, setUnits] = useState<Unit[]>(owner ? [] : own);
  const [unitId, setUnitId] = useState<number | null>(owner ? null : (own[0]?.id ?? null));
  const [report, setReport] = useState<PanelReport | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  // Quien no tiene panel (vendedor, administrativo, cliente) entra por la lista de pedidos.
  useEffect(() => {
    if (!owner && own.length === 0) router.replace("/pedidos");
  }, [owner, own, router]);

  // El dueño puede abrir el panel de cualquier giro.
  useEffect(() => {
    if (!owner) return;
    api<{ items: BusinessUnit[] }>("/public/business-units", { auth: false })
      .then((d) => {
        setUnits(d.items.map((u) => ({ id: u.id, name: u.name })));
        setUnitId((current) => current ?? d.items[0]?.id ?? null);
      })
      .catch(setError);
  }, [owner]);

  useEffect(() => {
    if (unitId === null) return;
    let cancelled = false;
    setLoading(true);
    api<PanelReport>(`/reports/business-units/${unitId}`)
      .then((d) => !cancelled && (setReport(d), setError(null)))
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [unitId, version]);

  if (!owner && own.length === 0) return null;

  const lateTotal = report ? report.asSupplier.overdue + report.asRequester.overdue : 0;
  const lateOrders = report?.toAttend.filter((o) => o.overdue) ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Panel{report ? ` · ${report.businessUnit.name}` : ""}</h1>
          <p className="text-sm text-muted">Resumen de los pedidos y las existencias del giro.</p>
        </div>
        <div className="flex items-center gap-3">
          {units.length > 1 && (
            <label className="flex items-center gap-2 text-sm">
              Giro
              <select value={unitId ?? ""} onChange={(e) => setUnitId(Number(e.target.value))} className={`${input} w-auto`}>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button onClick={() => setVersion((v) => v + 1)} disabled={loading} className={btnSecondary}>
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </div>

      <ErrorNotice error={error} />

      {!report && loading && <p className="py-10 text-center text-sm text-muted" aria-busy="true">Cargando…</p>}

      {report && (
        <>
          <ul className={`grid gap-3 sm:grid-cols-2 ${report.meetings ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
            <Kpi label="Por atender" value={report.asSupplier.toAttend} hint="Pedidos que otros giros le piden" />
            <Kpi
              label="Retrasados"
              value={lateTotal}
              tone={lateTotal > 0 ? "danger" : "normal"}
              hint={`${report.asSupplier.overdue} como proveedor · ${report.asRequester.overdue} como solicitante`}
            />
            <Kpi label="Pedidos del giro" value={report.asRequester.open} hint="Solicitados por el giro y aún abiertos" />
            <Kpi
              label="Bajo el mínimo"
              value={report.lowStock.count}
              tone={report.lowStock.count > 0 ? "warn" : "normal"}
              hint="Existencias en sus sedes"
            />
            {report.meetings && (
              <Kpi label="Reuniones por confirmar" value={report.meetings.requested} hint={`${report.meetings.confirmed} confirmadas`} />
            )}
          </ul>

          <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
            <section className={panel}>
              <h2 className={panelTitle}>Pedidos por atender</h2>
              {report.toAttend.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">No hay pedidos por atender.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="bg-paper text-xs uppercase tracking-wider text-muted">
                      <tr>
                        <th className="px-4 py-2 font-semibold">N.º</th>
                        <th className="px-4 py-2 font-semibold">Solicita</th>
                        <th className="px-4 py-2 font-semibold">Productos</th>
                        <th className="px-4 py-2 font-semibold">Fecha</th>
                        <th className="px-4 py-2 font-semibold">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {report.toAttend.map((o) => (
                        <tr key={o.id}>
                          <td className="px-4 py-2.5 font-medium tabular-nums">
                            <Link href={`/pedidos/${o.id}`} className="text-brand underline">
                              {o.id}
                            </Link>
                          </td>
                          <td className="px-4 py-2.5">{o.requestingUnitName ?? "—"}</td>
                          <td className="px-4 py-2.5">
                            {o.items.map((i) => (
                              <p key={i.productName} className="tabular-nums">
                                {formatQty(i.quantity, i.unit)} · {i.productName}
                              </p>
                            ))}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">
                            {formatDate(o.dueDate)} {o.overdue && <OverdueTag />}
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusBadge status={o.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="border-t border-line px-4 py-2.5 text-sm">
                <Link href="/pedidos" className="font-medium text-brand underline">
                  Ver todos los pedidos →
                </Link>
              </div>
            </section>

            <section className={`${panel} h-fit`}>
              <h2 className={panelTitle}>Requiere atención</h2>
              {lateOrders.length === 0 && report.asRequester.overdue === 0 && report.lowStock.count === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">Nada pendiente por ahora.</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {lateOrders.map((o) => (
                    <li key={o.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                      <span>
                        <Link href={`/pedidos/${o.id}`} className="font-medium text-brand underline">
                          Pedido {o.id}
                        </Link>{" "}
                        retrasado desde el <span className="tabular-nums">{formatDate(o.dueDate)}</span>
                      </span>
                      <Tag tone="danger">Retrasado</Tag>
                    </li>
                  ))}
                  {report.asRequester.overdue > 0 && (
                    <li className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                      <span>
                        {report.asRequester.overdue} {report.asRequester.overdue === 1 ? "pedido" : "pedidos"} del giro{" "}
                        {report.asRequester.overdue === 1 ? "está retrasado" : "están retrasados"}
                      </span>
                      <Tag tone="danger">Retrasado</Tag>
                    </li>
                  )}
                  {report.lowStock.items.map((s) => (
                    <li key={`${s.siteName}-${s.productName}`} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                      <span>
                        {s.productName} en {s.siteName}:{" "}
                        <span className="font-medium tabular-nums">{formatQty(s.quantity, s.unit)}</span>{" "}
                        <span className="text-muted">(mínimo {formatQty(s.minThreshold, s.unit)})</span>
                      </span>
                      <Tag tone="warn">Stock bajo</Tag>
                    </li>
                  ))}
                  {report.lowStock.count > report.lowStock.items.length && (
                    <li className="px-4 py-2.5 text-muted">Y {report.lowStock.count - report.lowStock.items.length} existencias más bajo el mínimo.</li>
                  )}
                </ul>
              )}
              <p className="border-t border-line px-4 py-2.5 text-xs text-muted">
                Resumen calculado al abrir el panel. El envío de alertas automáticas todavía no está activo.
              </p>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, hint, tone = "normal" }: { label: string; value: number; hint: string; tone?: "normal" | "danger" | "warn" }) {
  const color = tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-ink";
  return (
    <li className={`${panel} p-4`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </li>
  );
}

function Tag({ tone, children }: { tone: "danger" | "warn"; children: React.ReactNode }) {
  const style = tone === "danger" ? "border-danger text-danger" : "border-warn text-warn";
  return <span className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${style}`}>{children}</span>;
}
