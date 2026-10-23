"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SessionProvider, useSession } from "@/components/SessionProvider";
import { api } from "@/lib/api";
import { describeMembership, handlesMeetings, hasPanel, isOwnerOf, receivesAlerts } from "@/lib/format";
import type { AlertList } from "@/lib/types";

// Alertas abiertas para la insignia de la barra; se refresca al navegar y cada minuto. Un fallo no molesta: sin insignia.
function useOpenAlerts(enabled: boolean) {
  const pathname = usePathname();
  const [open, setOpen] = useState<{ total: number; critica: number } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = () =>
      api<AlertList>("/alerts?pageSize=1")
        .then((d) => !cancelled && setOpen(d.open))
        .catch(() => {});
    void load();
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, pathname]);
  return open;
}

function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useSession();
  const alertsEnabled = receivesAlerts(user.memberships);
  const open = useOpenAlerts(alertsEnabled);
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/panel" className="text-sm font-semibold uppercase tracking-widest text-brand">
            TransPort
          </Link>
          <nav aria-label="Principal" className="flex gap-4 text-sm font-medium">
            {isOwnerOf(user.memberships) && (
              <Link href="/resumen" className="hover:text-brand">
                Resumen
              </Link>
            )}
            {!isOwnerOf(user.memberships) && hasPanel(user.memberships) && (
              <Link href="/panel" className="hover:text-brand">
                Panel
              </Link>
            )}
            <Link href="/pedidos" className="hover:text-brand">
              Pedidos
            </Link>
            {alertsEnabled && (
              <Link href="/flota" className="hover:text-brand">
                Flota
              </Link>
            )}
            {alertsEnabled && (
              <Link href="/alertas" className="hover:text-brand">
                Alertas
                {open && open.total > 0 && (
                  <span
                    className={`ml-1.5 inline-block min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums text-white ${open.critica > 0 ? "bg-danger" : "bg-warn"}`}
                  >
                    <span className="sr-only">{open.critica > 0 ? `${open.total} abiertas, ${open.critica} críticas` : `${open.total} abiertas`}</span>
                    <span aria-hidden="true">{open.total}</span>
                  </span>
                )}
              </Link>
            )}
            {handlesMeetings(user.memberships) && (
              <Link href="/reuniones" className="hover:text-brand">
                Reuniones
              </Link>
            )}
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <div className="text-right leading-tight">
              <p className="font-medium">{user.name}</p>
              <p className="text-xs text-muted">
                {user.memberships.length === 0 ? "Sin roles asignados" : user.memberships.map(describeMembership).join(" · ")}
              </p>
            </div>
            <button onClick={logout} className="rounded-md border border-line px-3 py-1.5 hover:bg-brand-soft">
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Shell>{children}</Shell>
    </SessionProvider>
  );
}
