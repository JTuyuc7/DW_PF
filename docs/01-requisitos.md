# 01 - Requisitos

| | |
|---|---|
| **Proyecto** | TransPort |
| **Documento** | Requisitos funcionales y no funcionales, y criterios de entrega |
| **Estado** | Versión 0.2 |
| **Documentos relacionados** | [02-dominio](02-dominio.md), [03-alcance](03-alcance.md) |

## 1. Alcance de este documento

Recoge los requisitos del sistema tal como se derivan del enunciado del proyecto (`documento.md`) y de las clases de Desarrollo Web del 29/09 y 01/10/2026. Los requisitos se identifican con un código estable (RF para funcionales, RNF para no funcionales) que se utiliza en el resto de la documentación. El proyecto es de **modalidad individual**.

## 2. Requisitos funcionales

| ID | Requisito |
|---|---|
| RF-01 | El sistema debe permitir a los empleados de cada giro llevar el control operativo de su giro, incluidos su presupuesto y sus gastos propios. |
| RF-02 | Desde la sede central, los dueños y administradores generales deben poder controlar la operación y generar reportes para la toma de decisiones. |
| RF-03 | Los clientes deben poder dar seguimiento a sus operaciones y transacciones, consultar reportes del estado de su relación con cada empresa del grupo y comunicarse con ella. |
| RF-04 | El sistema debe permitir pedidos directos entre giros para su abastecimiento oportuno; por ejemplo, de la planta de proceso a la planta de extracción. |
| RF-05 | El sistema debe emitir alertas y recordatorios dirigidos según el rol y el interés de cada persona: operativos, vendedores, administrativos, gerentes y dueños. |
| RF-06 | El sistema debe generar reportes consolidados por giro y generales. |
| RF-07 | El sistema debe permitir hacer pedidos en línea según el producto, o agendar reuniones y asignar un vendedor específico para cerrar el trato. |
| RF-08 | Debe existir un sitio web público a modo de "sala de ventas" que presente y ofrezca cada giro. Ese sitio es también el punto de acceso de los clientes a sus operaciones. |
| RF-09 | El sistema debe integrarse con empresas terceras de compra y venta mediante API REST, webhooks e intercambio de archivos EDI/CSV. |
| RF-10 | El sistema debe consumir la API de GPS-Inversiones y generar alertas propias, ya que la aplicación del proveedor solo se visualiza en navegador y no genera alertas. |

## 3. Requisitos no funcionales

| ID | Requisito |
|---|---|
| RNF-01 | Experiencia móvil multiplataforma (iOS, Android y escritorio), mediante una PWA o un framework multiplataforma (React Native, Flutter o .NET MAUI). |
| RNF-02 | Despliegue reproducible con contenedores Docker (`docker-compose.yml`). Se recomienda incluir scripts de base de datos o usar SQLite. |
| RNF-03 | Propuesta de infraestructura en la nube con su justificación (GCP, Azure, AWS, Rackspace, entre otras). |
| RNF-04 | Buenas prácticas de API vistas en la clase del 17/09: versionado (`/api/v1`), token en el encabezado `Authorization`, validación en el servidor, no exponer errores de la base de datos, registro de eventos (logs) y códigos HTTP correctos. |
| RNF-05 | Se permite y recomienda el uso de inteligencia artificial para generar código. |

## 4. Entregables y evaluación

No se requiere el sistema completo. Se evalúan la propuesta, el diseño, el avance funcional (inicio de sesión y parte visual) y la justificación técnica.

| Aspecto | Condición |
|---|---|
| Revisiones de avance | Semanales, con video y archivos en la carpeta compartida. |
| Entrega final | El día del examen final. |
| Documentación (Canvas) | Carátula, introducción y problema, alcance, diagrama de componentes y dependencias con justificación, y wireframes. El resumen de aportes por integrante aplica solo a grupos. |
| Wireframes | Con Pencil (código abierto), Mockups u otra herramienta. Se presentan, pero no requieren autorización previa del curso. Se evita el uso de Bootstrap genérico. |
| Primer avance (06/10) | Alcances, roles y problemas identificados. |
| Investigación individual | PWA (miércoles). |
| Recursos | El laboratorio virtual de la universidad está disponible si el equipo personal no alcanza (con límite de horas). |

## 5. Puntos por confirmar

- Fecha exacta del examen final y de la entrega.
- Si el documento final que el docente compartirá en la plataforma modifica algo respecto de `documento.md`.
