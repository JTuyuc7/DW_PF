import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "./routes/auth";

export const app = new Hono()
  .use("*", cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3000" }))
  .get("/health", (c) => c.json({ status: "ok" }))
  .route("/api/v1/auth", authRoutes);
