# Captura y edición de documentos

La autoría se obtiene de la sesión CXP. El asistente muestra el nombre del
usuario operativo y omite los campos de autoría en el POST. El servidor los
completa y rechaza una identidad ajena, incluso si se envía manualmente.
Al editar conserva `creadoPor` y registra al actor en `modificadoPor`.
`solicitadoPor` y `responsablePor` continúan siendo asignables.

## Monedas y tasas

`GET /api/cxp/documentos/monedas` lee `MONEDA(CODIGO, NOMBRE)` con `ESTADO = 'A'`.
No se modifica este catálogo compartido. El valor de moneda local se toma del
valor predeterminado del contrato existente de documentos, actualmente `GTQ`;
no se encontró una configuración independiente de moneda local en esta copia.

La revisión de Oracle local encontró GTQ activa y ninguna tabla o vista de
cotizaciones ni parámetro CXP de tasas. La respuesta indica `fuenteTasas: null`.
No se utilizan tasas de documentos anteriores ni cotizaciones externas.
Una moneda extranjera debe existir y estar activa en el catálogo para poder
registrarla; las pruebas de USD usan un catálogo simulado.

El sentido de la tasa es **unidades de moneda local por una unidad de la moneda
del documento**. La tasa local es 1 y no se puede editar. Elegir otra moneda
vacía la tasa para exigir una entrada positiva explícita. La API también exige
una tasa explícita en altas extranjeras y al cambiar su moneda o fecha.

Las tasas extranjeras ingresadas se identifican como `Ingreso manual` y se
guardan con `fechaTipoCambio`. Cambiar la fecha del documento conserva la tasa,
pero solicita revisarla y confirmarla visitando y saliendo de ese campo; no la
atribuye silenciosamente a la nueva fecha. También se contempla un registro
anterior que no tenga fecha de tasa.

## Importes

Se conserva `prepareCxpRecord('documentos', ...)`, en los contratos compartidos:

```text
totalBruto = subtotal - descuentoTotal + impuestoTotal
             + recargoTotal + gastoAdicionalTotal + diferenciaRedondeo
totalNeto = totalBruto - retencionTotal
totalLocal = ROUND(totalNeto * tipoCambio, 2)
saldoPendiente = totalNeto - montoAplicado
```

Los importes se capturan con hasta 2 decimales y la tasa con hasta 8, conservando
las restricciones de precisión y de representación segura del contrato.
Las sumas y el producto usan la aritmética decimal existente, con el criterio
de redondeo de Oracle (mitades alejándose de cero). El redondeo del documento
admite signo; los demás importes de cabecera y los totales no pueden ser
negativos. Descuentos y retenciones son importes, no porcentajes.

El asistente no convierte una entrada temporal vacía en cero. Las entradas
claramente inválidas se señalan al escribir; las obligatorias o incompletas,
al salir del campo. Continuar y guardar validan y enfocan el primer error.
La comprobación de duplicados sigue siendo del servidor al guardar; el cálculo
de vencimiento tiene espera de 300 ms y descarta respuestas de datos anteriores.

La validación RF04 conserva su etapa independiente: líneas, tributos, adjunto
DTE y conciliación del expediente antes de enviarlo a aprobación.

## Verificación

Desde la raíz:

```powershell
pnpm.cmd --filter @erp/contracts build
pnpm.cmd --filter @erp/server build
pnpm.cmd --filter @erp/client build
node --test client/tests/documentos.browser.test.mjs
```

Las pruebas del navegador abren Chrome o Edge sin interfaz y usan una API
aislada en memoria para altas y ediciones. Guardan capturas en
`client/node_modules/.cache/documentos-browser/`. No conectan a Oracle.
Las pruebas de servicio simulan la conexión y las transacciones; la comprobación
del catálogo contra Oracle local se realizó únicamente mediante SELECT.

La inicialización del asistente se obtiene de `initialDocumentoRegistroValues`;
la moneda local se lee del esquema existente, sin depender del nuevo export de
la constante en un bundle antiguo. La normalización acepta escalares de la API
(texto, número, null o ausencia) y convierte ausencias en controles vacíos.
Los valores obligatorios vacíos continúan siendo inválidos. Las líneas nuevas
usan su propia inicialización y contrato; no pasan por el transformador de cabecera.

Después de recompilar contratos, reiniciar el servidor. La configuración de Vite
fuerza la optimización de dependencias al arrancar para evitar exports antiguos
de los contratos CommonJS del workspace, aunque el lockfile no haya cambiado.
No se necesita añadir `--force` al comando habitual de desarrollo.
