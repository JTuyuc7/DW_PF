import { MEETING_STATUS_LABEL, STATUS_LABEL } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";

const STYLE: Record<OrderStatus, string> = {
  borrador: "bg-slate-200 text-slate-800",
  solicitado: "bg-amber-100 text-amber-900",
  aprobado: "bg-teal-100 text-teal-900",
  en_proceso: "bg-sky-100 text-sky-900",
  despachado: "bg-indigo-100 text-indigo-900",
  entregado: "bg-emerald-100 text-emerald-900",
  cancelado: "bg-red-100 text-red-900",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function OverdueTag() {
  return (
    <span className="inline-block whitespace-nowrap rounded-full border border-danger px-2 py-0.5 text-xs font-medium text-danger">
      Retrasado
    </span>
  );
}

const MEETING_STYLE = {
  solicitada: "bg-amber-100 text-amber-900",
  confirmada: "bg-teal-100 text-teal-900",
  realizada: "bg-emerald-100 text-emerald-900",
  cancelada: "bg-red-100 text-red-900",
} as const;

export function MeetingBadge({ status }: { status: keyof typeof MEETING_STYLE }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${MEETING_STYLE[status]}`}>
      {MEETING_STATUS_LABEL[status]}
    </span>
  );
}
