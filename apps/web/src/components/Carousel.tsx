"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

/**
 * Carrusel horizontal con scroll-snap. Funciona con teclado (la pista es enfocable y se desplaza con las flechas),
 * con gestos táctiles y con los botones. No avanza solo: el movimiento automático dificulta la lectura.
 */
export function Carousel({ label, children }: { label: string; children: React.ReactNode[] }) {
  const track = useRef<HTMLUListElement>(null);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);

  // Ancho de una tarjeta más el espacio entre tarjetas: lo que avanza el carrusel con cada paso.
  const stepOf = (el: HTMLUListElement) =>
    el.children.length > 1 ? (el.children[1] as HTMLElement).offsetLeft - (el.children[0] as HTMLElement).offsetLeft : el.clientWidth;

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const step = stepOf(el);
    const visible = Math.max(1, Math.floor(el.clientWidth / step + 0.2));
    const positions = Math.max(1, el.children.length - visible + 1);
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    setPages(positions);
    setPage(atEnd ? positions - 1 : Math.min(positions - 1, Math.round(el.scrollLeft / step)));
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  function goTo(target: number) {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: target * stepOf(el), behavior: reduce ? "auto" : "smooth" });
  }

  const arrow =
    "grid size-10 place-items-center rounded-full border border-line bg-surface transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div role="region" aria-roledescription="carrusel" aria-label={label}>
      <ul
        ref={track}
        onScroll={measure}
        tabIndex={0}
        aria-label={`${label}: desplácese horizontalmente`}
        className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children.map((child, i) => (
          <li key={i} className="w-[85%] shrink-0 snap-start sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.67rem)]">
            {child}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between gap-4">
        <div className="flex gap-2" role="group" aria-label="Páginas del carrusel">
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Ir a la página ${i + 1} de ${pages}`}
              aria-current={i === page}
              className={`h-2 rounded-full transition-all ${i === page ? "w-6 bg-brand" : "w-2 bg-line hover:bg-muted"}`}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" className={arrow} onClick={() => goTo(page - 1)} disabled={page <= 0} aria-label="Anterior">
            <ChevronLeftIcon className="size-5" />
          </button>
          <button type="button" className={arrow} onClick={() => goTo(page + 1)} disabled={page >= pages - 1} aria-label="Siguiente">
            <ChevronRightIcon className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
