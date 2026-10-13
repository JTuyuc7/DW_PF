# 06 - Stack e infraestructura: opciones (borrador, sin decidir)

El sistema debe correr con Docker Compose localmente. La nube es una **propuesta hipotética justificada**, no un despliegue real.

## Backend (runtime)

| Opción | A favor | En contra |
|--------|---------|-----------|
| Node.js | Lo que viene en clase; ecosistema más amplio (Fastify, NestJS, Express); imagen Docker estándar. | Más lento de arrancar que Bun; TypeScript requiere paso de build. |
| Bun | Rápido, TypeScript nativo, servidor y test runner integrados. | Más joven; algún paquete nativo puede fallar. |
| Deno | Seguridad por permisos, TS nativo, estándares web. | Ecosistema/integraciones más chicas; menos soporte en la clase. |

Inclinación inicial: **Node.js (o Bun con Hono/Fastify)** por alineación con el curso. A decidir.

## Frontend

| Opción | Uso |
|--------|-----|
| Next.js | Sitio público con SEO (sala de ventas) + portales, SSR. Pensado como app única. |
| Vite + React | SPA ligera para intranet/portal; PWA sencilla con `vite-plugin-pwa`. |

Inclinación inicial: **Next.js** si se quiere una sola app con SEO público y zonas por rol; **Vite + React** si se separa la intranet. El enunciado pide SEO y evitar Bootstrap genérico (Tailwind/shadcn encaja).

## Base de datos y servicios

| Opción | Notas |
|--------|-------|
| PostgreSQL en contenedor | Control total, simple en Docker Compose, mismo motor que Supabase. |
| Supabase | Postgres + Auth + Realtime + Storage; acelera login/roles (RLS). Se puede correr local con su CLI/Docker. |
| Firebase | Auth, Firestore, FCM (push). NoSQL: peor encaje para datos relacionales como pedidos y presupuestos. Útil solo para notificaciones push. |

Inclinación inicial: **Postgres (vía Supabase o contenedor propio)**. Los datos son relacionales (giros, pedidos, inventario, presupuestos), así que Postgres se ajusta mejor que Firestore.

## Nube (propuesta hipotética)

| Opción | Perfil | Notas |
|--------|--------|-------|
| AWS | Más completo (ECS/Fargate, RDS, S3, SES, SNS, CloudFront) | Más servicios y más curva; costo difícil de predecir. |
| GCP | Cloud Run (contenedores), Cloud SQL, Cloud Storage, FCM | Cloud Run encaja con Docker; buen punto medio. |
| Cloudflare | CDN, WAF, DNS, R2 (almacenamiento), Workers | Frente de la app y almacenamiento barato; no reemplaza el backend/BD. |
| DigitalOcean | Droplets / App Platform, Postgres administrado, Spaces | Más control y precio predecible; menos servicios gestionados. |
| Azure | Container Apps, Azure SQL/Postgres | Alternativa válida, menos relevante aquí. |

Combinaciones candidatas a comparar:
- **A.** DigitalOcean (Droplet/App Platform + Postgres administrado + Spaces) + Cloudflare al frente. Simple y de costo predecible.
- **B.** GCP (Cloud Run + Cloud SQL + Cloud Storage) + Cloudflare. Escalable y orientada a contenedores.
- **C.** AWS (ECS Fargate + RDS + S3 + CloudFront). Madurez y escala máxima, mayor complejidad.

Criterios para decidir: costo mensual estimado, facilidad de operar solo, escalabilidad a 6 giros y terceros, latencia desde Guatemala, y qué tan bien justifica el diagrama de componentes.

## Pendiente

- Elegir stack y nube, y registrar la justificación en `04-arquitectura.md`.
- Estimar costos con un supuesto de carga (usuarios, pedidos/día, eventos GPS/min). **No inventar cifras:** consultar las calculadoras de cada proveedor.
