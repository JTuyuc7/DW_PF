"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ErrorNotice } from "@/components/ErrorNotice";
import { useSession } from "@/components/SessionProvider";
import { api } from "@/lib/api";
import { ALERT_TYPE_LABEL, SEVERITY_LABEL, formatDate, formatDateTime, formatQty, receivesAlerts } from "@/lib/format";
import { ALERT_TYPES, type Alert, type AlertList, type AlertType, type Severity } from "@/lib/types";
import { btnPrimary, btnSecondary, input, panel } from "@/lib/ui";

const PAGE_SIZE = 20;

// La severidad se indica con la franja y con el texto de la etiqueta, para no depender solo del color.
const SEVERITY_STYLE: Record<Severity, { stripe: string; tag: string }> = {
  critica: { stripe: "border-l-danger", tag: "border-danger bg-danger-soft text-danger" },
  aviso: { stripe: "border-l-warn", tag: "border-warn bg-warn-soft text-warn" },
  info: { stripe: "border-l-brand", tag: "border-brand bg-brand-soft text-brand" },
};

export default function AlertsPage() {
  const { user } = useSession();
  const [status, setStatus] = useState<"abierta" | "atendida">("abierta");
  const [severity, setSeverity] = useState<Severity | "">("");
  const [type, setType] = useState<AlertType | "">("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AlertList | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0); // se incrementa para recargar tras atender una alerta

  const allowed = receivesAlerts(user.memberships);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    setLoading(true);
    const qs = new URLSearchParams({ status, page: String(page), pageSize: String(PAGE_SIZE) });
    if (severity) qs.set("severity", severity);
    if (type) qs.set("type", type);
    api<AlertList>(`/alerts?${qs}`)
      .then((d) => !cancelled && (setData(d), setError(null)))
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [allowed, status, severity, type, page, version]);

  if (!allowed) {
    return (
      <div className="max-w-xl">
        <h1 className="text-xl font-semibold">Alertas</h1>
        <p className="mt-2 text-sm text-muted">Su rol no recibe alertas. Las reciben el dueño y los gerentes y operativos de cada giro.</p>
      </div>
    );
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const reset = (apply: () => void) => () => (apply(), setPage(1));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Alertas</h1>
        <p className="text-sm text-muted">
          Avisos generados por las reglas del sistema para su rol y su giro. Se cierran solas cuando la condición desaparece.
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div role="tablist" aria-label="Estado de las alertas" className="flex gap-2">
          {(["abierta", "atendida"] as const).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={status === s}
              onClick={reset(() => setStatus(s))}
              className={status === s ? `${btnPrimary} py-1.5` : `${btnSecondary} py-1.5`}
            >
              {s === "abierta" ? "Abiertas" : "Atendidas"}
              {s === "abierta" && data && <span className="tabular-nums">({data.open.total})</span>}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Severidad
            <select className={`${input} w-auto`} value={severity} onChange={(e) => reset(() => setSeverity(e.target.value as Severity | ""))()}>
              <option value="">Todas</option>
              {(["critica", "aviso", "info"] as const).map((s) => (
                <option key={s} value={s}>
                  {SEVERITY_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Tipo
            <select className={`${input} w-auto`} value={type} onChange={(e) => reset(() => setType(e.target.value as AlertType | ""))()}>
              <option value="">Todos</option>
              {ALERT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ALERT_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <ErrorNotice error={error} />

      <div aria-busy={loading} className="flex flex-col gap-3">
        {!data && loading && <p className="py-10 text-center text-sm text-muted">Cargando…</p>}
        {data?.items.length === 0 && (
          <p className={`${panel} px-4 py-10 text-center text-sm text-muted`}>
            {status === "abierta" ? "No hay alertas abiertas. Todo en orden." : "No hay alertas atendidas con estos filtros."}
          </p>
        )}
        {data?.items.map((a) => (
          <AlertCard key={a.id} alert={a} onChanged={() => setVersion((v) => v + 1)} />
        ))}
      </div>

      {data && data.total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span className="tabular-nums">
            {data.total} {data.total === 1 ? "alerta" : "alertas"} · página {data.page} de {pages}
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

function AlertCard({ alert: a, onChanged }: { alert: Alert; onChanged: () => void }) {
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const style = SEVERITY_STYLE[a.severity];

  async function attend() {
    setBusy(true);
    setError(null);
    try {
      await api(`/alerts/${a.id}`, { method: "PATCH", body: { status: "atendida" } });
      onChanged();
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  return (
    <article className={`${panel} border-l-4 ${style.stripe} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{ALERT_TYPE_LABEL[a.type]}</p>
          <p className="text-sm text-muted">
            {a.businessUnitName} · {formatDateTime(a.createdAt)}
          </p>
        </div>
        <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.tag}`}>
          {SEVERITY_LABEL[a.severity]}
        </span>
      </div>

      <AlertDetail alert={a} />

      <ErrorNotice error={error} />

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3 text-sm">
        {a.status === "abierta" ? (
          <button disabled={busy} onClick={attend} className={btnPrimary}>
            Marcar como atendida
          </button>
        ) : (
          <p className="text-muted">
            {a.autoResolved
              ? `Resuelta automáticamente el ${formatDateTime(a.attendedAt ?? a.resolvedAt ?? a.createdAt)}: la condición desapareció.`
              : `Atendida por ${a.attendedByName} el ${formatDateTime(a.attendedAt ?? a.createdAt)}.`}
          </p>
        )}
        {a.status === "abierta" && <OrderLink alert={a} />}
        {a.type === "exceso_velocidad" && (
          <Link href="/flota" className="text-brand underline">
            Ver la flota
          </Link>
        )}
      </div>
    </article>
  );
}

function OrderLink({ alert: a }: { alert: Alert }) {
  if (a.type !== "pedido_retrasado") return null;
  return (
    <Link href={`/pedidos/${a.payload.orderId}`} className="text-brand underline">
      Ver el pedido #{a.payload.orderId}
    </Link>
  );
}

// Datos que originaron la alerta, según su tipo.
function AlertDetail({ alert: a }: { alert: Alert }) {
  const p = a.payload;
  if (a.type === "pedido_retrasado") {
    const items = (p.items as { productName: string; unit: string; quantity: number }[]) ?? [];
    return (
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <Fact label="Pedido">
          <Link href={`/pedidos/${p.orderId}`} className="text-brand underline">
            #{p.orderId}
          </Link>
        </Fact>
        <Fact label="Solicitante">{p.requestingUnitName ?? "—"}</Fact>
        <Fact label="Fecha comprometida">
          <span className="tabular-nums">{formatDate(p.dueDate)}</span>
        </Fact>
        <Fact label="Retraso">
          <span className="tabular-nums">
            {p.daysLate} {p.daysLate === 1 ? "día" : "días"}
          </span>
        </Fact>
        {items.length > 0 && (
          <div className="sm:col-span-4">
            <dt className="text-muted">Pedido</dt>
            <dd>{items.map((i) => `${i.productName}: ${formatQty(i.quantity, i.unit)}`).join(" · ")}</dd>
          </div>
        )}
      </dl>
    );
  }
  if (a.type === "stock_bajo") {
    return (
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <Fact label="Producto">{p.productName}</Fact>
        <Fact label="Sede">{p.siteName}</Fact>
        <Fact label="Existencia">
          <span className="tabular-nums">{formatQty(p.quantity, p.unit)}</span>
        </Fact>
        <Fact label="Mínimo">
          <span className="tabular-nums">{formatQty(p.minThreshold, p.unit)}</span>
        </Fact>
      </dl>
    );
  }
  return (
    <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
      <Fact label={p.kind === "camion" ? "Camión" : "Equipo"}>{p.assetName}</Fact>
      <Fact label="Velocidad">
        <span className="tabular-nums">{p.speedKmh} km/h</span>
      </Fact>
      <Fact label="Límite">
        <span className="tabular-nums">{p.maxSpeedKmh} km/h</span>
      </Fact>
      <Fact label="Última lectura">
        <span className="tabular-nums">{formatDateTime(p.recordedAt)}</span>
      </Fact>
      <Fact label="Posición">
        <span className="tabular-nums">
          {Number(p.lat).toFixed(4)}, {Number(p.lng).toFixed(4)}
        </span>
      </Fact>
    </dl>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
