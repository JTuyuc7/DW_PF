import { ApiError } from "@/lib/api";

/** Muestra un error de la API: el mensaje y, si los hay, el detalle por campo. */
export function ErrorNotice({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : "Ocurrió un error inesperado";
  const details = error instanceof ApiError ? error.details : [];
  return (
    <div role="alert" className="rounded-md border border-danger bg-danger-soft px-4 py-3 text-sm text-danger">
      <p className="font-medium">{message}</p>
      {details.length > 0 && (
        <ul className="mt-1 list-disc pl-5">
          {details.map((d, i) => (
            <li key={i}>{d.field ? `${d.field}: ${d.issue}` : d.issue}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
