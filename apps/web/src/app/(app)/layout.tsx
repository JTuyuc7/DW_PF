"use client";

import Link from "next/link";
import { SessionProvider, useSession } from "@/components/SessionProvider";
import { describeMembership, handlesMeetings, hasPanel } from "@/lib/format";

function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useSession();
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/panel" className="text-sm font-semibold uppercase tracking-widest text-brand">
            TransPort
          </Link>
          <nav aria-label="Principal" className="flex gap-4 text-sm font-medium">
            {hasPanel(user.memberships) && (
              <Link href="/panel" className="hover:text-brand">
                Panel
              </Link>
            )}
            <Link href="/pedidos" className="hover:text-brand">
              Pedidos
            </Link>
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
