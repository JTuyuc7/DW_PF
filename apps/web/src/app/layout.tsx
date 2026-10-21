import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TransPort | Transporte, materiales y construcción en Guatemala",
  description:
    "Grupo empresarial con seis giros: extracción minera, proceso de materia prima, maquinaria, transporte de materia prima y de productos, y construcción.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
