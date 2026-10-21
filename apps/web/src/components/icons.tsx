// Iconos de línea de 24x24 dibujados con formas simples. Heredan el color del texto (currentColor).

type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? "size-6"}
    >
      {children}
    </svg>
  );
}

export const MountainIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 20 9 8.5l4 6.5 2.5-3.5L21.5 20z" />
    <path d="m7 12 2 1.5L11 12" />
  </Svg>
);

export const FactoryIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 21V11l6 4v-4l6 4V6h4v15z" />
    <path d="M7 18h2M12 18h2M17 18h.01" />
  </Svg>
);

export const GearIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="5.5" />
    <circle cx="12" cy="12" r="2" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
  </Svg>
);

export const TruckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 6h12v10H2zM14 9h4l3 3v4h-7z" />
    <circle cx="7" cy="18" r="2" />
    <circle cx="17" cy="18" r="2" />
  </Svg>
);

export const BoxIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m3 8 9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8" />
  </Svg>
);

export const BuildingIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 21V7h9v14M13 21V11h7v10M2 21h20" />
    <path d="M7 10h3M7 14h3M7 18h3M16 14h1M16 18h1" />
  </Svg>
);

export const PinIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </Svg>
);

export const MailIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </Svg>
);

export const ShieldIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 4.5 6v5.5c0 4.5 3 8 7.5 9.5 4.5-1.5 7.5-5 7.5-9.5V6z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m15 5-7 7 7 7" />
  </Svg>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 5 7 7-7 7" />
  </Svg>
);

/** Icono de cada tipo de giro (campo `type` de la API). */
export function UnitIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case "extraccion":
      return <MountainIcon className={className} />;
    case "proceso":
      return <FactoryIcon className={className} />;
    case "maquinaria":
      return <GearIcon className={className} />;
    case "transporte_materia":
      return <TruckIcon className={className} />;
    case "transporte_producto":
      return <BoxIcon className={className} />;
    case "construccion":
      return <BuildingIcon className={className} />;
    default:
      return <FactoryIcon className={className} />;
  }
}
