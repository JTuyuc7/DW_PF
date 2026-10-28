import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "TransPort | Transporte, materiales y construcción en Guatemala",
  description:
    "Grupo empresarial con seis giros: extracción minera, proceso de materia prima, maquinaria, transporte de materia prima y de productos, y construcción.",
  applicationName: "TransPort",
  appleWebApp: { capable: true, title: "TransPort", statusBarStyle: "default" },
  icons: { icon: "/icons/192", apple: "/icons/apple" },
};

export const viewport: Viewport = {
  themeColor: "#1d5a4a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
