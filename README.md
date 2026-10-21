# TransPort

Plataforma web integral para un grupo empresarial guatemalteco con seis giros de negocio. Proyecto final individual del curso Desarrollo Web, Universidad Mariano Gálvez (UMG), 2026.

TransPort es una empresa ficticia, basada en modelos reales de Guatemala, que hoy lleva sus procesos de forma manual. Este proyecto propone y prototipa un sistema a medida que unifica la operación de cada giro, da visibilidad consolidada a la dirección, abre un canal con los clientes y genera las alertas que el sistema de GPS actual no produce.

## El caso en breve

| Giro | Descripción |
|---|---|
| Extracción minera | Produce la materia prima. |
| Proceso de materia prima | Pisos cerámicos y materiales de construcción. |
| Venta y alquiler de maquinaria | Inventario, contratos y GPS por máquina. |
| Transporte de materia prima | Flota con GPS para empresas del sector cementero. |
| Transporte de productos | Entre puertos, fronteras y bodegas. |
| Servicios de construcción | Puentes, carreteras y edificios. |

**Qué resuelve el sistema**

- Control operativo y presupuesto propio por giro.
- Pedidos directos entre giros (por ejemplo, la planta de proceso solicita materia prima a la extracción).
- Reportes por giro y consolidados para la dirección.
- Sala de ventas pública y portal para clientes.
- Alertas por rol a partir de eventos de pedidos, inventario y GPS.
- Integración con terceros mediante una API REST versionada.

El enunciado original está en [`docs/documento.md`](docs/documento.md).

## Alcance: diseñado e implementado

El proyecto dispone de menos de un mes, por lo que toda la solución se **diseña** y solo un corte vertical mínimo (MVP) se **implementa**. El flujo implementado de extremo a extremo es el **pedido interno entre giros**.

| Capacidad | Diseñada | Implementada |
|---|:---:|:---:|
| Autenticación con JWT y permisos por membresía (rol y giro) | Sí | Lista (API e interfaz de inicio de sesión) |
| Pedido interno entre giros | Sí | Listo de extremo a extremo: crear, listar, aprobar y avanzar estados, mensajes y descuento de inventario |
| Inventario (consulta y ajuste) y catálogo público (giros y productos) | Sí | API lista |
| Panel por giro | Sí | Listo en `/panel`: indicadores, pedidos por atender y bloque "Requiere atención" (retrasos y stock bajo, sin alertas automáticas) |
| Sala de ventas pública | Sí | Landing en `/` con carrusel de giros y catálogo, `/nosotros`, `/contacto` y `/legal` |
| Solicitud de reunión | Sí | Formulario público en `/contacto#reunion`, asignación automática de vendedor y gestión por el personal en `/reuniones` |
| Panel por giro y consolidado | Sí | Pendiente |
| Alertas (pedido retrasado, exceso de velocidad) | Sí | Pendiente |
| API para terceros (`/api/v1/b2b`) | Sí | Pendiente |
| PWA | Sí | Pendiente |
| Presupuesto y gastos, EDI/CSV, webhooks, integración real con GPS | Sí | No |

Detalle y justificación en [`docs/03-alcance.md`](docs/03-alcance.md).

## Cómo navegar la documentación

La carpeta [`docs/`](docs/) contiene el diseño completo. Se recomienda leerla en este orden:

| Documento | Contenido |
|---|---|
| [01 - Requisitos](docs/01-requisitos.md) | Requisitos funcionales (RF) y no funcionales (RNF), y criterios de entrega. |
| [02 - Dominio](docs/02-dominio.md) | Giros, actores, dependencias entre giros y problema a resolver. |
| [03 - Alcance](docs/03-alcance.md) | Qué se implementa, qué solo se diseña, exclusiones y riesgos. |
| [04 - Arquitectura](docs/04-arquitectura.md) | Vistas de contexto y componentes, ocho decisiones de arquitectura (ADR), seguridad. |
| [05 - Datos y APIs](docs/05-datos-y-apis.md) | Modelo entidad-relación, reglas de negocio, catálogo de endpoints, estados del pedido y contrato GPS simulado. |
| [06 - Infraestructura](docs/06-infraestructura.md) | Entorno local, alternativas evaluadas y propuesta de nube (GCP + Cloudflare). |
| [07 - Interfaz y wireframes](docs/07-ui-wireframes.md) | Mapa de navegación, flujo del pedido y especificación de las nueve pantallas. |
| [08 - Plan y roles](docs/08-plan-y-roles.md) | Roles del proyecto y del sistema, plan de trabajo y riesgos. |

**Wireframes.** Las nueve pantallas (P01 a P09) están en [`docs/wireframes/wireframes.html`](docs/wireframes/wireframes.html). GitHub muestra ese archivo como código; descárgalo o clona el repositorio y ábrelo en el navegador.

## Arquitectura

Una aplicación web con zonas por rol (sitio público, portal de cliente e intranet) consume una API REST versionada. La API usa PostgreSQL y un almacenamiento de objetos compatible con S3. Los terceros acceden por una superficie aparte con clave de API.

| Capa | Tecnología |
|---|---|
| Frontend | Next.js, TypeScript, Tailwind CSS |
| API | Bun, Hono, Drizzle ORM, Zod |
| Base de datos | PostgreSQL 17 |
| Almacenamiento de objetos | SeaweedFS (API compatible con S3) |
| Orquestación local | Docker Compose |
| Producción (solo propuesta) | Google Cloud (Cloud Run, Cloud SQL, Cloud Storage) con Cloudflare al frente |

La justificación de cada elección está en [`docs/04-arquitectura.md`](docs/04-arquitectura.md).

## Ejecución local

