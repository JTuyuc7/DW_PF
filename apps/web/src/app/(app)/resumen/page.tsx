"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ErrorNotice } from "@/components/ErrorNotice";
import { useSession } from "@/components/SessionProvider";
import { api } from "@/lib/api";
import { ALERT_TYPE_LABEL, SITUATION_LABEL, alertSummary, dayGT, formatDate, formatDateTime, isOwnerOf } from "@/lib/format";
import type { Overview, Situation } from "@/lib/types";
import { btnSecondary, input, panel, panelTitle } from "@/lib/ui";

const SITUATION_STYLE: Record<Situation, string> = {
  normal: "border-brand bg-brand-soft text-brand",
  vigilar: "border-warn bg-warn-soft text-warn",
  atencion: "border-danger bg-danger-soft text-danger",
};

/** Primer y último día del mes AAAA-MM. */
function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export default function OverviewPage() {
  const { user } = useSession();
  const owner = isOwnerOf(user.memberships);
  const [month, setMonth] = useState(dayGT(0).slice(0, 7)); // mes en curso, hora de Guatemala
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!owner || !month) return;
    let cancelled = false;
    setLoading(true);
    const { from, to } = monthRange(month);
    api<Overview>(`/reports/overview?from=${from}&to=${to}`)
      .then((d) => !cancelled && (setData(d), setError(null)))
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [owner, month, version]);

  if (!owner) {
    return (
      <div className="max-w-xl">
        <h1 className="text-xl font-semibold">Resumen</h1>
        <p className="mt-2 text-sm text-muted">El resumen consolidado de los seis giros es solo para el dueño.</p>
      </div>
    );
  }

  const maxOpen = Math.max(1, ...(data?.units.map((u) => u.openAsSupplier) ?? [1]));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Resumen de la organización</h1>
          <p className="text-sm text-muted">
            Los seis giros en una sola vista.
            {data && (
              <>
                {" "}
                Entregas del {formatDate(data.period.from)} al {formatDate(data.period.to)}; el resto de las cifras es la situación actual.
              </>
            )}
          </p>
        </div>
        <div className="flex items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Período
            <input type="month" value={month} max={dayGT(0).slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} className={`${input} w-auto`} />
          </label>
          <button onClick={() => setVersion((v) => v + 1)} disabled={loading} className={btnSecondary}>
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </div>

      <ErrorNotice error={error} />
      {!data && loading && <p className="py-10 text-center text-sm text-muted" aria-busy="true">Cargando…</p>}

      {data && (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi label="Pedidos abiertos" value={data.totals.openOrders} hint="Entre giros, aún sin cerrar" />
            <Kpi label="Retrasados" value={data.totals.overdueOrders} tone={data.totals.overdueOrders > 0 ? "danger" : "normal"} hint="Fecha vencida y sin despachar" />
            <Kpi
              label="Alertas abiertas"
              value={data.totals.openAlerts}
              tone={data.totals.criticalAlerts > 0 ? "danger" : data.totals.openAlerts > 0 ? "warn" : "normal"}
              hint={`${data.totals.criticalAlerts} críticas`}
            />
            <Kpi label="Entregados en el período" value={data.totals.deliveredInPeriod} hint="Recepción confirmada" />
            <Kpi label="Activos en ruta" value={data.totals.assetsMoving} hint={`de ${data.totals.assets} con GPS`} />
          </ul>

          <section className={panel}>
            <h2 className={panelTitle}>Situación por giro</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-paper text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Giro</th>
                    <th className="px-4 py-2 text-right font-semibold">Abiertos</th>
                    <th className="px-4 py-2 text-right font-semibold">Retrasados</th>
                    <th className="px-4 py-2 text-right font-semibold">Entregados</th>
                    <th className="px-4 py-2 text-right font-semibold">Alertas</th>
                    <th className="px-4 py-2 text-right font-semibold">En ruta</th>
                    <th className="px-4 py-2 font-semibold">Situación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.units.map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-2.5 font-medium">
                        <Link href={`/panel?giro=${u.id}`} className="text-brand underline">
                          {u.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums" title="Como proveedor / como solicitante">
                        {u.openAsSupplier} <span className="text-muted">/ {u.openAsRequester}</span>
                      </td>
                      <td className={`px-4 py-2.5 text-right tabular-nums ${u.overdue > 0 ? "font-medium text-danger" : ""}`}>{u.overdue}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{u.deliveredInPeriod}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {u.openAlerts}
                        {u.criticalAlerts > 0 && <span className="text-danger"> ({u.criticalAlerts} crít.)</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{u.assets === 0 ? <span className="text-muted">—</span> : `${u.assetsMoving} de ${u.assets}`}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${SITUATION_STYLE[u.situation]}`}>
                          {SITUATION_LABEL[u.situation]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-line px-4 py-2 text-xs text-muted">
              Abiertos: como proveedor / como solicitante. Atención: alguna alerta crítica o dos o más pedidos retrasados; vigilar: un retraso o alguna alerta abierta.
            </p>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className={panel}>
              <h2 className={panelTitle}>Pedidos por atender, por giro proveedor</h2>
              <ul className="flex flex-col gap-3 p-4">
                {data.units.map((u) => (
                  <li key={u.id} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
                    <span className="truncate" title={u.name}>
                      {u.name}
                    </span>
                    <span className="h-3 rounded-sm bg-paper" role="img" aria-label={`${u.openAsSupplier} abiertos, ${u.overdue} retrasados`}>
                      <span className="flex h-3" style={{ width: `${(u.openAsSupplier / maxOpen) * 100}%` }}>
                        <span className="h-3 bg-danger" style={{ width: `${u.openAsSupplier ? (u.overdue / u.openAsSupplier) * 100 : 0}%` }} />
                        <span className="h-3 flex-1 bg-brand" />
                      </span>
                    </span>
                    <span className="tabular-nums">{u.openAsSupplier}</span>
                  </li>
                ))}
              </ul>
              <p className="flex gap-4 border-t border-line px-4 py-2 text-xs text-muted">
                <span>
                  <span aria-hidden="true" className="mr-1 inline-block h-2 w-2 bg-brand" />
                  Abiertos
                </span>
                <span>
                  <span aria-hidden="true" className="mr-1 inline-block h-2 w-2 bg-danger" />
                  Retrasados
                </span>
              </p>
            </section>

            <section className={panel}>
              <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Alertas críticas</h2>
                <Link href="/alertas" className="text-xs text-brand underline">
                  Ver todas
                </Link>
              </div>
              {data.criticalAlerts.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">No hay alertas críticas abiertas.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {data.criticalAlerts.map((a) => (
                    <li key={a.id} className="px-4 py-3 text-sm">
                      <p className="font-medium">
                        {ALERT_TYPE_LABEL[a.type]} <span className="font-normal text-muted">· {a.businessUnitName}</span>
                      </p>
                      <p>{alertSummary(a)}</p>
                      <p className="text-xs text-muted tabular-nums">{formatDateTime(a.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className={`${panel} border-dashed`}>
            <h2 className={panelTitle}>Presupuesto frente a gasto</h2>
            <p className="px-4 py-6 text-sm text-muted">Reservado en el diseño. El módulo de presupuesto y gastos no forma parte del corte vertical implementado.</p>
          </section>
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
