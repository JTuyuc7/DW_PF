"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type User = { name: string; email: string; role: string };

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("user");
    if (!raw) return router.replace("/login");
    setUser(JSON.parse(raw));
  }, [router]);

  if (!user) return null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Hola, {user.name}</h1>
      <p className="mt-2 text-slate-600">
        Rol: <span className="font-medium">{user.role}</span>. El dashboard consolidado se
        construirá aquí.
      </p>
      <button
        onClick={() => {
          sessionStorage.clear();
          router.push("/login");
        }}
        className="mt-6 rounded-md border border-slate-300 px-4 py-2 hover:bg-slate-100"
      >
        Cerrar sesión
      </button>
    </main>
  );
}
