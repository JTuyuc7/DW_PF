// Simulador del servicio GPS-Inversiones: envía lecturas a POST /gps/ingest con el contrato de docs/05, sección 6.
//
//   bun run gps:sim                          # una lectura por dispositivo cada 10 s, con excesos al azar
//   bun run gps:sim -- --once                # una sola ronda
//   bun run gps:sim -- --once GPS-TMP-01=110 # fuerza la velocidad de un dispositivo (km/h)
//   bun run gps:sim -- --every 5             # intervalo en segundos
//
// Los dispositivos son los del seed. Los datos son inventados.
const TOKEN = process.env.GPS_SERVICE_TOKEN;
if (!TOKEN) throw new Error("GPS_SERVICE_TOKEN no está definida (el script npm la toma de ../../.env)");
const API = `${process.env.API_URL ?? "http://localhost:4000"}/api/v1`;

const args = process.argv.slice(2);
const once = args.includes("--once");
const everyIdx = args.indexOf("--every");
const every = everyIdx >= 0 ? Number(args[everyIdx + 1]) : 10;
const forced = new Map(
  args.filter((a) => /^[\w-]+=\d+(\.\d+)?$/.test(a)).map((a) => [a.split("=")[0], Number(a.split("=")[1])] as const),
);

// Posición inicial aproximada por dispositivo (Guatemala); se desplazan un poco en cada ronda.
const devices: Record<string, { lat: number; lng: number; cruise: number }> = {
  "GPS-TMP-01": { lat: 15.47, lng: -90.37, cruise: 55 },
  "GPS-TMP-02": { lat: 14.97, lng: -89.53, cruise: 60 },
  "GPS-TPR-01": { lat: 14.63, lng: -90.51, cruise: 65 },
  "GPS-MAQ-01": { lat: 14.84, lng: -91.52, cruise: 8 },
  "GPS-EXT-01": { lat: 15.47, lng: -90.4, cruise: 6 },
};

const jitter = (n: number) => (Math.random() - 0.5) * n;

async function round() {
  const events = Object.entries(devices).map(([deviceId, d]) => {
    d.lat += jitter(0.004);
    d.lng += jitter(0.004);
    // Con ~12 % de probabilidad un camión se pasa del límite, salvo que se haya forzado el valor.
    const isTruck = d.cruise > 20;
    const speeding = isTruck && Math.random() < 0.12;
    const speedKmh = forced.get(deviceId) ?? Math.max(0, Math.round((speeding ? 95 + jitter(20) : d.cruise + jitter(14)) * 10) / 10);
    return { deviceId, recordedAt: new Date().toISOString(), lat: +d.lat.toFixed(6), lng: +d.lng.toFixed(6), speedKmh };
  });
  const res = await fetch(`${API}/gps/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Service-Token": TOKEN! },
    body: JSON.stringify({ events }),
  });
  const json: any = await res.json().catch(() => null);
  console.log(
    `${new Date().toLocaleTimeString()} -> ${res.status}`,
    events.map((e) => `${e.deviceId}:${e.speedKmh}`).join(" "),
    json?.rejected?.length ? `rechazadas: ${JSON.stringify(json.rejected)}` : "",
  );
  if (!res.ok) console.log(JSON.stringify(json));
}

await round();
if (!once) setInterval(() => round().catch((e) => console.error(e)), every * 1000);
