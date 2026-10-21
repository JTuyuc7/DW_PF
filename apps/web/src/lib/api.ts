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
export const clearSession = () => sessionStorage.clear();

type Options = { method?: string; body?: unknown; auth?: boolean };

export async function api<T>(path: string, { method = "GET", body, auth = true }: Options = {}): Promise<T> {
  const token = auth ? getToken() : null;
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
    throw new ApiError(0, "NETWORK", "No se pudo conectar con el servidor. Verifique que la API esté en ejecución.");
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
  return data as T;
}
