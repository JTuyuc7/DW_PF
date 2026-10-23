"use client";

import { useEffect, useMemo, useState } from "react";
import { ErrorNotice } from "@/components/ErrorNotice";
import { useSession } from "@/components/SessionProvider";
import { api } from "@/lib/api";
import { ASSET_STATUS_LABEL, formatDateTime, isOwnerOf, panelUnits, timeAgo } from "@/lib/format";
import { ASSET_STATUSES, type Asset, type AssetEvents, type AssetList, type AssetStatus } from "@/lib/types";
import { btnPrimary, btnSecondary, input, panel, panelTitle } from "@/lib/ui";

const REFRESH_MS = 30_000;

// Color y forma por estado; la forma y la etiqueta evitan depender solo del color.
const STATUS_STYLE: Record<AssetStatus, { tag: string; fill: string }> = {
  en_ruta: { tag: "border-brand bg-brand-soft text-brand", fill: "var(--color-brand)" },
  activa: { tag: "border-brand bg-brand-soft text-brand", fill: "var(--color-brand)" },
  detenido: { tag: "border-line bg-paper text-muted", fill: "#6b7280" },
  exceso: { tag: "border-danger bg-danger-soft text-danger", fill: "var(--color-danger)" },
  sin_senal: { tag: "border-warn bg-warn-soft text-warn", fill: "var(--color-warn)" },
};

