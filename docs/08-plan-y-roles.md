# 08 - Plan de trabajo, roles y gestión de riesgos

| | |
|---|---|
| **Proyecto** | TransPort |
| **Documento** | Roles, plan de trabajo, entregas y riesgos |
| **Estado** | Borrador para revisión. Versión 0.1 |
| **Documentos relacionados** | [03-alcance](03-alcance.md), [04-arquitectura](04-arquitectura.md) |

## 1. Roles

### 1.1 Roles del proyecto

El proyecto es **individual**: una sola persona cubre todos los roles del desarrollo. Se listan para dejar claras las responsabilidades que cada decisión debe atender.

| Rol del proyecto | Responsabilidad | Responsable |
|---|---|---|
| Analista | Levantar y mantener requisitos y alcance. | Jaime |
| Arquitecto | Definir componentes, decisiones y dependencias. | Jaime |
| Diseñador de interfaz | Wireframes y sistema visual. | Jaime |
| Desarrollador | Implementar el corte vertical (API, web, datos). | Jaime |
| Operaciones | Contenedores, configuración y gestión de secretos. | Jaime |
| Documentación | Mantener `docs/` y el README. | Jaime |

El desarrollo asistido por IA está permitido y recomendado por el enunciado. El autor revisa y valida todo el código y la documentación producidos con esa asistencia.

### 1.2 Roles del sistema

Estos roles definen los permisos dentro de la plataforma. Se asignan por **membresía** a un giro (o a toda la organización).

| Rol | Alcance | Puede |
|---|---|---|
| Dueño | Toda la organización | Ver reportes consolidados de todos los giros; configurar reglas y accesos. |
| Gerente | Un giro | Reportes del giro; aprobar pedidos internos; recibir alertas críticas. |
| Administrativo | Un giro | Presupuesto y gastos del giro. |
| Vendedor | Uno o más giros | Gestionar pedidos de clientes; atender reuniones asignadas. |
| Operativo | Un giro | Registrar operaciones, inventario y estados de pedido; recibir alertas operativas. |
| Cliente | Su propia cuenta | Ver sus pedidos y reportes; comunicarse por el hilo del pedido. |
| Cliente de API (tercero) | Alcances de su API key | Crear y consultar sus pedidos por la API B2B. |

## 2. Entregas y calendario

Fechas confirmadas por el curso y fechas por confirmar.

| Entrega | Fecha | Contenido previsto |
|---|---|---|
| Primer avance | Martes 06/10/2026 | Alcances, roles y problemas identificados. |
| Investigación PWA | Miércoles 07/10/2026 | Informe individual. |
| Segundo avance | Martes 13/10/2026 | Repositorio con esqueleto funcional, documentación de arquitectura, datos y API. |
| Avances semanales siguientes | Martes de cada semana | Según el plan de la sección 3. |
| Wireframes | Antes de desarrollar la interfaz | Aprobación previa requerida por el curso. |
| Entrega final | Día del examen final (**por confirmar**) | Documento final, código, video. |

## 3. Plan por fases

Las fases se ordenan por dependencia. La fecha de entrega final aún no está confirmada, por lo que el plan se expresa en fases y se asignará a semanas cuando se conozca.

