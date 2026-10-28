// Service Worker de TransPort. Solo cubre la "cáscara" de la aplicación (páginas y recursos del mismo origen):
// permite abrirla sin conexión y mostrar una página de aviso cuando no hay nada guardado.
// Los datos de la API no pasan por aquí: los guarda la propia aplicación, por usuario (src/lib/api.ts).
//
// Estrategia: red primero con copia de respaldo. Es correcta tanto en producción como en desarrollo (donde los archivos
// no llevan hash en el nombre y una caché que prefiriera la copia serviría código viejo).
const VERSION = "v2";
const CACHE = `tp-shell-${VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icons/192"];
const MAX_ENTRIES = 120;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("tp-shell-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Qué se guarda: documentos (navegación) y recursos estáticos. Las solicitudes RSC de Next (navegación y precarga
// del enrutador) comparten URL con el documento pero devuelven otro formato: guardarlas serviría texto de flujo
// donde se espera HTML, así que no se interceptan. Tampoco el canal de recarga en caliente ni los flujos de eventos.
const STATIC_DESTINATIONS = ["style", "script", "font", "image"];
const skip = (request, url) =>
  request.method !== "GET" ||
  url.origin !== self.location.origin ||
  request.headers.has("rsc") ||
  request.headers.has("next-router-prefetch") ||
  url.pathname.startsWith("/_next/webpack-hmr") ||
  url.pathname.startsWith("/__nextjs") ||
  request.headers.get("accept")?.includes("text/event-stream") ||
  !(
    request.mode === "navigate" ||
    STATIC_DESTINATIONS.includes(request.destination) ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/")
  );

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length > MAX_ENTRIES) await Promise.all(keys.slice(0, keys.length - MAX_ENTRIES).map((k) => cache.delete(k)));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (skip(request, url)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        // Solo se guardan respuestas correctas del mismo origen.
        if (response.ok && response.type === "basic") {
          await cache.put(request, response.clone());
          void trim(cache);
        }
        return response;
      } catch {
        const cached = await cache.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          const offline = await cache.match(OFFLINE_URL);
          if (offline) return offline;
        }
        return Response.error();
      }
    })(),
  );
});
