import type { Metadata } from "next";
import Link from "next/link";
import { AuthButton } from "@/components/AuthButton";
import { Carousel } from "@/components/Carousel";
import { UnitIcon } from "@/components/icons";
import { Reveal } from "@/components/Reveal";
import { SupplyChainArt } from "@/components/SupplyChainArt";
import { CHAIN } from "@/lib/content";
import { publicGet } from "@/lib/server-api";
import type { BusinessUnit, PublicProduct } from "@/lib/types";
import { btnPrimary, btnSecondary } from "@/lib/ui";

export const metadata: Metadata = {
  title: "TransPort | Del yacimiento a la obra",
  description:
    "Grupo empresarial guatemalteco con seis giros que se abastecen entre sí: extracción minera, proceso de materia prima, maquinaria, transporte y construcción.",
};

// Se renderiza en cada solicitud para mostrar siempre el catálogo vigente.
export const dynamic = "force-dynamic";

const delay = (ms: number) => ({ animationDelay: `${ms}ms` });

export default async function Home() {
  const [unitsRes, productsRes] = await Promise.all([
    publicGet<{ items: BusinessUnit[] }>("/public/business-units"),
    publicGet<{ items: PublicProduct[] }>("/public/products"),
  ]);
  const units = unitsRes?.items ?? [];
  const products = productsRes?.items ?? [];

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-14 md:pt-20">
        <div className="grid gap-10 md:grid-cols-[1.3fr_1fr] md:items-center">
          <div>
            <p className="rise text-sm font-semibold uppercase tracking-widest text-brand">Grupo empresarial · Guatemala</p>
            <h1 className="rise mt-3 text-4xl font-semibold leading-tight tracking-tight text-balance md:text-5xl" style={delay(100)}>
              Del yacimiento a la obra.
            </h1>
            <p className="rise mt-4 max-w-xl text-lg text-muted" style={delay(200)}>
              TransPort reúne seis giros que se abastecen entre sí: extracción minera, proceso de materia prima,
              maquinaria, transporte de materia prima y de productos, y construcción. Sede central en la Zona 10.
            </p>
            <div className="rise mt-7 flex flex-wrap gap-3" style={delay(300)}>
              <Link href="/contacto#reunion" className={btnPrimary}>
                Solicitar una reunión
              </Link>
              <a href="#giros" className={btnSecondary}>
                Conocer los giros
              </a>
            </div>
          </div>

          <aside aria-labelledby="cadena" className="rise rounded-lg border border-line bg-surface p-5" style={delay(400)}>
            <h2 id="cadena" className="text-xs font-semibold uppercase tracking-wider text-muted">
              Así se abastecen los giros
            </h2>
            <ol className="mt-4 flex flex-col">
              {CHAIN.map(([name, text], i) => (
                <li key={name} className="relative flex gap-4 pb-5 last:pb-0">
                  {i < CHAIN.length - 1 && <span aria-hidden className="absolute left-[0.8rem] top-8 h-[calc(100%-1.5rem)] w-px bg-line" />}
                  <span className="z-10 grid size-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-semibold tabular-nums text-white">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium">{name}</p>
                    <p className="text-sm text-muted">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-5 border-t border-line pt-4 text-sm text-muted">
              Maquinaria y construcción completan la oferta con equipo en alquiler y obra civil.
            </p>
          </aside>
        </div>

        <div className="rise mt-12 overflow-hidden rounded-t-lg" style={delay(500)}>
          <SupplyChainArt className="block h-auto w-full" />
        </div>
      </section>

      <section id="giros" className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <Reveal>
            <h2 className="text-2xl font-semibold">Nuestros giros</h2>
            <p className="mt-1 max-w-2xl text-muted">Productos y servicios que ofrece cada empresa del grupo.</p>
          </Reveal>

          {units.length === 0 ? (
            <p role="status" className="mt-8 rounded-md border border-line bg-paper px-4 py-6 text-center text-sm text-muted">
              El catálogo no está disponible por ahora. Intente de nuevo en unos minutos.
            </p>
          ) : (
            <Reveal className="mt-8">
              <Carousel label="Giros del grupo">
                {units.map((u) => {
                  const own = products.filter((p) => p.businessUnitId === u.id);
                  return (
                    <article
                      key={u.id}
                      className="flex h-full flex-col rounded-lg border border-line bg-paper p-5 transition duration-200 hover:-translate-y-1 hover:shadow-md"
                    >
                      <span className="grid size-11 place-items-center rounded-lg bg-brand-soft text-brand">
                        <UnitIcon type={u.type} />
                      </span>
                      <h3 className="mt-4 font-semibold">{u.name}</h3>
                      <p className="mt-1 text-sm text-muted">{u.description}</p>
                      {own.length > 0 && (
                        <ul className="mt-4 divide-y divide-line border-t border-line text-sm">
                          {own.map((p) => (
                            <li key={p.id} className="flex items-baseline justify-between gap-3 py-2">
                              <span>{p.name}</span>
                              <span className="shrink-0 text-xs text-muted">por {p.unit === "m2" ? "m²" : p.unit}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>
                  );
                })}
              </Carousel>
            </Reveal>
          )}
        </div>
      </section>

      <section id="personal" className="bg-brand-deep text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-[1fr_1.4fr] md:items-center">
          <Reveal>
            <h2 className="text-2xl font-semibold">Para el personal del grupo</h2>
            <p className="mt-2 text-white/80">Ingrese con su cuenta para trabajar con los pedidos de su giro.</p>
            <AuthButton className="mt-6 inline-flex items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-medium text-brand-deep transition hover:bg-brand-soft" />
          </Reveal>
          <ul className="grid gap-4 sm:grid-cols-3">
            {[
              ["Pedidos entre giros", "Un giro solicita a otro, con aprobación, seguimiento de estados y mensajes."],
              ["Permisos por giro y rol", "Cada persona ve y hace solo lo que corresponde a su cargo."],
              ["Existencias a la vista", "Al pedir se consulta lo disponible en el giro proveedor."],
            ].map(([title, text], i) => (
              <li key={title}>
                <Reveal delay={i * 100} className="h-full rounded-lg border border-white/20 p-4">
                  <h3 className="font-medium">{title}</h3>
                  <p className="mt-1 text-sm text-white/75">{text}</p>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <Reveal className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line bg-surface p-6">
          <div>
            <h2 className="text-lg font-semibold">¿Quiere saber más del grupo?</h2>
            <p className="text-sm text-muted">Conozca cómo trabajamos o solicite una reunión con un vendedor.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/nosotros" className={btnSecondary}>
              Nosotros
            </Link>
            <Link href="/contacto#reunion" className={btnPrimary}>
              Solicitar una reunión
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
