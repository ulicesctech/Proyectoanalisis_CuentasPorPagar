# Inventario de botones — Cuentas por Pagar

Pantallas: las 9 que abren las tarjetas de `/cxp`. Los textos se conservan; solo se
asigna variante, tamaño, ícono y estado. Las marcas **(cambio)** indican dónde la
variante o el comportamiento actual difiere de la regla propuesta.

Seis de las nueve pantallas usan el mismo componente (`CxpCrudPage` + `CxpEntityForm`),
por lo que comparten exactamente los mismos botones.

## 1–6. Parámetros, Períodos, Cuentas bancarias, Compromisos, Control (Reglas de aprobación), Conciliaciones (Conciliaciones de proveedor)

Archivos: `components/CxpCrudPage.tsx`, `components/CxpEntityForm.tsx`, `components/RelationSelect.tsx`

| Ubicación | Texto actual | Función | Actual | Asignada |
|---|---|---|---|---|
| Encabezado | Nuevo registro | Abrir modal de creación | primary + `Plus` | primary + `Plus` |
| Barra de filtros | Actualizar | Recargar listado | secondary + `RefreshCw` | secondary + `RefreshCw` + loading |
| Fila | (ojo) Ver registro | Abrir modal de consulta | `<button>` propio, gris | ghost/icon gris + tooltip |
| Fila | (lápiz) Editar registro | Abrir modal de edición | `<button>` propio, azul | ghost/icon azul + tooltip |
| Fila | (papelera) Eliminar registro | Abrir confirmación | `<button>` propio, rojo | ghost/icon rojo + tooltip |
| Fila (solo Conciliaciones) | Detalle | Ir a registros hijos | enlace subrayado | sin cambio (es enlace de navegación) |
| Paginación | Anterior | Página anterior | secondary + `ChevronLeft` | secondary + `ChevronLeft` |
| Paginación | Siguiente | Página siguiente | secondary + `ChevronRight` a la izquierda | secondary + `ChevronRight` **a la derecha** (cambio) |
| Modal formulario | Cancelar / Cerrar (en consulta) | Cerrar modal | secondary | secondary, a la izquierda |
| Modal formulario | Crear registro / Guardar cambios | Guardar | primary, texto "Guardando…" | primary + loading (spinner), a la derecha |
| Modal formulario | Pestañas de sección (General, Auditoría…) | Cambiar de sección del formulario | `<button>` con fondo azul | fuera de alcance: es control de pestañas, no botón |
| Modal eliminar | Cancelar | Cerrar confirmación | secondary | secondary |
| Modal eliminar | Eliminar | Eliminar registro | danger, texto "Procesando..." | danger + loading |
| Campo proveedor | + Registrar proveedor | Abrir alta rápida | enlace subrayado propio | ghost sm + `Plus` (cambio; queda junto al campo, no en el encabezado) |
| Alta rápida proveedor | ✕ | Cerrar | `<button>` propio | botón cerrar del Modal base (cambio) |
| Alta rápida proveedor | Cancelar | Cerrar | `<button>` gris propio | secondary (cambio) |
| Alta rápida proveedor | Guardar y Seleccionar | Crear proveedor | `<button>` azul propio, "Guardando…" | primary + loading (cambio) |
| Campo relación | Reintentar | Recargar catálogo | enlace subrayado | secondary sm |
| Campo relación | Resultados de búsqueda | Elegir opción | `<button>` de lista | fuera de alcance: opción de lista, no botón |

## 7. Documentos

Archivos: `documentos/DocumentoPage.tsx`, `documentos/components/DocumentoCatalogPicker.tsx`

| Ubicación | Texto actual | Función | Actual | Asignada |
|---|---|---|---|---|
| Encabezado | Nuevo documento | Ir a registro | primary + `Plus` | primary + `Plus` |
| Filtros | Limpiar filtros | Restablecer filtros | secondary | secondary |
| Filtros | Actualizar | Recargar listado | secondary + `RefreshCw` | secondary + `RefreshCw` + loading |
| Filtros (selector) | (×) Limpiar … | Vaciar selección | `<button>` propio | ghost/icon + tooltip |
| Mensaje de error | Reintentar | Recargar | enlace subrayado | secondary sm |
| Paginación | Anterior / Siguiente | Cambiar página | secondary | igual que en CRUD (chevron a la derecha en "Siguiente") |

## 8. Facturas especiales

Archivos: `facturas-especiales/FacturasEspecialesPage.tsx`, `components/ListadoFacturas.tsx`,
`components/FacturaEspecialForm.tsx`, `components/AccionDialog.tsx`, `components/acciones.ts`

