# 01 - Requisitos

Fuente: `documento.md` (enunciado) y clases de Desarrollo Web del 29/09 y 01/10/2026.
Modalidad: **proyecto individual**.

## Requisitos funcionales (del enunciado)

| ID | Requisito |
|----|-----------|
| RF-01 | Solución a medida para que los empleados de cada giro lleven control operativo (presupuesto y gastos propios por giro). |
| RF-02 | Desde la sede central, dueños y administradores generales controlan y generan reportes para toma de decisiones. |
| RF-03 | Los clientes dan seguimiento a sus operaciones/transacciones, ven reportes del estado de su negocio con cada sub-empresa y pueden comunicarse. |
| RF-04 | Pedidos directos entre giros de negocio para abastecimiento oportuno (ej. planta de proceso <- planta de extracción). |
| RF-05 | Alertas y recordatorios según rol e interés: operativos, vendedores, administrativos, gerentes y dueños. |
| RF-06 | Reportes consolidados por giro y generales. |
| RF-07 | Pedidos en línea según producto, o agendar reuniones y asignar vendedor específico para cerrar tratos. |
| RF-08 | Sitio web público tipo "sala de ventas" que explique y ofrezca cada giro; también es el punto de acceso de clientes a sus operaciones. |
| RF-09 | Integración con terceros de compra/venta: API REST, webhooks, intercambio EDI/CSV. |
| RF-10 | Consumir la API de GPS-Inversiones y generar alertas propias (la app del proveedor solo se ve en navegador y no genera alertas). |

## Requisitos no funcionales

| ID | Requisito |
|----|-----------|
| RNF-01 | Experiencia móvil multiplataforma (iOS, Android, escritorio): PWA o framework multiplataforma (React Native, Flutter, .NET MAUI). |
| RNF-02 | Despliegue reproducible con contenedores Docker (`docker-compose.yml`). Se recomienda incluir scripts de BD o SQLite. |
| RNF-03 | Propuesta de infraestructura en la nube con justificación (GCP, Azure, AWS, Rack Space, etc.). |
| RNF-04 | Buenas prácticas de API (clase 17/09): versionado `/api/v1`, token en header `Authorization`, validación server-side, no exponer errores de BD, logs, códigos HTTP correctos. |
| RNF-05 | Se permite y recomienda usar IA para generar código. |

## Entregables y evaluación

- **No se requiere el sistema completo.** Se evalúa: propuesta, diseño, avance funcional (login, parte visual) y justificación técnica.
- Revisiones de avance semanales (video + archivos a la carpeta compartida). Entrega final el día del examen final.
- Documentación (Canvas): carátula, introducción/problema, alcance, diagrama de componentes y dependencias con justificación, wireframes autorizados antes de desarrollar. El resumen de aportes por integrante aplica solo a grupos.
- Wireframes con Pencil (open source) o Mockups. Evitar Bootstrap genérico.
- Primer avance (martes 06/10): alcances, roles y problemas identificados.
- Investigación individual de PWA (miércoles).
- Laboratorio virtual de la universidad disponible si la máquina personal no alcanza (límite de horas).

## Pendiente de confirmar

- Fecha exacta del examen final / entrega.
- Si el documento final del ingeniero (que iba a compartir en la plataforma) cambia algo respecto a `documento.md`.
