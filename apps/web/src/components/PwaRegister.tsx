"use client";

import { useEffect } from "react";

/** Registra el Service Worker (instalación y uso sin conexión). No hace nada si el navegador no lo admite. */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => console.warn("No se pudo registrar el Service Worker:", e));
  }, []);
  return null;
}