| Ubicación | Texto actual | Función | Actual | Asignada |
|---|---|---|---|---|
| Encabezado | Nueva factura especial | Abrir modal de creación | primary + `Plus` | primary + `Plus` |
| Filtros | Actualizar | Recargar listado | secondary + `RefreshCw` | secondary + `RefreshCw` + loading |
| Fila | (ojo) Ver factura | Abrir detalle | `<button>` propio, gris | ghost/icon gris |
| Fila | (lápiz) Editar factura | Abrir modal de edición | `<button>` propio, azul | ghost/icon azul |
| Fila | (prohibido) Anular factura | Abrir diálogo de anulación | `<button>` propio, rojo | ghost/icon rojo |
| Fila | Constancia PDF | Descargar constancia | enlace subrayado | ghost/icon `FileDown` + tooltip "Constancia PDF" (cambio) |
| Paginación | Anterior / Siguiente | Cambiar página | secondary | igual que en CRUD |
| Modal formulario | Cancelar | Cerrar | secondary | secondary, izquierda |
| Modal formulario | Registrar factura especial / Guardar cambios | Guardar | primary, "Guardando…" | primary + loading, derecha |
| Diálogo de acción | Cancelar | Cerrar | secondary | secondary |
| Diálogo de acción | Anular | Confirmar anulación | danger, "Procesando…" | danger + loading |

Acciones de flujo (se ven en Revisión y aprobación y en el detalle; se definen en `acciones.ts`):

| Texto | Actual | Asignada |
|---|---|---|
| Enviar a revisión | primary | primary |
| Marcar revisada | primary | primary |
| Devolver | secondary | secondary |
| Aprobar | success | success |
| Rechazar | danger | danger |
| Reabrir | primary | primary |
| Emitir factura | success | **primary** (cambio: "Emitir" figura como ejemplo de primary) |
| Anular | danger | danger |

## 9. Pagos (Contraseñas, Autorizaciones, Pagos, Ejecución de pago)

Archivo: `procesos/ProcesosPagoPage.tsx`. Las cuatro bandejas son la misma pantalla.

| Ubicación | Texto actual | Función | Actual | Asignada |
|---|---|---|---|---|
| Encabezado (Contraseñas) | + Nueva contraseña | Abrir modal de creación | primary, "+" escrito en el texto | primary + ícono `Plus` (cambio: el "+" pasa a ser ícono; el texto queda "Nueva contraseña") |
| Filtros | Actualizar | Recargar bandeja y resumen | secondary | secondary + `RefreshCw` + loading |
| Resumen | Activos / Historial | Cambiar vista | `<button>` tipo pestaña | fuera de alcance: control de pestañas |
| Barra de etapas | Etapas del flujo | Navegar a la bandeja | `<button>` del stepper | fuera de alcance: navegación |
| Fila | Gestionar → | Abrir detalle del proceso | enlace azul propio | ghost/icon `ArrowRight` + tooltip "Gestionar" (cambio) |
| Modal nueva contraseña | Buscar | Buscar documentos | secondary | secondary + `Search` |
| Modal nueva contraseña | Cerrar (encabezado) | Cerrar | secondary | botón cerrar del Modal base (cambio) |
| Modal nueva contraseña | Cancelar | Cerrar | secondary | secondary, izquierda |
| Modal nueva contraseña | Crear contraseña (n) | Crear | primary | primary + loading, derecha |
| Modal error | Entendido | Cerrar aviso | primary | primary |
| Detalle | Imprimir contraseña | Imprimir | secondary | secondary + `Printer` |
| Detalle | Cerrar | Cerrar detalle | secondary | secondary |
| Detalle | Ir a Autorizaciones / Ir a Programación / Ir a Ejecución de pago | Pasar a la siguiente bandeja | primary | **secondary** (cambio: puede coincidir con la acción principal y quedarían dos primary) |
| Detalle | Solicitar autorización | Enviar a autorización | primary | primary + loading |
| Detalle | Aprobar | Autorizar | success | success + loading |
| Detalle | Rechazar | Rechazar | danger | danger + loading |
| Detalle | Programar pago | Programar | primary | primary + loading |
| Detalle | Emitir cheque / Generar transferencia / Generar medio de pago | Emitir medio de pago | primary | primary + loading |
| Detalle | Entregar cheque y aplicar pago / Ejecutar transferencia y aplicar pago | Ejecutar pago | primary | primary + loading |
| Detalle | Confirmar cobro y finalizar / Confirmar transferencia y finalizar | Cierre positivo | primary | **success** (cambio: confirmación positiva) |
| Detalle | Registrar reimpresión de constancia | Registrar reimpresión | secondary | secondary |
| Detalle | Anular | Anular contraseña | danger + `window.confirm` | danger + loading; el `window.confirm` pasa a ConfirmDialog (parte 3) |

## Barra superior (todas las pantallas)

| Texto | Función | Actual | Asignada |
|---|---|---|---|
| (campana) Notificaciones | Notificaciones | `<button>` propio | ghost/icon + tooltip |

## Puntos a decidir

1. **Dónde vive el Button.** `components/ui/Button.jsx` es de solo lectura (FRONTEND_GUIDELINES regla 1) y no tiene loading, botón de solo ícono ni tooltip. Opciones: un `Button` en `shared/components` (lo podría usar todo el sistema, incluido CxC) o uno en `modules/cxp/components` (solo CxP).
2. **Alcance.** CxC también tiene 35 `<button>` propios y 17 archivos con modales. ¿Solo CxP o también CxC (otro equipo)?
3. Confirmar los **(cambio)** de arriba, en especial: "Emitir factura" a primary, "Confirmar … y finalizar" a success, "Ir a …" a secondary y "Gestionar →" a ícono.
