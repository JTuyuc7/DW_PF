import type { Metadata } from "next";
import { SITE } from "@/lib/content";

export const metadata: Metadata = {
  title: "Aviso legal y derechos de autor | TransPort",
  description: "Titularidad del contenido, naturaleza académica del proyecto y tratamiento de datos de este sitio.",
};

const SECTIONS: [string, string[]][] = [
  [
    "Derechos de autor",
    [
      "© 2026 TransPort. El diseño, los textos, las ilustraciones, los iconos y el código de este sitio fueron creados por Jaime Tuyuc como proyecto final del curso de Desarrollo Web de la Universidad Mariano Gálvez (UMG).",
      "No se autoriza su reproducción o distribución con fines comerciales sin permiso del autor. Se permite su consulta y su uso con fines educativos citando la fuente.",
    ],
  ],
  [
    "Naturaleza del proyecto",
    [
      "TransPort es una empresa ficticia, basada en modelos reales de Guatemala. Los nombres, productos, sedes, correos y datos que aparecen en el sitio y en la plataforma son de ejemplo y no representan operaciones, precios ni compromisos reales.",
      "Cualquier parecido con una empresa, persona o dirección real es coincidencia.",
    ],
  ],
  [
    "Datos personales y cookies",
    [
      "El sitio público no solicita datos personales a quien lo visita. No utiliza cookies de seguimiento ni herramientas de analítica.",
      "La plataforma interna guarda un identificador de sesión en el navegador (almacenamiento de sesión) mientras la persona permanece conectada, y lo elimina al cerrar la sesión o la pestaña.",
    ],
  ],
  [
    "Contenido de terceros",
    ["No se incluyen fotografías, marcas ni textos de terceros. Las ilustraciones y los iconos son originales de este proyecto."],
  ],
  [
    "Consultas",
    [`Para consultas sobre este aviso, escriba a ${SITE.email} (dirección de ejemplo).`],
  ],
];

export default function LegalPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 pb-16 pt-14 md:pt-20">
      <p className="rise text-sm font-semibold uppercase tracking-widest text-brand">Legal</p>
      <h1 className="rise mt-3 text-3xl font-semibold tracking-tight text-balance md:text-4xl" style={{ animationDelay: "100ms" }}>
        Aviso legal y derechos de autor
      </h1>
      <p className="rise mt-2 text-sm text-muted" style={{ animationDelay: "200ms" }}>
        Última actualización: {SITE.updated}
      </p>

      <div className="mt-10 flex flex-col gap-8">
        {SECTIONS.map(([title, paragraphs]) => (
          <section key={title}>
            <h2 className="text-lg font-semibold">{title}</h2>
            <div className="mt-2 flex flex-col gap-3 text-muted">
              {paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
