// Solo para componentes de servidor. Desde el contenedor del frontend, "localhost" no es la API: en Docker se usa la red interna (API_INTERNAL_URL).
const BASE = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Lectura de contenido público desde el servidor. Devuelve null si la API no responde, para que la página degrade sin romperse. */
export async function publicGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}/api/v1${path}`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}
