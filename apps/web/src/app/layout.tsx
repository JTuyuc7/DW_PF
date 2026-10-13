import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TransPort | Transporte, materiales y construcción en Guatemala",
  description:
    "Grupo empresarial con seis giros: extracción, procesamiento, transporte, alquiler de maquinaria, ventas y construcción.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
