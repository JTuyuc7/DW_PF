import type { Metadata } from "next";
import { PinIcon, MailIcon, UnitIcon } from "@/components/icons";
import { MeetingForm } from "@/components/MeetingForm";
import { Reveal } from "@/components/Reveal";
import { SITE } from "@/lib/content";
import { publicGet } from "@/lib/server-api";
import type { BusinessUnit } from "@/lib/types";

export const metadata: Metadata = {
  title: "Contacto | TransPort",
  description: "Sede central en la Zona 10 de la Ciudad de Guatemala y localidades donde opera cada giro del grupo.",
};

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const res = await publicGet<{ items: BusinessUnit[] }>("/public/business-units");
  const withSites = (res?.items ?? []).filter((u) => u.sites.length > 0);
  const localities = new Set(withSites.flatMap((u) => u.sites)).size;
  const units = (res?.items ?? []).map((u) => ({ id: u.id, name: u.name }));

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-14 md:pt-20">
        <p className="rise text-sm font-semibold uppercase tracking-widest text-brand">Contacto</p>
        <h1 className="rise mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-balance md:text-5xl" style={{ animationDelay: "100ms" }}>
          {localities > 0 ? `Estamos en la Zona 10 y en ${localities} localidades del país.` : "Estamos en la Zona 10 de la capital."}
        </h1>
        <p className="rise mt-4 max-w-2xl text-lg text-muted" style={{ animationDelay: "200ms" }}>
          Escríbanos a la sede central o ubique la sede del giro que le interesa.
        </p>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10 md:grid-cols-2">
          <Reveal className="flex gap-4 rounded-lg border border-line bg-paper p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
              <PinIcon />
            </span>
            <div>
              <h2 className="font-semibold">Sede central</h2>
              <p className="mt-1 text-sm text-muted">{SITE.address}</p>
              <p className="mt-2 text-sm text-muted">Coordinación, contabilidad y administración general del grupo, y reuniones con clientes.</p>
            </div>
          </Reveal>
          <Reveal delay={100} className="flex gap-4 rounded-lg border border-line bg-paper p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
              <MailIcon />
            </span>
            <div>
              <h2 className="font-semibold">Correo</h2>
              <p className="mt-1 text-sm">
                <a href={`mailto:${SITE.email}`} className="font-medium text-brand underline">
                  {SITE.email}
                </a>
              </p>
              <p className="mt-2 text-sm text-muted">Dirección de ejemplo: TransPort es una empresa ficticia y este buzón no existe.</p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <Reveal>
          <h2 className="text-2xl font-semibold">Sedes por giro</h2>
          <p className="mt-1 max-w-2xl text-muted">Localidades donde opera cada giro. Los giros de transporte y construcción no tienen sedes fijas registradas.</p>
        </Reveal>

        {withSites.length === 0 ? (
          <p role="status" className="mt-8 rounded-md border border-line bg-surface px-4 py-6 text-center text-sm text-muted">
            La lista de sedes no está disponible por ahora. Intente de nuevo en unos minutos.
          </p>
        ) : (
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {withSites.map((u, i) => (
              <li key={u.id}>
                <Reveal delay={i * 100} className="h-full rounded-lg border border-line bg-surface p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-lg bg-brand-soft text-brand">
                      <UnitIcon type={u.type} className="size-5" />
                    </span>
                    <h3 className="font-semibold">{u.name}</h3>
                  </div>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {u.sites.map((s) => (
                      <li key={s} className="rounded-full border border-line bg-paper px-3 py-1 text-sm">
                        {s}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              </li>
            ))}
          </ul>
        )}

      </section>

      <section id="reunion" className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 lg:grid-cols-[1fr_1.6fr]">
          <Reveal>
            <h2 className="text-2xl font-semibold">Solicite una reunión</h2>
            <p className="mt-2 text-muted">
              Cuéntenos qué necesita y elija el giro que le interesa. Le asignaremos un vendedor de ese giro, que le
              contactará para acordar la fecha.
            </p>
            <p className="mt-3 text-sm text-muted">Las reuniones se realizan en la sede central o por videoconferencia.</p>
          </Reveal>
          <Reveal delay={100}>
            {units.length > 0 ? (
              <MeetingForm units={units} />
            ) : (
              <p role="status" className="rounded-md border border-line bg-paper px-4 py-6 text-center text-sm text-muted">
                El formulario no está disponible por ahora. Intente de nuevo en unos minutos.
              </p>
            )}
          </Reveal>
        </div>
      </section>
    </>
  );
}
