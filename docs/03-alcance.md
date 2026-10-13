# 03 - Alcance (borrador)

Proyecto individual, menos de un mes. Se evalúa propuesta, diseño, avance funcional (login + visual) y justificación. Por eso el alcance se divide en **diseñado** (documentado) e **implementado** (código que corre).

## Principio

Diseñar toda la solución a nivel conceptual (arquitectura, datos, APIs, infraestructura). Implementar un **corte vertical mínimo** que demuestre que la arquitectura funciona.

## Propuesta de MVP implementado (a validar)

1. **Autenticación y roles** (login, roles: dueño, gerente, vendedor, operativo, cliente).
2. **Sitio público "sala de ventas"** con los 6 giros, catálogo y formulario de pedido/agenda de reunión.
3. **Pedidos**: un flujo completo de punta a punta, de preferencia el **pedido interno entre giros** (proceso <- extracción), porque es el más representativo del problema.
4. **Dashboard consolidado** simple (datos semilla) con vista por giro y vista general.
5. **Alertas**: al menos una regla real (ej. pedido retrasado o exceso de velocidad de un camión usando datos GPS simulados).
6. **API B2B versionada** (`/api/v1`) con token y un endpoint para que un tercero cree pedidos.
7. **PWA** instalable (manifest + service worker).
8. **Docker Compose** que levanta todo (front, API, Postgres).

## Solo diseñado (no se construye)

- Módulos completos de cada giro (inventario de planta, contratos de alquiler, presupuestos de obra, contabilidad).
- Integración real con GPS-Inversiones (se simula con un servicio mock que imita su API).
- EDI/CSV con terceros y webhooks salientes (se documentan; webhooks como extra si sobra tiempo).
- BI (Power BI/Tableau) y notificaciones push/email/SMS reales.
- Despliegue real en nube (se documenta propuesta y costos hipotéticos).
- Chat/comunicación cliente-empresa (se diseña; en MVP puede ser un hilo de mensajes por pedido).

## Fuera de alcance

- Desarrollar la app de GPS-Inversiones.
- Contabilidad formal / facturación electrónica (SAT).

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Alcance demasiado grande para un solo desarrollador | Corte vertical único, resto documentado. |
| Muchas tecnologías candidatas | Elegir un stack y justificarlo (ver `06-infraestructura.md`); no mezclar runtimes sin razón. |
| Demo depende de la nube | Todo debe correr localmente con Docker Compose. |

## Preguntas abiertas

- ¿Una app con rutas por rol, o dos (intranet y extranet)? Recomendación inicial: **una sola base de código con zonas por rol** (sitio público + portal cliente + intranet), y la API B2B como superficie aparte.
- ¿Qué flujo exacto es el MVP? Propongo el pedido interno entre giros; falta confirmar.
