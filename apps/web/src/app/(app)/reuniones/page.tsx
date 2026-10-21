"use client";

import { useEffect, useState } from "react";
import { ErrorNotice } from "@/components/ErrorNotice";
import { useSession } from "@/components/SessionProvider";
import { MeetingBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { MEETING_STATUS_LABEL, formatDate, formatDateTime, handlesMeetings } from "@/lib/format";
import { MEETING_STATUSES, type Meeting, type MeetingStatus, type Paged } from "@/lib/types";
import { btnDanger, btnPrimary, btnSecondary, input, panel } from "@/lib/ui";

const PAGE_SIZE = 20;

export default function MeetingsPage() {
  const { user } = useSession();
  const [status, setStatus] = useState<MeetingStatus | "">("solicitada");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<Meeting> | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0); // se incrementa para recargar la lista tras un cambio

  // Cada persona gestiona las reuniones que tiene asignadas y las de los giros que gerencia; el dueño solo las consulta.
  const manages = (m: Meeting) =>
    m.sellerUserId === user.id || user.memberships.some((x) => x.role === "gerente" && x.businessUnitId === m.businessUnitId);

  useEffect(() => {
    if (!handlesMeetings(user.memberships)) return;
    let cancelled = false;
    setLoading(true);
    api<Paged<Meeting>>(`/meetings?page=${page}&pageSize=${PAGE_SIZE}${status ? `&status=${status}` : ""}`)
      .then((d) => !cancelled && (setData(d), setError(null)))
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user, status, page, version]);

  if (!handlesMeetings(user.memberships)) {
    return (
      <div className="max-w-xl">
        <h1 className="text-xl font-semibold">Reuniones</h1>
        <p className="mt-2 text-sm text-muted">Su rol no atiende reuniones. Solo vendedores, gerentes y el dueño las consultan.</p>
      </div>
    );
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Reuniones</h1>
        <p className="text-sm text-muted">Solicitudes recibidas desde la sala de ventas.</p>
      </div>

      <div role="tablist" aria-label="Estado de las reuniones" className="flex flex-wrap gap-2">
        {(["", ...MEETING_STATUSES] as const).map((s) => (
          <button
            key={s || "todas"}
            role="tab"
            aria-selected={status === s}
            onClick={() => (setStatus(s), setPage(1))}
            className={status === s ? `${btnPrimary} py-1.5` : `${btnSecondary} py-1.5`}
          >
            {s ? MEETING_STATUS_LABEL[s] + "s" : "Todas"}
          </button>
        ))}
      </div>

      <ErrorNotice error={error} />

      <div aria-busy={loading} className="flex flex-col gap-3">
        {!data && loading && <p className="py-10 text-center text-sm text-muted">Cargando…</p>}
        {data?.items.length === 0 && (
          <p className={`${panel} px-4 py-10 text-center text-sm text-muted`}>No hay reuniones en este estado.</p>
        )}
        {data?.items.map((m) => (
          <MeetingCard key={m.id} meeting={m} canManage={manages(m)} onChanged={() => setVersion((v) => v + 1)} />
        ))}
      </div>

      {data && data.total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span className="tabular-nums">
            {data.total} {data.total === 1 ? "reunión" : "reuniones"} · página {data.page} de {pages}
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

function MeetingCard({ meeting: m, canManage, onChanged }: { meeting: Meeting; canManage: boolean; onChanged: () => void }) {
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [when, setWhen] = useState("");

  async function move(status: MeetingStatus, scheduledAt?: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/meetings/${m.id}/status`, { method: "PATCH", body: { status, scheduledAt } });
      onChanged();
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  return (
    <article className={`${panel} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {m.contactName} <span className="font-normal text-muted">· {m.company}</span>
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-4 text-sm">
            <a href={`mailto:${m.contactEmail}`} className="text-brand underline">
              {m.contactEmail}
            </a>
            <a href={`tel:${m.contactPhone.replace(/[^\d+]/g, "")}`} className="text-brand underline tabular-nums">
              {m.contactPhone}
            </a>
            {m.taxId && <span className="text-muted">NIT {m.taxId}</span>}
          </p>
        </div>
        <MeetingBadge status={m.status} />
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted">Giro de interés</dt>
          <dd>{m.businessUnitName}</dd>
        </div>
        <div>
          <dt className="text-muted">Vendedor</dt>
          <dd>{m.sellerName ?? <span className="text-warn">Sin asignar</span>}</dd>
        </div>
        <div>
          <dt className="text-muted">{m.scheduledAt ? "Reunión" : "Fecha preferida"}</dt>
          <dd className="tabular-nums">
            {m.scheduledAt ? formatDateTime(m.scheduledAt) : m.preferredDate ? formatDate(m.preferredDate) : "Sin preferencia"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Recibida</dt>
          <dd className="tabular-nums">{formatDateTime(m.createdAt)}</dd>
        </div>
      </dl>

      {m.message && <p className="mt-3 whitespace-pre-wrap break-words rounded-md bg-paper p-3 text-sm">{m.message}</p>}

      <ErrorNotice error={error} />

      {canManage && (m.status === "solicitada" || m.status === "confirmada") && (
        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-line pt-3">
          {m.status === "solicitada" &&
            (scheduling ? (
              <>
                <label className="flex flex-col gap-1 text-sm">
                  Fecha y hora de la reunión
                  <input
                    type="datetime-local"
                    value={when}
                    onChange={(e) => setWhen(e.target.value)}
                    className={`${input} tabular-nums`}
                  />
                </label>
                <button disabled={busy || !when} onClick={() => move("confirmada", new Date(when).toISOString())} className={btnPrimary}>
                  Confirmar
                </button>
                <button disabled={busy} onClick={() => setScheduling(false)} className={btnSecondary}>
                  Volver
                </button>
              </>
            ) : (
              <button disabled={busy} onClick={() => setScheduling(true)} className={btnPrimary}>
                Confirmar reunión
              </button>
            ))}
          {m.status === "confirmada" && (
            <button disabled={busy} onClick={() => move("realizada")} className={btnPrimary}>
              Marcar como realizada
            </button>
          )}
          {!scheduling && (
            <button disabled={busy} onClick={() => move("cancelada")} className={btnDanger}>
              Cancelar
            </button>
          )}
        </div>
      )}
    </article>
  );
}
