"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorNotice } from "@/components/ErrorNotice";
import { api, setToken } from "@/lib/api";
import type { User } from "@/lib/types";
import { btnPrimary, input } from "@/lib/ui";

// Solo en desarrollo: atajos para recorrer el flujo con distintos roles (la contraseña es SEED_PASSWORD).
const DEMO_USERS = [
  ["operativo@transport.gt", "Operativo de Proceso"],
  ["gerente@transport.gt", "Gerente de Extracción"],
  ["operativo.extraccion@transport.gt", "Operativo de Extracción"],
  ["gerente.proceso@transport.gt", "Gerente de Proceso"],
  ["dueno@transport.gt", "Dueño"],
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const data = await api<{ token: string; user: User }>("/auth/login", {
        method: "POST",
        auth: false,
        body: { email: form.get("email"), password: form.get("password") },
      });
      setToken(data.token);
      router.push("/panel");
    } catch (err) {
      setError(err);
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">TransPort</p>
        <h1 className="mt-1 text-2xl font-semibold">Ingresar</h1>
        <p className="mt-1 text-sm text-muted">Acceso para el personal de los giros y la sede central.</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <ErrorNotice error={error} />
        <label className="flex flex-col gap-1 text-sm font-medium">
          Correo
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre@empresa.com"
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Contraseña
          <input name="password" type="password" required autoComplete="current-password" className={input} />
        </label>
        <button disabled={loading} className={btnPrimary}>
          {loading ? "Ingresando…" : "Ingresar"}
        </button>
      </form>

      {process.env.NODE_ENV !== "production" && (
        <details className="rounded-md border border-line bg-surface text-sm">
          <summary className="cursor-pointer px-3 py-2 font-medium">Usuarios de demostración</summary>
          <ul className="border-t border-line p-1">
            {DEMO_USERS.map(([mail, label]) => (
              <li key={mail}>
                <button
                  type="button"
                  onClick={() => setEmail(mail)}
                  className="flex w-full flex-col rounded px-2 py-1.5 text-left hover:bg-brand-soft"
                >
                  <span className="font-medium">{label}</span>
                  <span className="text-xs text-muted">{mail}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Link href="/" className="text-sm font-medium text-brand underline">
        Volver al inicio
      </Link>
    </main>
  );
}
