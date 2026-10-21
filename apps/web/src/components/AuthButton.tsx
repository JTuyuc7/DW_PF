"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getToken } from "@/lib/api";

/** Lleva al inicio de sesión, o a la aplicación si ya hay una sesión abierta en este navegador. */
export function AuthButton({ className }: { className: string }) {
  // El primer render coincide con el del servidor; la sesión solo se conoce en el navegador.
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => setSignedIn(Boolean(getToken())), []);

  return signedIn ? (
    <Link href="/panel" className={className}>
      Ir a la aplicación
    </Link>
  ) : (
    <Link href="/login" className={className}>
      Iniciar sesión
    </Link>
  );
}
