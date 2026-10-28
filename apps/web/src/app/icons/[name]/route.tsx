import { ImageResponse } from "next/og";

// Íconos de la aplicación generados al vuelo (no hay imágenes con licencia; la marca es solo tipográfica).
// /icons/192 y /icons/512: normales; /icons/maskable: a sangre, con la marca dentro de la zona segura; /icons/apple: 180 px.
const SPECS: Record<string, { size: number; maskable: boolean }> = {
  "192": { size: 192, maskable: false },
  "512": { size: 512, maskable: false },
  maskable: { size: 512, maskable: true },
  apple: { size: 180, maskable: true },
};

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const spec = SPECS[(await params).name];
  if (!spec) return new Response("No encontrado", { status: 404 });

  const { size, maskable } = spec;
  // En los maskable el sistema recorta hasta el 20 % de los bordes: la marca ocupa el centro.
  const mark = Math.round(size * (maskable ? 0.4 : 0.52));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1d5a4a",
          borderRadius: maskable ? 0 : Math.round(size * 0.22),
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: mark * 1.5,
            height: mark * 1.5,
            borderRadius: mark,
            background: "#e1ede8",
            color: "#14423a",
            fontSize: mark,
            fontWeight: 800,
            letterSpacing: -mark / 12,
          }}
        >
          TP
        </div>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
