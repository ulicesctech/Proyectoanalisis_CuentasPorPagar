# Interfaz CXP y selección de documentos para contraseñas

## Distribución compartida

Se reutilizan `CxpButton` y los estilos existentes de Pagos. `CxpCaptureSteps` representa los pasos del formulario; `CxpStageMarker` comparte únicamente la apariencia de los círculos de proceso. La captura no se usa para inferir estados del servidor.

`CxpPageHeader` compone cabecera, descripción y acciones. `CxpCaptureDialog` aplica a facturas especiales la distribución del diálogo de Pagos, con foco contenido y cierre delegado al formulario. Son componentes locales de CXP: no se modifican el kit común, los otros módulos ni la arquitectura del CRUD.

## Documentos

- Registro: Identificación, Fechas e importes y Revisión. Se conserva el estado entre pasos, la autoría de sesión, el catálogo de monedas, la tasa manual, la validación inmediata y el vencimiento calculado. La ayuda posterior al registro es desplegable y no consume una columna.
- Listado: buscador amplio, proveedor, estado y vencimiento, contador, actualizar y limpiar; se conservan las consultas y la paginación. La tabla y sus acciones siguen el lenguaje visual de Pagos.
- Expediente: cuatro etapas informativas (Recibido, Pendiente de aprobación, Aprobada, Pago o aplicación). `documentoFlujo.ts` contempla todos los estados publicados del documento. Un pago parcial mantiene la última etapa activa; PAGADA, APLICADA y CERRADA la completan. Rechazo, anulación, bloqueo y vencimiento no permiten deducir avances exitosos. Las etapas no son botones ni bandejas.

## Búsqueda y creación de contraseña

Se reutiliza `GET /api/cxp/procesos/opciones?search=...&proveedor=...`. El proveedor sigue siendo opcional. Si no hay proveedor ni búsqueda, no se devuelven documentos. Con proveedor se conserva la lista acotada de hasta 200 documentos; con búsqueda se devuelven como máximo 20 coincidencias.

La consulta busca `NUMERO_DOCUMENTO`, `NO_FACTURA_COMPRA` y la combinación serie-número; no trata `ID_DOCUMENTO` como número comercial. Usa las columnas y la relación de PROVEEDOR que ya emplea el repositorio de documentos. No cambia estados elegibles, saldo, naturaleza, duplicados, exclusiones especiales ni la comprobación de reservas.

En `OpcionesProceso.documentos` se agregan campos **opcionales**: `serie`, `numeroDocumento`, `noFacturaCompra` y `proveedorNombre`. Se mantiene la compatibilidad de los consumidores existentes. El payload de `POST /api/cxp/procesos` permanece intacto.

`DocumentoProcesoSearch` usa debounce de 300 ms, AbortController y descarte de respuestas antiguas. Incluye carga, error con reintento y ausencia de resultados; permite flechas, Enter, Escape y Tab. Enter sin una opción activa no selecciona la primera coincidencia. La selección explícita completa el proveedor y conserva el contexto del documento del servidor.

Las selecciones se comparan por proveedor, sucursal y moneda. Un cambio incompatible requiere confirmación antes de quitar documentos, cuentas, medio y fecha. Cancelarlo conserva los datos; confirmarlo permite una selección nueva sin mezclar contextos. Las cuentas bancarias y la fecha requieren elección explícita.

El servidor conserva su validación dentro de la transacción: relee y bloquea documentos, comprueba elegibilidad y cuentas, deriva sucursal/moneda/tasa/saldos desde sus registros, valida el período y reserva los documentos. La sugerencia no constituye una reserva ni sustituye esa validación.

## Facturas especiales

Tres pasos: Proveedor y operación, Importes y tributos, Revisión. Las relaciones se muestran con sus etiquetas, el autor proviene de sesión y la vista previa aplica las reglas vigentes mediante el servidor. Los datos inválidos no generan vistas previas; las respuestas antiguas se descartan. La moneda usa el catálogo del servidor y la tasa extranjera requiere una entrada explícita.

El nombre y NIT omitidos se resuelven en el servidor a partir del proveedor; si este tampoco tiene NIT, el servicio existente solicita NIT o CUI. El resumen no inventa esos valores. Se conserva el resto de la captura comercial y contable opcional.

Guardar crea o actualiza PREPARACIÓN. No ejecuta revisión, aprobación, emisión ni anulación. No se cambian reglas tributarias, tasas, duplicados, vínculos, aprobación por rol ni segregación. El cierre con datos modificados pide confirmación tanto en el registro como en la edición.

## Regreso al menú

`CxpBackToMenu` navega explícitamente a `/cxp`, con flecha y botón secundario. `CxpLayout` lo muestra en las vistas principales que lo necesitan; se reutilizan los accesos de Pagos y del CRUD para evitar duplicados. Proveedores, que usa otra composición existente, incorpora el mismo botón. Los expedientes mantienen su regreso contextual al listado.

## Verificación

Desde la raíz:

```powershell
pnpm.cmd build
$serverTests = @(rg --files server/src -g '*test.ts' -g '!*.oracle*')
node server/node_modules/tsx/dist/cli.mjs --tsconfig server/tsconfig.json --test --test-concurrency=1 @serverTests
$clientTests = @(rg --files client/tests -g '*.test.ts')
node server/node_modules/tsx/dist/cli.mjs --tsconfig client/tsconfig.json --test @clientTests
node --test --test-concurrency=1 client/tests/cxpInterfaz.browser.test.mjs client/tests/documentos.browser.test.mjs client/tests/documentoComponentes.browser.test.mjs client/tests/procesosNavegacion.browser.test.mjs
git diff --check
```

La prueba nueva usa Chrome/Edge, una API en memoria y la aplicación real. Recorre búsqueda con y sin proveedor, números repetidos, teclado, respuestas fuera de orden, cancelación/confirmación de cambios de sucursal, moneda y proveedor, creación y envío del payload, filtros y paginación, captura especial con revisión final y confirmación de cierre, regreso al menú y estados del expediente. Las pruebas anteriores cubren registro normal, edición, cálculos, RF04, líneas, tributos y navegación de pagos.

Las capturas comparables se guardan en `client/node_modules/.cache/cxp-interfaz/<ejecución>/`: Pagos como referencia y documentos a 1440×1000 y 390×844, registros normal/especial, revisión y sugerencias. Este directorio está ignorado y no debe versionarse.

Resultado de esta implementación: compilación de los tres paquetes y tipos correctos; 151 pruebas de servidor, 32 de cliente y las 4 pruebas de navegador aprobadas. `git diff --check` correcto. La prueba nueva se repitió tras completar los escenarios de moneda/proveedor y las capturas de etapas. Solo permanecen los avisos de Vite sobre anotaciones de Zod y tamaño del bundle.

Galería de la ejecución final: `client/node_modules/.cache/cxp-interfaz/1793382814887/comparacion.html`. Los logs de verificación están en `client/node_modules/.cache/sync-20261030/`. Se verificó por SHA256 que los archivos de instalación, `.env`, `.env.example` y el ajuste previo de `DocumentoPagoPanel.tsx` conservan exactamente sus bytes iniciales.

No se ejecutan pruebas Oracle, DDL ni DML. La validación contra una instancia real y la persistencia real quedan pendientes para un entorno local confirmado; las verificaciones descritas usan API y conexiones simuladas. Se conservan los cambios locales previos, incluidos los archivos de instalación y el ajuste de alineación del panel de pagos.
