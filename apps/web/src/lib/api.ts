const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type ErrorDetail = { field?: string; issue: string };

/** Error devuelto por la API con el formato de docs/05-datos-y-apis.md, sección 5.3. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: ErrorDetail[] = [],
  ) {
    super(message);
  }
}

const TOKEN_KEY = "token";

export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => sessionStorage.setItem(TOKEN_KEY, token);

export function clearSession() {
  sessionStorage.clear();
  // Los datos guardados para uso sin conexión son de quien tenía la sesión: se borran con ella.
  if (typeof caches !== "undefined") void caches.delete(DATA_CACHE).catch(() => {});
}

// ---------- Datos para uso sin conexión ----------
//
// Cada consulta (GET) correcta se guarda en la Cache API, separada por usuario. Si después falla la red, se responde
// con la última copia y se avisa para que la pantalla indique de cuándo son los datos. Los cambios (POST, PATCH) nunca
// se guardan ni se reintentan: sin conexión no se pueden hacer.

const DATA_CACHE = "tp-data-v1";

/** Evento que anuncia de dónde salieron los últimos datos: de la red o de la copia guardada. */
export const DATA_SOURCE_EVENT = "tp:data-source";
export type DataSource = { offline: false } | { offline: true; savedAt: number };

const announce = (detail: DataSource) => window.dispatchEvent(new CustomEvent<DataSource>(DATA_SOURCE_EVENT, { detail }));

// El usuario sale del campo `sub` del token; si no se puede leer, no se guarda nada.
function subjectOf(token: string | null): string | null {
  try {
    const payload = JSON.parse(atob(token!.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

function cacheRequest(token: string | null, auth: boolean, path: string): Request | null {
  if (typeof caches === "undefined") return null;
  const owner = auth ? subjectOf(token) : "publico";
  return owner ? new Request(`https://offline.invalid/${owner}${path}`) : null;
}

async function saveCopy(key: Request | null, data: unknown) {
  if (!key) return;
  try {
    const cache = await caches.open(DATA_CACHE);
    await cache.put(key, new Response(JSON.stringify(data), { headers: { "x-saved-at": String(Date.now()) } }));
  } catch {
    // Sin espacio o sin permiso: la aplicación sigue funcionando con la red.
  }
}

async function readCopy<T>(key: Request | null): Promise<{ data: T; savedAt: number } | null> {
  if (!key) return null;
  try {
    const hit = await (await caches.open(DATA_CACHE)).match(key);
    if (!hit) return null;
    return { data: (await hit.json()) as T, savedAt: Number(hit.headers.get("x-saved-at")) || Date.now() };
  } catch {
    return null;
  }
}

type Options = { method?: string; body?: unknown; auth?: boolean };

export async function api<T>(path: string, { method = "GET", body, auth = true }: Options = {}): Promise<T> {
  const token = auth ? getToken() : null;
  const key = method === "GET" ? cacheRequest(token, auth, path) : null;
  let res: Response;
  try {
    res = await fetch(`${API}/api/v1${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    const copy = await readCopy<T>(key);
    if (copy) {
      announce({ offline: true, savedAt: copy.savedAt });
      return copy.data;
    }
    throw new ApiError(0, "NETWORK", "No hay conexión con el servidor. Los cambios requieren estar en línea.");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // Una sesión vencida o inválida lleva siempre al inicio de sesión.
    if (res.status === 401 && auth) {
      clearSession();
      window.location.assign("/login");
    }
    const e = data?.error;
    throw new ApiError(res.status, e?.code ?? "UNKNOWN", e?.message ?? "Ocurrió un error inesperado", e?.details ?? []);
  }
  if (key) {
    announce({ offline: false });
    void saveCopy(key, data);
  }
  return data as T;
}
