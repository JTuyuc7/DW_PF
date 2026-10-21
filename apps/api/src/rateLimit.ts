/**
 * Límite de uso en memoria por ventana deslizante. Sirve para un solo proceso (desarrollo y demostración);
 * en producción con varias instancias debe sustituirse por un almacén compartido o por el WAF.
 * Se consulta antes de procesar y se registra solo cuando la operación tuvo éxito.
 */
export function createRateLimiter(max: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();

  const recent = (key: string) => {
    const cutoff = now() - windowMs;
    const list = (hits.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length > 0) hits.set(key, list);
    else hits.delete(key);
    return list;
  };

  return {
    /** Segundos que debe esperar el cliente, o null si todavía puede intentar. Con `max` en 0 no limita. */
    retryAfter(key: string): number | null {
      if (max <= 0) return null;
      const list = recent(key);
      if (list.length < max) return null;
      return Math.max(1, Math.ceil((list[0] + windowMs - now()) / 1000));
    },
    record(key: string) {
      if (max <= 0) return;
      hits.set(key, [...recent(key), now()]);
    },
  };
}
