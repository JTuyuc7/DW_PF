import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sin conexión | TransPort" };

// Página que el Service Worker muestra cuando se abre una pantalla que aún no estaba guardada y no hay red.
// Lleva sus estilos en línea: sin conexión, la hoja de estilos de la aplicación puede no estar disponible.
const colors = { brand: "#1d5a4a", ink: "#1b2320", muted: "#566259", paper: "#f2f3ef" };

export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        margin: 0,
        padding: "0 24px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        gap: 16,
        maxWidth: 448,
        marginInline: "auto",
        background: colors.paper,
        color: colors.ink,
        fontFamily: "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: colors.brand }}>TransPort</p>
      <h1 style={{ margin: 0, fontSize: 24 }}>Sin conexión</h1>
      <p style={{ margin: 0, color: colors.muted, lineHeight: 1.5 }}>
        No hay conexión a internet y esta pantalla todavía no estaba guardada en su dispositivo. Las pantallas que ya abrió se pueden consultar sin
        conexión; para hacer cambios necesita estar en línea.
      </p>
      <a
        href="/panel"
        style={{ background: colors.brand, color: "#fff", padding: "10px 16px", borderRadius: 6, fontSize: 14, fontWeight: 500, textDecoration: "none" }}
      >
        Reintentar
      </a>
    </main>
  );
}
