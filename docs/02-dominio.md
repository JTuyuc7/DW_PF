# 02 - Dominio: TransPort

Empresa ficticia (basada en modelos reales de Guatemala) con múltiples giros de negocio. Cada giro lleva su propio presupuesto y control de gastos, por lo que cada uno requiere su propia solución a medida.

## Giros de negocio

| # | Giro | Sedes | Notas |
|---|------|-------|-------|
| 1 | Extracción minera | Cobán, El Progreso, Quetzaltenango, Petén | Produce materia prima. |
| 2 | Proceso de materia prima (pisos cerámicos, materiales de construcción) | Zacapa, Huehuetenango, Petén | Consume materia prima de la extracción **y** de terceros. |
| 3 | Venta y alquiler de maquinaria | Guatemala, Xela, Zacapa, Petén | Inventario, contratos de alquiler, GPS por máquina. |
| 4 | Transporte de materia prima | Para Cemex, Cementos Progreso, Hispacensa, etc. | Flota con GPS. |
| 5 | Transporte de productos | Inter-puertos, inter-fronteras, puerto<->bodega | Empresas nacionales y extranjeras. |
| 6 | Servicios de construcción | Puentes, carreteras, edificios | Proyectos, presupuestos por obra. |

Sede central: oficinas alquiladas en edificio Sixtino, Zona 10. Coordinación, contabilidad y administración general, y reuniones/videoconferencias para cerrar tratos. Cada giro además tiene oficinas y personal administrativo propio.

## Actores

| Actor | Qué necesita |
|-------|--------------|
| Empleado operativo (planta, flota, maquinaria, obra) | Registrar operaciones, recibir alertas de su giro. |
| Administrativo / contable de sede | Presupuesto y gastos del giro. |
| Vendedor | Pedidos, reuniones asignadas, seguimiento de clientes. |
| Gerente de giro | Reportes del giro, alertas, aprobación de pedidos internos. |
| Dueño / admin general (sede central) | Reportes consolidados de todos los giros. |
| Cliente externo | Ver sus operaciones, pedidos, reportes y comunicarse. |
| Sistema tercero (Cemex, etc.) | Integración por API/webhooks/EDI-CSV. |
| GPS-Inversiones (sistema externo) | Provee API de posición, tiempo de uso y velocidad. **No se desarrolla.** |

## Flujos entre giros (dependencias)

```
Extracción minera ──materia prima──> Proceso de materia prima ──productos──> Clientes / Transporte de productos
        ▲                                     ▲
        └──────────── terceros (proveedores) ─┘
Transporte (ambos) <── flota monitoreada por GPS-Inversiones
Maquinaria ──alquiler/venta──> Construcción y clientes externos
```

Pedido interno típico: la planta de proceso solicita X toneladas a la extracción; se alerta si el stock cae bajo un umbral o si un pedido se retrasa.

## Problema a resolver

Los procesos se hacen **manualmente**, con pérdida de control. El GPS actual solo se ve en navegador y no genera alertas. Falta visibilidad consolidada para decidir y falta un canal con clientes.
