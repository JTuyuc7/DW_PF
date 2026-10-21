"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthButton } from "@/components/AuthButton";
import { btnPrimary } from "@/lib/ui";

const LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/#giros", label: "Giros" },
  { href: "/nosotros", label: "Nosotros" },
  { href: "/contacto", label: "Contacto" },
];

export function PublicHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2.5">
        <Link href="/" className="text-sm font-semibold uppercase tracking-widest text-brand">
          TransPort
        </Link>
        <nav aria-label="Principal" className="order-last flex w-full gap-5 overflow-x-auto text-sm font-medium sm:order-none sm:w-auto">
          {LINKS.map((l) => {
            const active = l.href === pathname;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap border-b-2 py-1 transition ${active ? "border-brand text-brand" : "border-transparent hover:text-brand"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <AuthButton className={`${btnPrimary} ml-auto py-1.5`} />
      </div>
    </header>
  );
}