| Fase | Objetivo | Entregables | Criterio de terminado |
|---|---|---|---|
| 0. Fundación | Repositorio, esqueleto y secretos. | `docker-compose`, API con login, web base, `.env.template`. | `docker compose up` levanta todo y el login funciona. **Hecha.** |
| 1. Documentación base | Arquitectura, datos, API y plan. | Documentos 04, 05 y 08. | Revisados y versionados. |
| 2. Wireframes | Diseño de pantallas y aprobación. | Documento 07 y archivos de wireframes. | Aprobados antes de construir la interfaz. |
| 3. Modelo de datos y permisos | Membresías, giros, sedes y datos semilla. | Migración del esquema; autorización por rol y giro. | Pruebas de permisos por rol. |
| 4. Pedido interno entre giros | Flujo completo de punta a punta. | Endpoints de pedidos, interfaz de solicitud y aprobación, hilo de mensajes. | Un pedido recorre todos los estados. |
| 5. Alertas y GPS | Servicio GPS simulado y una regla real. | Servicio mock, ingesta, motor de alertas, vista de alertas. | Un exceso de velocidad genera una alerta al rol correcto. |
| 6. Sala de ventas y portal | Sitio público y vista de cliente. | Catálogo de giros, solicitud de reunión, seguimiento de pedidos. | Un cliente ve su pedido. |
| 7. Panel consolidado | Reportes por giro y generales. | Endpoints de reportes y panel. | Los datos semilla se agregan correctamente. |
| 8. API B2B y PWA | Integración con terceros e instalación. | `/b2b/orders` con API key, manifiesto y Service Worker. | Un cliente de prueba crea un pedido por la API; la app se instala. |
| 9. Cierre | Pulido, pruebas, video y documento final. | Documento final, video de demostración. | Entrega lista. |

Las fases 4 a 8 son el **corte vertical**. Si el tiempo se reduce, se recortan en este orden de prioridad (de menor a mayor sacrificio): API B2B, panel consolidado, portal de cliente. Los pedidos internos y las alertas no se recortan porque son el núcleo de la propuesta.

## 4. Estrategia de trabajo

- **Control de versiones.** Rama `main` estable; cambios pequeños y frecuentes con mensajes descriptivos. Se sube a un repositorio remoto para cada avance semanal.
- **Documentación junto al código.** Cada decisión relevante se registra como ADR en [04-arquitectura](04-arquitectura.md).
- **Definición de terminado.** Una funcionalidad está terminada cuando funciona de punta a punta en Docker Compose, valida su entrada, respeta los permisos y está reflejada en la documentación.
- **Pruebas.** Pruebas automáticas (`bun test`) para reglas de negocio críticas: transiciones de estado, permisos y reglas de alertas.
- **Secretos.** Nunca en el repositorio. Ver `.env.template` y el README.

## 5. Problemas identificados y riesgos

### 5.1 Problemas del negocio que el sistema busca resolver

| Problema | Consecuencia | Respuesta del sistema |
|---|---|---|
| Procesos manuales | Pérdida de control y errores. | Registro digital por giro. |
| El GPS actual solo se ve en navegador y no genera alertas | Excesos de velocidad y paradas no detectados. | Alertas propias sobre los datos GPS. |
| Cada giro es una isla | Sin visión consolidada para decidir. | Panel y reportes consolidados. |
| Abastecimiento entre giros sin coordinación | Retrasos en producción. | Pedidos internos con estados y alertas de retraso. |
| Sin canal con clientes | Poca visibilidad y comunicación informal. | Portal de clientes y hilo por pedido. |
| Integración manual con terceros | Reprocesos y errores. | API B2B, webhooks y CSV. |

### 5.2 Riesgos del proyecto

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Alcance excesivo para un desarrollador | Alta | Alto | Corte vertical único; recortes priorizados (sección 3). |
| Fecha de entrega final aún no confirmada | Media | Medio | Planificar por fases; confirmar la fecha y reasignar. |
| Dependencias de terceros no disponibles (GPS real) | Alta | Bajo | Servicio simulado con contrato documentado. |
| Menor madurez de Bun | Baja | Medio | Evitar módulos nativos; código portable a Node. |
| Fallas en la demostración por depender de la nube | Media | Alto | Todo corre localmente con Docker Compose. |
| Cambios al enunciado del curso | Media | Medio | Revisar el documento oficial en cada avance. |
| Pérdida de información local (`context/` no se versiona) | Media | Medio | Respaldar credenciales en un gestor de contraseñas. |

## 6. Pendientes de confirmar

- Fecha exacta del examen final y de la entrega.
- Si el documento final del catedrático modifica el enunciado actual.
- Formato y herramienta de los wireframes (Pencil o Mockups) y proceso de autorización.
