"use client";

import { useEffect, useMemo, useState } from "react";
import { ErrorNotice } from "@/components/ErrorNotice";
import { useSession } from "@/components/SessionProvider";
import { api } from "@/lib/api";
import { formatQty, isOwnerOf, panelUnits, unitSymbol } from "@/lib/format";
import type { InventoryList, InventoryRow } from "@/lib/types";
import { btnPrimary, btnSecondary, input, panel, panelTitle } from "@/lib/ui";

export default function InventoryPage() {
  const { user } = useSession();
  const owner = isOwnerOf(user.memberships);
  const units = panelUnits(user.memberships);
  const allowed = owner || units.length > 0;
  // El dueño consulta; solo operativos y gerentes del giro ajustan existencias.
  const canAdjust = (unitId: number) => units.some((u) => u.id === unitId);

  const [data, setData] = useState<InventoryList | null>(null);
  const [unitFilter, setUnitFilter] = useState<number | "">("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    setLoading(true);
    api<InventoryList>("/inventory")
      .then((d) => !cancelled && (setData(d), setError(null)))
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [allowed, version]);

  const unitOptions = useMemo(() => {
    const m = new Map<number, string>();
    data?.items.forEach((r) => m.set(r.businessUnitId, r.businessUnitName));
    return [...m];
  }, [data]);

  const rows = useMemo(
    () => (data?.items ?? []).filter((r) => (unitFilter === "" || r.businessUnitId === unitFilter) && (!onlyLow || r.belowMinimum)),
    [data, unitFilter, onlyLow],
  );
  const lowTotal = data?.items.filter((r) => r.belowMinimum).length ?? 0;

  // Se actualiza la fila en memoria con la respuesta del ajuste, sin recargar toda la lista.
  const applyUpdate = (u: Pick<InventoryRow, "siteId" | "productId" | "quantity" | "belowMinimum">) =>
    setData((d) =>
      d && {
        items: d.items.map((r) => (r.siteId === u.siteId && r.productId === u.productId ? { ...r, quantity: u.quantity, belowMinimum: u.belowMinimum } : r)),
      },
    );

  if (!allowed) {
    return (
      <div className="max-w-xl">
        <h1 className="text-xl font-semibold">Inventario</h1>
        <p className="mt-2 text-sm text-muted">Su rol no consulta el inventario. Lo hacen el dueño y los gerentes y operativos de cada giro.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Inventario</h1>
          <p className="text-sm text-muted">
            Existencias por sede y producto.{" "}
            {lowTotal > 0 ? `${lowTotal} por debajo del mínimo.` : "Todo por encima del mínimo."}
            {!owner && " Puede ajustar las existencias de sus giros (conteo físico, recepción de material)."}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {unitOptions.length > 1 && (
            <label className="flex flex-col gap-1 text-xs text-muted">
              Giro
              <select className={`${input} w-auto`} value={unitFilter} onChange={(e) => setUnitFilter(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Todos</option>
                {unitOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
            Solo bajo mínimo
          </label>
          <button onClick={() => setVersion((v) => v + 1)} disabled={loading} className={btnSecondary}>
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </div>

      <ErrorNotice error={error} />
      {!data && loading && <p className="py-10 text-center text-sm text-muted" aria-busy="true">Cargando…</p>}
      {data && rows.length === 0 && <p className={`${panel} px-4 py-10 text-center text-sm text-muted`}>No hay existencias con estos filtros.</p>}

      {rows.length > 0 && (
        <section className={panel}>
          <h2 className={panelTitle}>Existencias ({rows.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-paper text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-2 font-semibold">Sede</th>
                  <th className="px-4 py-2 font-semibold">Producto</th>
                  <th className="px-4 py-2 text-right font-semibold">Existencia</th>
                  <th className="px-4 py-2 text-right font-semibold">Mínimo</th>
                  <th className="px-4 py-2 font-semibold">Estado</th>
                  <th className="px-4 py-2 text-right font-semibold">Ajuste</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <Row key={`${r.siteId}-${r.productId}`} row={r} editable={canAdjust(r.businessUnitId)} onSaved={applyUpdate} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Row({
  row,
  editable,
  onSaved,
}: {
  row: InventoryRow;
  editable: boolean;
  onSaved: (u: Pick<InventoryRow, "siteId" | "productId" | "quantity" | "belowMinimum">) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const parsed = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(parsed) && parsed >= 0;

  async function save() {
    if (!valid) return;
    setSaving(true);
    try {
      const u = await api<Pick<InventoryRow, "siteId" | "productId" | "quantity" | "belowMinimum">>(`/inventory/${row.siteId}/${row.productId}`, {
        method: "PATCH",
        body: { quantity: parsed },
      });
      onSaved(u);
      setEditing(false);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="align-top">
      <td className="px-4 py-2.5">
        <span className="block font-medium">{row.siteName}</span>
        <span className="block text-xs text-muted">{row.businessUnitName}</span>
      </td>
      <td className="px-4 py-2.5">{row.productName}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">{formatQty(row.quantity, row.unit)}</td>
      <td className="px-4 py-2.5 text-right tabular-nums text-muted">{formatQty(row.minThreshold, row.unit)}</td>
      <td className="px-4 py-2.5">
        <span
          className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${row.belowMinimum ? "border-danger bg-danger-soft text-danger" : "border-brand bg-brand-soft text-brand"}`}
        >
          {row.belowMinimum ? "Bajo mínimo" : "Suficiente"}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right">
        {!editable ? (
          <span className="text-xs text-muted">Solo consulta</span>
        ) : editing ? (
          <form
            className="flex flex-col items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="flex items-center gap-2">
              <input
                className={`${input} w-28 text-right`}
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-label={`Nueva existencia de ${row.productName} en ${row.siteName} (${unitSymbol(row.unit)})`}
              />
              <span className="text-xs text-muted">{unitSymbol(row.unit)}</span>
            </div>
            <div className="flex gap-2">
              <button type="submit" className={btnPrimary} disabled={!valid || saving}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
              <button type="button" className={btnSecondary} disabled={saving} onClick={() => (setEditing(false), setError(null))}>
                Cancelar
              </button>
            </div>
            <ErrorNotice error={error} />
          </form>
        ) : (
          <button
            className={btnSecondary}
            onClick={() => {
              setValue(String(row.quantity));
              setEditing(true);
            }}
          >
            Ajustar
          </button>
        )}
      </td>
    </tr>
  );
}