Requisito: Docker Desktop.

1. Crear el archivo de variables de entorno a partir de la plantilla y completar los valores:

   ```bash
   cp .env.template .env
   ```

   | Variable | Descripción |
   |---|---|
   | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Credenciales de PostgreSQL. |
   | `JWT_SECRET` | Clave de firma de los JWT. Generar con `openssl rand -base64 48`. |
   | `SEED_PASSWORD` | Contraseña de los usuarios demo. Solo desarrollo. |
   | `WEB_ORIGIN` | Origen del frontend permitido por CORS (opcional, por defecto `http://localhost:3000`). |
   | `NEXT_PUBLIC_API_URL` | URL de la API vista desde el navegador (opcional, por defecto `http://localhost:4000`). |

   `docker-compose.yml` define además `API_INTERNAL_URL` (`http://api:4000`), la dirección de la API vista desde el servidor de Next, que usa la landing para leer el catálogo.

   `.env` está ignorado por git. Si falta una variable obligatoria, `docker compose` falla indicando cuál.

2. Levantar los servicios:

   ```bash
   docker compose up -d --build
   ```

| Servicio | URL |
|---|---|
| Web | http://localhost:3000 |
| API | http://localhost:4000 (`GET /health` y rutas bajo `/api/v1`; catálogo en [`docs/05-datos-y-apis.md`](docs/05-datos-y-apis.md)) |
| PostgreSQL | localhost:5432 (credenciales definidas en `.env`) |
| Almacenamiento S3 | http://localhost:8333 |

Al iniciar, la API aplica el esquema y siembra datos de ejemplo: los seis giros con sus sedes, un catálogo provisional de productos, existencias de inventario, un pedido interno y los usuarios demo. La contraseña de todos es el valor de `SEED_PASSWORD`.

| Usuario | Rol y giro |
|---|---|
| `dueno@transport.gt` | Dueño (toda la organización) |
| `gerente@transport.gt` | Gerente de Extracción |
| `operativo.extraccion@transport.gt` | Operativo de Extracción |
| `gerente.proceso@transport.gt` | Gerente de Proceso |
| `operativo@transport.gt` | Operativo de Proceso |
| `vendedor@transport.gt` | Vendedor de Extracción y Proceso |
| `vendedor.proceso@transport.gt` | Vendedor de Proceso (con el anterior, se reparten las reuniones de Proceso) |
| `administrativo@transport.gt` | Administrativo de Extracción |
| `cliente@ejemplo.gt` | Sin membresías (los clientes se modelarán con su propia entidad) |

El pedido de ejemplo lo solicita Proceso a Extracción, de modo que se puede recorrer el flujo completo: crear con el operativo de Proceso, aprobar con el gerente de Extracción, despachar con su operativo y confirmar la recepción desde Proceso.

Si cambia el esquema de forma que `drizzle-kit push` necesite una confirmación interactiva (por ejemplo, un renombre), el contenedor no puede responderla. En desarrollo basta recrear el volumen de la base: `docker compose down` y `docker volume rm proyecto_final_pgdata`.

### Ejecución sin construir imágenes (modo local)

Para desarrollar sin reconstruir contenedores, solo la base de datos va en Docker; la API y la web corren en su máquina. Requisitos: Bun, Node.js y pnpm (o npm).

```bash
docker compose up -d db            # PostgreSQL, publicado en localhost:5432
docker compose stop api web        # si estaban levantados, para liberar los puertos 4000 y 3000

cd apps/api
bun install
bun run local:setup                # aplica el esquema y siembra los datos de ejemplo
bun run local                      # API en http://localhost:4000, con recarga automática

cd apps/web                        # en otra terminal
pnpm install
pnpm dev                           # web en http://localhost:3000
```

`pnpm dev` por sí solo no basta: la web necesita la API y la base de datos. La API lee el `.env` de la raíz y arma la conexión con las variables `POSTGRES_*` apuntando a `localhost`. Para quitar el límite de solicitudes de reunión use `MEETING_RATE_LIMIT=0` en el `.env`; sin esa variable, fuera de Docker el límite es de 10 por IP y hora (en Docker Compose viene desactivado).

## Pruebas

```bash
cd apps/api
bun test src          # pruebas unitarias de la máquina de estados del pedido
bun run test:e2e      # pruebas de extremo a extremo contra la API en Docker (usa ../../.env)
```

La prueba de extremo a extremo crea pedidos y mueve inventario, por lo que solo debe usarse con la base de desarrollo.

## Estructura del repositorio

```
apps/api            API REST (Bun + Hono + Drizzle)
apps/web            Aplicación web (Next.js)
docs/               Documentación de diseño (01 a 08) y enunciado
docs/wireframes/    Wireframes de baja fidelidad (HTML)
docker-compose.yml  Servicios locales: db, storage, api, web
.env.template       Plantilla de variables de entorno
```

## Estado

La documentación de diseño y los wireframes están completos. El flujo del pedido interno entre giros funciona de extremo a extremo: API probada (permisos por membresía, máquina de estados, historial, mensajes e inventario) e interfaz con inicio de sesión, lista, nuevo pedido y detalle con aprobación (pantallas P01, P03, P04 y P05). Siguen el resto de las capacidades del MVP (alertas automáticas, panel consolidado del dueño, API para terceros, PWA) y la estimación de costos de la propuesta de nube.

Para recorrer el flujo: entre como `operativo@transport.gt` (Proceso), cree un pedido a Extracción, salga y entre como `gerente@transport.gt` para aprobarlo.

## Autoría

Proyecto individual de Jaime Tuyuc. Se usó asistencia de IA para generar código y documentación, que el autor revisa y valida, según permite el enunciado.
