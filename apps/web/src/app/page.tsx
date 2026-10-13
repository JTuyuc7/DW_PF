import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6">
      <h1 className="text-4xl font-semibold tracking-tight">TransPort</h1>
      <p className="text-lg text-slate-600">
        Sala de ventas pública (en construcción). Aquí irá el catálogo de los seis giros del
        grupo.
      </p>
      <div>
        <Link
          href="/login"
          className="inline-block rounded-md bg-slate-900 px-5 py-2.5 text-white hover:bg-slate-700"
        >
          Ingresar
        </Link>
      </div>
    </main>
  );
}