export default function FleetPage() {
  const { user } = useSession();
  const owner = isOwnerOf(user.memberships);
  const allowed = owner || panelUnits(user.memberships).length > 0;

  const [kind, setKind] = useState<"" | "camion" | "maquinaria">("");
  const [status, setStatus] = useState<AssetStatus | "">("");
  const [data, setData] = useState<AssetList | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    setLoading(true);
    const qs = new URLSearchParams();
    if (kind) qs.set("kind", kind);
    if (status) qs.set("status", status);
    api<AssetList>(`/assets?${qs}`)
      .then((d) => !cancelled && (setData(d), setError(null)))
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [allowed, kind, status, version]);

  // Las posiciones cambian solas: se vuelve a consultar cada 30 segundos.
  useEffect(() => {
    if (!allowed) return;
    const timer = setInterval(() => setVersion((v) => v + 1), REFRESH_MS);
    return () => clearInterval(timer);
  }, [allowed]);

  const current = useMemo(() => data?.items.find((a) => a.id === selected) ?? null, [data, selected]);
  // Si el activo elegido ya no cumple el filtro se elige el primero de la lista.
  useEffect(() => {
    if (data && !data.items.some((a) => a.id === selected)) setSelected(data.items[0]?.id ?? null);
  }, [data, selected]);

  if (!allowed) {
    return (
      <div className="max-w-xl">
        <h1 className="text-xl font-semibold">Flota y GPS</h1>
        <p className="mt-2 text-sm text-muted">Su rol no consulta la flota. Lo hacen el dueño y los gerentes y operativos de cada giro.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Flota y GPS</h1>
          <p className="text-sm text-muted">
            Última posición y velocidad de camiones y maquinaria. Se actualiza cada 30 segundos.
            {data && ` Límite de velocidad: ${data.maxSpeedKmh} km/h; sin señal tras ${data.staleMinutes} min sin lecturas.`}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Tipo
            <select className={`${input} w-auto`} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="">Todos</option>
              <option value="camion">Camiones</option>
              <option value="maquinaria">Maquinaria</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Estado
            <select className={`${input} w-auto`} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="">Todos</option>
              {ASSET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ASSET_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => setVersion((v) => v + 1)} disabled={loading} className={btnSecondary}>
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </div>

      <ErrorNotice error={error} />
      {!data && loading && <p className="py-10 text-center text-sm text-muted" aria-busy="true">Cargando…</p>}

      {data && data.items.length === 0 && (
        <p className={`${panel} px-4 py-10 text-center text-sm text-muted`}>No hay activos con estos filtros.</p>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="grid gap-5 lg:grid-cols-[2fr_3fr]">
            <section className={panel}>
              <h2 className={panelTitle}>Activos ({data.items.length})</h2>
              <ul className="divide-y divide-line">
                {data.items.map((a) => (
                  <li key={a.id}>
                    <button
                      onClick={() => setSelected(a.id)}
                      aria-pressed={a.id === selected}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-brand-soft ${a.id === selected ? "bg-brand-soft" : ""}`}
                    >
                      <span>
                        <span className="block font-medium">{a.name}</span>
                        <span className="block text-xs text-muted">
                          {a.businessUnitName}
                          {a.lastReading && (
                            <>
                              {" · "}
                              <span className="tabular-nums">{a.lastReading.speedKmh} km/h</span>, {timeAgo(a.lastReading.recordedAt)}
                            </>
                          )}
                        </span>
                      </span>
                      <StatusTag status={a.status} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className={panel}>
              <h2 className={panelTitle}>Mapa esquemático</h2>
              <PositionMap assets={data.items} selected={selected} onSelect={setSelected} />
              <p className="border-t border-line px-4 py-2 text-xs text-muted">
                Posiciones sobre un esquema de Guatemala, sin cartografía. El mapa real requiere una librería de mapas (queda como mejora).
              </p>
            </section>
          </div>

          {current && <AssetDetail asset={current} maxSpeedKmh={data.maxSpeedKmh} refresh={version} />}
        </>
      )}
    </div>
  );
}

function StatusTag({ status }: { status: AssetStatus }) {
  return (
    <span className={`inline-block shrink-0 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status].tag}`}>
      {ASSET_STATUS_LABEL[status]}
    </span>
  );
}

// Caja geográfica aproximada de Guatemala.
const BOUNDS = { latMin: 13.6, latMax: 17.9, lngMin: -92.4, lngMax: -88.1 };
const W = 480;
const H = 360;

function PositionMap({ assets, selected, onSelect }: { assets: Asset[]; selected: number | null; onSelect: (id: number) => void }) {
  const project = (lat: number, lng: number) => ({
    x: ((lng - BOUNDS.lngMin) / (BOUNDS.lngMax - BOUNDS.lngMin)) * W,
    y: H - ((lat - BOUNDS.latMin) / (BOUNDS.latMax - BOUNDS.latMin)) * H,
  });
  const placed = assets.filter((a) => a.lastReading);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full bg-paper" role="group" aria-label="Posición de cada activo">
      {[1, 2, 3].map((i) => (
        <g key={i} stroke="var(--color-line)" strokeWidth="1">
          <line x1={(W / 4) * i} y1={0} x2={(W / 4) * i} y2={H} />
          <line x1={0} y1={(H / 4) * i} x2={W} y2={(H / 4) * i} />
        </g>
      ))}
      {placed.map((a) => {
        const { x, y } = project(a.lastReading!.lat, a.lastReading!.lng);
        const on = a.id === selected;
        return (
          <g key={a.id} transform={`translate(${x} ${y})`} onClick={() => onSelect(a.id)} className="cursor-pointer" role="button" aria-label={`${a.name}: ${ASSET_STATUS_LABEL[a.status]}`}>
            {on && <circle r="13" fill="none" stroke="var(--color-ink)" strokeWidth="2" />}
            {/* Camión: círculo; maquinaria: cuadrado. */}
            {a.kind === "camion" ? (
              <circle r="7" fill={STATUS_STYLE[a.status].fill} />
            ) : (
              <rect x="-7" y="-7" width="14" height="14" fill={STATUS_STYLE[a.status].fill} />
            )}
            <text x="11" y="4" fontSize="11" fill="var(--color-ink)" stroke="var(--color-paper)" strokeWidth="3" paintOrder="stroke">
              {a.name}
            </text>
          </g>
        );
      })}
      {placed.length === 0 && (
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="13" fill="var(--color-muted)">
          Sin lecturas para mostrar
        </text>
      )}
    </svg>
  );
}

function AssetDetail({ asset, maxSpeedKmh, refresh }: { asset: Asset; maxSpeedKmh: number; refresh: number }) {
  const [events, setEvents] = useState<AssetEvents | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [rows, setRows] = useState(10);

  useEffect(() => {
    let cancelled = false;
    api<AssetEvents>(`/assets/${asset.id}/events?limit=60`)
      .then((d) => !cancelled && (setEvents(d), setError(null)))
      .catch((e) => !cancelled && setError(e));
    return () => {
      cancelled = true;
    };
  }, [asset.id, refresh]);

  const mine = events && events.asset.id === asset.id ? events : null;

  return (
    <section className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
          {asset.name} · {asset.businessUnitName}
        </h2>
        <StatusTag status={asset.status} />
      </div>
      <div className="p-4">
        <ErrorNotice error={error} />
        {!mine && !error && <p className="py-6 text-center text-sm text-muted" aria-busy="true">Cargando lecturas…</p>}
        {mine && mine.items.length === 0 && <p className="py-6 text-center text-sm text-muted">Este activo aún no tiene lecturas.</p>}
        {mine && mine.items.length > 0 && (
          <>
            <p className="mb-2 text-sm font-medium">Velocidad frente al límite</p>
            <SpeedChart readings={[...mine.items].reverse()} limit={mine.maxSpeedKmh || maxSpeedKmh} />

            <p className="mb-2 mt-5 text-sm font-medium">Últimas lecturas</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="bg-paper text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Hora</th>
                    <th className="px-3 py-2 text-right font-semibold">Latitud</th>
                    <th className="px-3 py-2 text-right font-semibold">Longitud</th>
                    <th className="px-3 py-2 text-right font-semibold">Velocidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {mine.items.slice(0, rows).map((e) => (
                    <tr key={e.id}>
                      <td className="px-3 py-2 tabular-nums">{formatDateTime(e.recordedAt)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{e.lat.toFixed(4)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{e.lng.toFixed(4)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${e.speedKmh > mine.maxSpeedKmh ? "font-medium text-danger" : ""}`}>
                        {e.speedKmh} km/h{e.speedKmh > mine.maxSpeedKmh && " (excede)"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows < mine.items.length && (
              <button className={`${btnPrimary} mt-3`} onClick={() => setRows(mine.items.length)}>
                Ver las {mine.items.length} lecturas
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// Velocidad de las últimas lecturas (de la más antigua a la más reciente) con la línea del límite.
function SpeedChart({ readings, limit }: { readings: { id: number; recordedAt: string; speedKmh: number }[]; limit: number }) {
  const w = 640;
  const h = 200;
  const pad = { l: 40, r: 12, t: 12, b: 24 };
  const top = Math.max(limit * 1.25, ...readings.map((r) => r.speedKmh)) || 1;
  const x = (i: number) => pad.l + (readings.length === 1 ? (w - pad.l - pad.r) / 2 : (i / (readings.length - 1)) * (w - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / top) * (h - pad.t - pad.b);
  const over = readings.filter((r) => r.speedKmh > limit).length;
  const label = `Velocidad de ${readings.length} lecturas, de ${readings[0].speedKmh} a ${readings[readings.length - 1].speedKmh} km/h; ${over} superan el límite de ${limit} km/h.`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="block w-full" role="img" aria-label={label}>
      <line x1={pad.l} y1={y(0)} x2={w - pad.r} y2={y(0)} stroke="var(--color-line)" />
      <line x1={pad.l} y1={y(limit)} x2={w - pad.r} y2={y(limit)} stroke="var(--color-danger)" strokeDasharray="6 4" strokeWidth="1.5" />
      <text x={pad.l - 6} y={y(limit) + 4} textAnchor="end" fontSize="11" fill="var(--color-danger)">
        {limit}
      </text>
      <text x={pad.l - 6} y={y(0) + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)">
        0
      </text>
      <text x={pad.l - 6} y={y(top) + 12} textAnchor="end" fontSize="11" fill="var(--color-muted)">
        {Math.round(top)}
      </text>
      <text x={w - pad.r} y={y(limit) - 5} textAnchor="end" fontSize="11" fill="var(--color-danger)">
        límite (km/h)
      </text>
      <polyline fill="none" stroke="var(--color-brand)" strokeWidth="2" points={readings.map((r, i) => `${x(i)},${y(r.speedKmh)}`).join(" ")} />
      {readings.map((r, i) =>
        r.speedKmh > limit ? <circle key={r.id} cx={x(i)} cy={y(r.speedKmh)} r="4" fill="var(--color-danger)" /> : null,
      )}
      <text x={pad.l} y={h - 6} fontSize="11" fill="var(--color-muted)">
        {formatDateTime(readings[0].recordedAt)}
      </text>
      <text x={w - pad.r} y={h - 6} textAnchor="end" fontSize="11" fill="var(--color-muted)">
        {formatDateTime(readings[readings.length - 1].recordedAt)}
      </text>
    </svg>
  );
}
