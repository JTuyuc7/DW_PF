import type { Metadata } from "next";
import Link from "next/link";
import { BoxIcon, GearIcon, MountainIcon, ShieldIcon, TruckIcon } from "@/components/icons";
import { Reveal } from "@/components/Reveal";
import { CHAIN } from "@/lib/content";
import { btnPrimary } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Nosotros | TransPort",
  description: "Un grupo guatemalteco de seis giros que se abastecen entre sí, con control propio por giro y flota monitoreada por GPS.",
};

const WAYS = [
  [
    ShieldIcon,
    "Control propio por giro",
    "Cada giro lleva su propio presupuesto y control de gastos, con su personal administrativo en cada sede.",
  ],
  [
    TruckIcon,
    "Flota monitoreada",
    "Cada camión y cada máquina cuenta con GPS que registra movimiento, tiempo de uso y, en camiones, velocidad.",
  ],
  [
    BoxIcon,
    "Abastecimiento entre giros",
    "Los giros se piden entre sí lo que necesitan, para evitar retrasos en la producción.",
  ],
] as const;

export default function AboutPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-14 md:pt-20">
        <p className="rise text-sm font-semibold uppercase tracking-widest text-brand">Nosotros</p>
        <h1 className="rise mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-balance md:text-5xl" style={{ animationDelay: "100ms" }}>
          Un grupo, seis giros, una sola cadena.
        </h1>
        <p className="rise mt-4 max-w-2xl text-lg text-muted" style={{ animationDelay: "200ms" }}>
          TransPort reúne varias empresas que dependen unas de otras: la extracción de materia prima, su
          transformación, la maquinaria, el transporte y la construcción.
        </p>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-2">
          <Reveal>
            <h2 className="text-2xl font-semibold">El grupo</h2>
            <div className="mt-3 flex flex-col gap-3 text-muted">
              <p>
                Las plantas de extracción minera están en Cobán, El Progreso, Quetzaltenango y Petén. Las de proceso
                de materia prima, en Zacapa, Huehuetenango y Petén, y producen pisos cerámicos y materiales de
                construcción.
              </p>
              <p>
                Venta y alquiler de maquinaria tiene sucursales en Guatemala, Quetzaltenango, Zacapa y Petén. El
                transporte atiende tanto a empresas que mueven materia prima como a quienes envían productos entre
                puertos, fronteras y bodegas. Los servicios de construcción cubren puentes, carreteras y edificios.
              </p>
              <p>Desde la sede central, en la Zona 10, se coordina y se lleva el registro contable y administrativo de todas las operaciones.</p>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <h2 className="text-2xl font-semibold">Cómo se conectan los giros</h2>
            <ol className="mt-4 flex flex-col gap-3">
              {CHAIN.map(([name, text], i) => (
                <li key={name} className="flex gap-4 rounded-lg border border-line bg-paper p-4">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold tabular-nums text-white">{i + 1}</span>
                  <div>
                    <p className="font-medium">{name}</p>
                    <p className="text-sm text-muted">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-3 flex items-start gap-2 text-sm text-muted">
              <MountainIcon className="mt-0.5 size-4 shrink-0 text-brand" />
              La planta de proceso se abastece de la extracción del grupo y también de terceros.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <Reveal>
          <h2 className="text-2xl font-semibold">Cómo trabajamos</h2>
        </Reveal>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {WAYS.map(([Icon, title, text], i) => (
            <li key={title}>
              <Reveal delay={i * 100} className="h-full rounded-lg border border-line bg-surface p-5">
                <span className="grid size-11 place-items-center rounded-lg bg-brand-soft text-brand">
                  <Icon />
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted">{text}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-brand-deep text-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 md:grid-cols-[1.4fr_1fr] md:items-center">
          <Reveal>
            <h2 className="flex items-center gap-2 text-2xl font-semibold">
              <GearIcon className="size-6" /> Sobre esta plataforma
            </h2>
            <p className="mt-3 text-white/80">
              Este sitio es parte de un proyecto académico de Desarrollo Web (UMG, 2026). TransPort es una empresa
              ficticia basada en modelos reales de Guatemala; los datos que se muestran son de ejemplo. La plataforma
              ya permite a los giros hacerse pedidos entre sí, con aprobación y seguimiento.
            </p>
          </Reveal>
          <Reveal delay={120} className="md:justify-self-end">
            <Link href="/login" className="inline-flex items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-medium text-brand-deep transition hover:bg-brand-soft">
              Iniciar sesión
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <Reveal className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">¿Hablamos?</h2>
          <Link href="/contacto" className={btnPrimary}>
            Ir a contacto
          </Link>
        </Reveal>
      </section>
    </>
  );
}
