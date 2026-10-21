# 03 - Alcance

| | |
|---|---|
| **Proyecto** | TransPort |
| **Documento** | Alcance diseñado e implementado, exclusiones y riesgos |
| **Estado** | Versión 0.2 |
| **Documentos relacionados** | [01-requisitos](01-requisitos.md), [04-arquitectura](04-arquitectura.md), [05-datos-y-apis](05-datos-y-apis.md), [07-ui-wireframes](07-ui-wireframes.md) |

## 1. Principio rector

El proyecto es individual y dispone de menos de un mes. Se evalúan la propuesta, el diseño, el avance funcional (inicio de sesión y parte visual) y la justificación técnica. Por ello el alcance se divide en dos niveles:

- **Diseñado:** toda la solución se documenta a nivel conceptual (arquitectura, datos, APIs, interfaz e infraestructura).
- **Implementado:** un **corte vertical mínimo** (MVP) que demuestra que la arquitectura funciona de extremo a extremo.

## 2. Alcance implementado (MVP)

| N.º | Capacidad | Requisitos | Detalle |
|---|---|---|---|
| 1 | Autenticación y roles | RNF-04 | Inicio de sesión con JWT y roles: dueño, gerente, vendedor, operativo, administrativo y cliente. |
| 2 | Sala de ventas pública | RF-07, RF-08 | Presentación de los seis giros, catálogo y solicitud de reunión con asignación de vendedor. |
| 3 | Pedido interno entre giros | RF-04 | Flujo completo de punta a punta entre la planta de proceso (solicitante) y la extracción (proveedor), con estados e hilo de mensajes. |
| 4 | Panel por giro y consolidado | RF-02, RF-06 | Indicadores con datos semilla, con vista por giro y vista general del dueño. |
| 5 | Alertas | RF-05, RF-10 | Al menos una regla real, por ejemplo exceso de velocidad de un camión con datos del servicio GPS simulado, y pedido retrasado. |
| 6 | API para terceros | RF-09 | API versionada (`/api/v1/b2b`) con clave y un endpoint para que un tercero cree pedidos de forma idempotente. |
| 7 | PWA | RNF-01 | Aplicación instalable (manifiesto y service worker). |
| 8 | Despliegue con contenedores | RNF-02 | `docker-compose.yml` que levanta frontend, API y base de datos. |

El detalle de las entidades que se implementan está en la sección 4 de [05-datos-y-apis](05-datos-y-apis.md), y las pantallas en [07-ui-wireframes](07-ui-wireframes.md).

## 3. Alcance solo diseñado

- Módulos completos de cada giro: inventario de planta, contratos de alquiler, presupuestos de obra y contabilidad.
- Presupuesto y gastos por giro (RF-01): modelados en `BUDGET` y `EXPENSE`, sin implementación.
- Integración real con GPS-Inversiones: se simula con un servicio que imita su contrato (ver sección 6 de [05-datos-y-apis](05-datos-y-apis.md)).
- Importación EDI/CSV con terceros y webhooks salientes. Los webhooks se implementan solo si el tiempo lo permite.
- Inteligencia de negocio (Power BI o Tableau) y notificaciones push, correo o SMS reales.
- Despliegue real en la nube: se documenta una propuesta, descrita en [06-infraestructura](06-infraestructura.md).
- Comunicación entre cliente y empresa: se diseña como canal completo; en el MVP se reduce a un hilo de mensajes por pedido.

## 4. Fuera de alcance

- Desarrollo de la aplicación de GPS-Inversiones.
- Contabilidad formal y facturación electrónica (SAT).

## 5. Decisiones de alcance adoptadas

| Pregunta | Decisión |
|---|---|
| ¿Una aplicación o dos (intranet y extranet)? | Una sola base de código con zonas por rol: sitio público, portal de cliente e intranet. La API para terceros es una superficie aparte. |
| ¿Qué flujo es el MVP? | El pedido interno entre giros (proceso solicita a extracción), por ser el más representativo del problema. |

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| Alcance excesivo para un solo desarrollador. | Un único corte vertical; el resto se documenta. |
| Gran cantidad de tecnologías candidatas. | Un stack elegido y justificado (ver [04-arquitectura](04-arquitectura.md)); no se mezclan entornos de ejecución sin razón. |
| La demostración depende de la nube. | Todo el sistema se ejecuta localmente con Docker Compose. |
| El contrato del servicio GPS es una suposición. | Se documenta como tal y debe validarse con el proveedor antes de una integración real. |
