"use client";

import { useState } from "react";
import { ErrorNotice } from "@/components/ErrorNotice";
import { api } from "@/lib/api";
import { dayGT } from "@/lib/format";
import { btnPrimary, btnSecondary, input } from "@/lib/ui";

type Unit = { id: number; name: string };

const label = "flex flex-col gap-1 text-sm font-medium";
const hint = "text-xs font-normal text-muted";

/** Formulario público de solicitud de reunión (P08). La API asigna el vendedor del giro elegido. */
export function MeetingForm({ units }: { units: Unit[] }) {
  const [error, setError] = useState<unknown>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSending(true);
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "");
    try {
      const res = await api<{ message: string }>("/public/meeting-requests", {
        method: "POST",
        auth: false,
        body: {
          name: text("name"),
          company: text("company"),
          taxId: text("taxId"),
          email: text("email"),
          phone: text("phone"),
          businessUnitId: Number(text("businessUnitId")),
          preferredDate: text("preferredDate"),
          message: text("message"),
          website: text("website"),
        },
      });
      setDone(res.message);
    } catch (err) {
      setError(err);
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="rounded-lg border border-brand bg-brand-soft p-6">
        <h3 className="text-lg font-semibold text-brand-deep">Solicitud enviada</h3>
        <p className="mt-1 text-sm">{done}</p>
        <button type="button" onClick={() => setDone(null)} className={`${btnSecondary} mt-4`}>
          Enviar otra solicitud
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 sm:p-6">
      <ErrorNotice error={error} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Nombre
          <input name="name" required minLength={2} maxLength={120} autoComplete="name" className={input} />
        </label>
        <label className={label}>
          Empresa <span className={hint}>(opcional)</span>
          <input name="company" maxLength={120} autoComplete="organization" className={input} />
        </label>
        <label className={label}>
          Correo
          <input name="email" type="email" required maxLength={160} autoComplete="email" className={input} />
        </label>
        <label className={label}>
          Teléfono
          <input name="phone" type="tel" required minLength={7} maxLength={20} autoComplete="tel" placeholder="5555-1234" className={input} />
        </label>
        <label className={label}>
          Giro de interés
          <select name="businessUnitId" required defaultValue="" className={input}>
            <option value="" disabled>
              Seleccionar…
            </option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          NIT <span className={hint}>(opcional)</span>
          <input name="taxId" maxLength={20} className={input} />
        </label>
        <label className={label}>
          Fecha preferida <span className={hint}>(opcional)</span>
          <input name="preferredDate" type="date" min={dayGT(0)} max={dayGT(180)} className={`${input} tabular-nums`} />
        </label>
      </div>

      <label className={label}>
        ¿Qué necesita?
        <textarea name="message" rows={4} maxLength={1000} placeholder="Cuéntenos brevemente su necesidad" className={input} />
      </label>

      {/* Campo trampa contra programas automáticos: las personas no lo ven ni lo llenan. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          No llenar este campo
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button disabled={sending || units.length === 0} className={btnPrimary}>
          {sending ? "Enviando…" : "Solicitar reunión"}
        </button>
        <p className="text-xs text-muted">Usaremos estos datos solo para contactarle sobre su solicitud.</p>
      </div>
    </form>
  );
}
