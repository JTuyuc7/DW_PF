"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ApiError, api, clearSession, getToken } from "@/lib/api";
import type { User } from "@/lib/types";

type Session = { user: User; logout: () => void };

const SessionContext = createContext<Session | null>(null);

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession debe usarse dentro de SessionProvider");
  return session;
}

/** Exige sesión: sin token redirige al login, y con token recarga las membresías desde la API. */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api<User>("/auth/me")
      .then(setUser)
      .catch((e) => {
        // El 401 ya redirige desde api(); aquí solo quedan fallos de conexión u otros.
        if (!(e instanceof ApiError && e.status === 401)) setError(e.message);
      });
  }, [router]);

  const logout = useCallback(() => {
    clearSession();
    router.push("/login");
  }, [router]);

  if (error) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <p role="alert" className="text-sm text-danger">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-sm font-medium text-brand underline">
          Reintentar
        </button>
      </main>
    );
  }
  if (!user) return <p className="px-4 py-20 text-center text-sm text-muted" aria-busy="true">Cargando…</p>;

  return <SessionContext.Provider value={{ user, logout }}>{children}</SessionContext.Provider>;
}
