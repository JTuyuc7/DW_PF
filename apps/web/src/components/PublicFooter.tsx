import Link from "next/link";
import { SITE } from "@/lib/content";

export function PublicFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-brand">TransPort</p>
          <p className="mt-2 max-w-xs text-sm text-muted">
            Seis giros que se abastecen entre sí, de la extracción minera a la construcción.
          </p>
        </div>
        <nav aria-label="Secciones">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Explorar</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            <li><Link href="/#giros" className="hover:text-brand">Giros</Link></li>
            <li><Link href="/nosotros" className="hover:text-brand">Nosotros</Link></li>
            <li><Link href="/contacto" className="hover:text-brand">Contacto</Link></li>
            <li><Link href="/login" className="hover:text-brand">Iniciar sesión</Link></li>
          </ul>
        </nav>
        <nav aria-label="Información legal">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Legal</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            <li><Link href="/legal" className="hover:text-brand">Aviso legal y derechos de autor</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-4 text-xs text-muted">
          <p>© 2026 {SITE.name}. Todos los derechos reservados.</p>
          <p>Proyecto académico de Desarrollo Web, UMG. TransPort es una empresa ficticia.</p>
        </div>
      </div>
    </footer>
  );
}
