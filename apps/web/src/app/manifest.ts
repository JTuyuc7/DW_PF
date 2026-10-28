import type { MetadataRoute } from "next";

// Colores de globals.css (--color-brand y --color-paper).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "TransPort",
    short_name: "TransPort",
    description: "Pedidos, inventario, flota y alertas de los seis giros de TransPort.",
    lang: "es",
    start_url: "/panel",
    scope: "/",
    display: "standalone",
    background_color: "#f2f3ef",
    theme_color: "#1d5a4a",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Pedidos", url: "/pedidos", icons: [{ src: "/icons/192", sizes: "192x192", type: "image/png" }] },
      { name: "Alertas", url: "/alertas", icons: [{ src: "/icons/192", sizes: "192x192", type: "image/png" }] },
      { name: "Flota", url: "/flota", icons: [{ src: "/icons/192", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
