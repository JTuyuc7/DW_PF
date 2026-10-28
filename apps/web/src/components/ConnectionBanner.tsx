"use client";

import { useEffect, useState } from "react";
import { DATA_SOURCE_EVENT, type DataSource } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

/** Avisa cuando no hay conexión o cuando lo que se ve viene de la copia guardada, para no confundirlo con datos al día. */
export function ConnectionBanner() {
  const [online, setOnline] = useState(true);
  const [source, setSource] = useState<DataSource>({ offline: false });

  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    const onSource = (e: Event) => setSource((e as CustomEvent<DataSource>).detail);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    window.addEventListener(DATA_SOURCE_EVENT, onSource);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      window.removeEventListener(DATA_SOURCE_EVENT, onSource);
    };
  }, []);

  if (online && !source.offline) return null;
  return (
    <div role="status" className="border-b border-warn bg-warn-soft px-4 py-2 text-center text-sm text-warn">
      {source.offline
        ? `Sin conexión con el servidor. Datos guardados el ${formatDateTime(new Date(source.savedAt).toISOString())}; los cambios no están disponibles.`
        : "Sin conexión a internet. Verá los últimos datos guardados y no podrá hacer cambios hasta recuperarla."}
    </div>
  );
}
