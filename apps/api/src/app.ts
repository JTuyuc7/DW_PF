import { Hono } from "hono";
import { cors } from "hono/cors";
import { notFound, onError } from "./errors";
import { assetRoutes } from "./routes/assets";
import { b2bRoutes } from "./routes/b2b";
import { alertRoutes, alertRuleRoutes } from "./routes/alerts";
import { authRoutes } from "./routes/auth";
import { gpsRoutes } from "./routes/gps";
import { inventoryRoutes } from "./routes/inventory";
import { meetingRoutes } from "./routes/meetings";
import { orderRoutes } from "./routes/orders";
import { publicRoutes } from "./routes/public";
import { reportRoutes } from "./routes/reports";
import type { AppEnv } from "./types";

export const app = new Hono<AppEnv>()
  .use("*", async (c, next) => {
    const requestId = crypto.randomUUID();
    c.set("requestId", requestId);
    c.header("X-Request-Id", requestId);
    await next();
  })
  .use("*", cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3000" }))
  .get("/health", (c) => c.json({ status: "ok" }))
  .route("/api/v1/auth", authRoutes)
  .route("/api/v1/public", publicRoutes)
  .route("/api/v1/orders", orderRoutes)
  .route("/api/v1/meetings", meetingRoutes)
  .route("/api/v1/reports", reportRoutes)
  .route("/api/v1/inventory", inventoryRoutes)
  .route("/api/v1/alerts", alertRoutes)
  .route("/api/v1/alert-rules", alertRuleRoutes)
  .route("/api/v1/gps", gpsRoutes)
  .route("/api/v1/assets", assetRoutes)
  .route("/api/v1/b2b", b2bRoutes);

app.onError(onError);
app.notFound(notFound);
