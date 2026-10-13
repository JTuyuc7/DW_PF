# TransPort

Plataforma web integral para un grupo empresarial guatemalteco con seis giros de negocio (extracción, procesamiento, transporte, alquiler de maquinaria, ventas y construcción). Proyecto final del curso Desarrollo Web, UMG 2026.

La documentación de diseño está en [`docs/`](docs/). El enunciado original está en [`docs/documento.md`](docs/documento.md).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js, TypeScript, Tailwind CSS |
| API | Bun, Hono, Drizzle ORM, Zod |
| Base de datos | PostgreSQL 17 |
| Almacenamiento de objetos | SeaweedFS (API compatible con S3) |
| Orquestación local | Docker Compose |

## Ejecución local

Requisito: Docker Desktop.

```bash
docker compose up -d --build
```

| Servicio | URL |
|---|---|
| Web | http://localhost:3000 |
| API | http://localhost:4000 (`GET /health`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`) |
| PostgreSQL | localhost:5432 (usuario, contraseña y base: `transport`) |
| Almacenamiento S3 | http://localhost:8333 |

Al iniciar, la API aplica el esquema y siembra usuarios demo (contraseña `demo1234`):
`dueno@transport.gt`, `gerente@transport.gt`, `vendedor@transport.gt`, `operativo@transport.gt`, `cliente@ejemplo.gt`.

## Estructura

```
apps/api    API REST (Bun + Hono)
apps/web    Aplicación web (Next.js)
docs/       Documentación de diseño
```

## Estado

Esqueleto funcional: login con roles (JWT), servicios levantados con Compose. El resto del alcance está descrito en [`docs/03-alcance.md`](docs/03-alcance.md).
