import { redirect } from "next/navigation";

// Ruta anterior del panel; se conserva para no romper enlaces guardados.
export default function Dashboard() {
  redirect("/panel");
}
