"use client";

import { useEffect, useState } from "react";
import { btnSecondary } from "@/lib/ui";

// Evento no estándar de Chromium; Safari no lo emite (allí se instala desde "Compartir → Añadir a pantalla de inicio").
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/** Botón "Instalar" que aparece solo cuando el navegador ofrece instalar la aplicación y aún no está instalada. */
export function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // se guarda para mostrarlo cuando la persona lo pida
      setPrompt(e as InstallPrompt);
    };
    const onInstalled = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!prompt) return null;
  return (
    <button
      className={`${btnSecondary} px-3 py-1.5`}
      onClick={async () => {
        await prompt.prompt();
        await prompt.userChoice;
        setPrompt(null); // el evento solo sirve una vez
      }}
    >
      Instalar aplicación
    </button>
  );
}
