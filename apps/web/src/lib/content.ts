// Contenido editorial compartido por las páginas públicas. Se basa en el enunciado del caso (docs/documento.md).

export const SITE = {
  name: "TransPort",
  address: "Edificio Sixtino, Zona 10, Ciudad de Guatemala",
  email: "contacto@transport.example",
  updated: "20 de octubre de 2026",
} as const;

export const CHAIN = [
  ["Extracción minera", "Produce la materia prima."],
  ["Proceso de materia prima", "La transforma en pisos cerámicos y materiales de construcción."],
  ["Transporte de productos", "La lleva a puertos, bodegas y clientes."],
] as const;
