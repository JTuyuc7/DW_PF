import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Por defecto Next 15 transmite los metadatos dentro de <body>, y los navegadores solo reconocen
  // <link rel="manifest"> en <head>: sin esto la aplicación no sería instalable. Se pide el modo bloqueante para todos.
  htmlLimitedBots: /.*/,
  async headers() {
    return [
      {
        // El Service Worker debe revisarse siempre en la red para que las actualizaciones lleguen.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
