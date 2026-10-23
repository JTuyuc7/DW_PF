import { startAlertScheduler } from "./alerts/engine";
import { app } from "./app";

// Barrido de reglas cada ALERT_INTERVAL_SECONDS (0 = solo bajo demanda, p. ej. en pruebas).
startAlertScheduler(Number(process.env.ALERT_INTERVAL_SECONDS ?? 60));

export default {
  port: Number(process.env.PORT ?? 4000),
  fetch: app.fetch,
};
