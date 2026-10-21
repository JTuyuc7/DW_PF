// Ilustración decorativa de la cadena: cantera, planta, camión en ruta y obra con grúa.
// Se dibuja con formas básicas y usa los colores del tema; sustituible por fotografías reales.

export function SupplyChainArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 800 300" role="img" aria-label="Ilustración: cantera, planta de proceso, camión en la carretera y una obra en construcción" className={className}>
      {/* Lomas del fondo */}
      <polygon className="fill-brand-soft" points="0,300 0,190 90,140 170,185 260,110 350,180 430,150 520,200 610,160 700,205 800,170 800,300" />

      {/* Cantera */}
      <polygon className="fill-brand" opacity="0.85" points="30,262 30,232 110,152 150,176 190,120 250,215 262,262" />
      <g className="stroke-surface" strokeWidth="2" opacity="0.8">
        <line x1="112" y1="190" x2="176" y2="190" />
        <line x1="96" y1="216" x2="204" y2="216" />
        <line x1="70" y1="240" x2="236" y2="240" />
      </g>

      {/* Planta de proceso */}
      <g className="fill-brand-deep">
        <rect x="300" y="200" width="150" height="62" />
        <polygon points="300,200 300,172 335,200 335,172 370,200 370,172 405,200 405,172 440,200" />
        <rect x="452" y="150" width="16" height="112" />
      </g>
      <g className="fill-brand-soft">
        <rect x="315" y="218" width="18" height="14" />
        <rect x="345" y="218" width="18" height="14" />
        <rect x="375" y="218" width="18" height="14" />
        <rect x="405" y="218" width="18" height="14" />
      </g>
      <g className="fill-line">
        <circle className="art-smoke" cx="460" cy="142" r="9" />
        <circle className="art-smoke" cx="466" cy="128" r="11" style={{ animationDelay: "1.7s" }} />
        <circle className="art-smoke" cx="458" cy="116" r="8" style={{ animationDelay: "3.3s" }} />
      </g>

      {/* Obra con grúa */}
      <rect className="fill-brand-deep" x="600" y="190" width="90" height="72" />
      <g className="stroke-brand-soft" strokeWidth="2">
        <line x1="600" y1="214" x2="690" y2="214" />
        <line x1="600" y1="238" x2="690" y2="238" />
        <line x1="630" y1="190" x2="630" y2="262" />
        <line x1="660" y1="190" x2="660" y2="262" />
      </g>
      <g className="fill-warn">
        <rect x="716" y="108" width="8" height="154" />
        <rect x="646" y="108" width="122" height="6" />
        <rect x="746" y="104" width="18" height="14" />
        <rect x="660" y="176" width="12" height="10" />
      </g>
      <line className="stroke-ink" x1="666" y1="114" x2="666" y2="176" strokeWidth="1.5" />

      {/* Carretera */}
      <rect className="fill-ink" x="0" y="262" width="800" height="38" />
      <line className="stroke-surface" x1="0" y1="281" x2="800" y2="281" strokeWidth="3" strokeDasharray="22 16" />

      {/* Camión (avanza de izquierda a derecha) */}
      <g transform="translate(0 232)">
        <g className="art-truck">
          <rect className="fill-brand" x="0" y="0" width="74" height="28" />
          <rect className="fill-brand-deep" x="76" y="8" width="26" height="20" />
          <rect className="fill-brand-soft" x="92" y="11" width="8" height="8" />
          <g className="fill-ink stroke-surface" strokeWidth="2">
            <circle cx="12" cy="30" r="6" />
            <circle cx="52" cy="30" r="6" />
            <circle cx="90" cy="30" r="6" />
          </g>
        </g>
      </g>
    </svg>
  );
}
