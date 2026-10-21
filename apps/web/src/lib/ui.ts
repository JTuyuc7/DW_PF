// Clases compartidas de Tailwind para controles que se repiten en las pantallas.

const btn =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

export const btnPrimary = `${btn} bg-brand text-white hover:bg-brand-deep`;
export const btnSecondary = `${btn} border border-line bg-surface hover:bg-brand-soft`;
export const btnDanger = `${btn} border border-danger text-danger hover:bg-danger-soft`;

export const input =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm placeholder:text-muted/70 disabled:bg-paper disabled:text-muted";

export const panel = "rounded-lg border border-line bg-surface";
export const panelTitle = "border-b border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted";
