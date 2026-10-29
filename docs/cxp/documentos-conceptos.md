# Captura operativa de líneas y tributos

El expediente contiene una tabla de conceptos y otra de tributos. Las rutas
anteriores de líneas/tributos conservan el enlace al documento, pero ya no abren
formularios CRUD. Sin documento seleccionado ofrecen buscarlo primero.

Los formularios compactos no muestran Auditoría, Fechas calculadas, Estado y
control ni Relaciones técnicas. La línea se numera en el servidor; el padre es
el documento de la URL. El descuento es un importe en la moneda del documento.
Unidad, referencias de compra e imputación siguen disponibles en Datos
adicionales. Se conservan los datos técnicos y las relaciones del modelo.

## Cálculo y declaración

```text
bruto de línea = ROUND(cantidad × precioUnitario, 2)
base de línea = bruto de línea − descuento
monto porcentual = ROUND(baseImponible × porcentaje / 100, 2)
total de línea = base de línea + impuestos vinculados − retenciones vinculadas

subtotal de cabecera calculado = suma de brutos de línea
descuentos calculados = suma de descuentos de línea
impuestos calculados = suma de tributos IMPUESTO activos
retenciones calculadas = suma de tributos RETENCION activos
```

Se reutilizan `cxpMoneyMultiply`, `cxpMoneySum` y la precisión vigente. El nuevo
`cxpMoneyPercent` efectúa la división porcentual con enteros decimales para
evitar diferencias binarias entre navegador y servidor. Se mantiene la fórmula
de cabecera: subtotal − descuentos + impuestos + recargos + gastos + ajuste de
redondeo − retenciones; el total local aplica el tipo de cambio ya registrado.

Un tributo vinculado alimenta únicamente su línea. Un tributo general utiliza
como base derivada la suma de bases de línea y se suma una sola vez al documento.
No se distribuye ni prorratea: no existe residuo que asignar a líneas. RF04 ahora
contrasta la cabecera con tributos vinculados más generales y exige también que
cada línea coincida con sus propios tributos. No se añadió tolerancia.

El desglose recuperable no añade importes al total:

- Recuperable: monto completo recuperable, no recuperable cero.
- No recuperable: recuperable cero, monto completo no recuperable.
- Parcial: las dos cantidades se capturan y deben sumar el monto.
- Retenciones/percepciones: no reciben una clasificación recuperable automática.

**Guardar conceptos** recalcula líneas y tributos sin cambiar la declaración de
cabecera. La comparación muestra diferencias exactas. **Guardar y adoptar
totales calculados** solicita confirmación, actualiza los importes de cabecera y
registra la declaración anterior. Debe usarse solo si coincide con el comprobante;
no es una forma de ocultar diferencias con un DTE.

## Compatibilidad y límites del dominio

Los tributos anteriores se abren con su importe conservado y base manual, sin
deducir una fórmula a partir del porcentaje. Un desglose parcial se conserva.
Se puede elegir explícitamente cálculo porcentual o fijo. El modo histórico
permite conservar otros cálculos existentes, sin recalcularlos automáticamente.
Un desglose histórico sin clasificación (ambas partes cero) se conserva; si hay
partes declaradas deben sumar el monto. No se convierten parciales a totales.

Las bases derivadas se actualizan al cambiar cantidad, precio o descuento.
Las manuales y los importes conservados requieren revisar/confirmar la nueva
referencia. Si cambia un monto parcialmente recuperable, se exige ajustar el
desglose; no se cambia su tratamiento ni se reparte automáticamente.

RF04 ya rechazaba impuestos incluidos en precio no nulos y percepciones no
nulas porque su conciliación no está definida. Ese bloqueo sigue vigente y se
muestra en la captura. Se pueden representar y conservar esos registros, pero
no se afirma que sean validables. No se implementaron nuevas reglas fiscales.

El catálogo de reglas tributarias existente pertenece al flujo de facturas
especiales. Esta captura ordinaria no aplica esas reglas ni sus tasas. Permite
reutilizar códigos y nombres ya registrados en el documento; no inventa códigos,
monedas ni tasas oficiales. La tasa del 10 % de las pruebas es ficticia.

## API, atomicidad y trazabilidad

Contrato aditivo: `CxpDocumentoComponentes`, sin cambiar los contratos CRUD
anteriores. `GET /api/cxp/documentos/:id/componentes` devuelve el conjunto y su
versión. `PATCH` guarda el conjunto con esa versión; un cambio concurrente
produce 409 conservando los datos locales para que se decida cómo recargarlos.

La transacción bloquea primero el documento y luego las filas base de líneas y
tributos, en la misma conexión. Revalida estado, aplicaciones, reservas, flujo
de pagos, facturas especiales, IDs y permiso CREAR. No permite mover registros
entre documentos. Los montos porcentuales se recalculan en el servidor, incluso
si el cliente envía un monto distinto. La autoría ajena se rechaza.

El servidor conserva al generador original al editar y firma la modificación en
`CXP_EVENTO`, tipo `CAPTURA_COMPONENTES`. Los campos JSON existentes guardan los
criterios de base/cálculo, la declaración previa y los registros eliminados;
no se añadieron columnas. Esta bitácora se protege contra cambios mediante el
CRUD común. La versión incluye el último evento, también para guardados sin
cambios financieros. Si no puede guardarse la bitácora, se revierte todo.

Quitar una línea informa cuántos tributos vinculados se quitarán. Se confirman
los IDs persistidos y se eliminan primero los tributos y luego la línea, dentro
de la misma transacción. Los tributos generales permanecen. Una línea con
historial de tributos anulados no se elimina; los aplicados se conservan y
requieren su flujo de corrección. Las demás restricciones FK se respetan.

La aplicación comprueba cambios pendientes antes de habilitar RF04 o acciones
que recargan el expediente. Los datos locales no equivalen a registros guardados.

## Prueba desde la interfaz

1. Inicia sesión como operador CXP y crea un documento propio RECIBIDO en GTQ.
   Declara subtotal 600, descuentos 50, impuestos 55, retenciones/recargos/gastos
   cero y redondeo cero, según el comprobante de prueba.
2. Abre su expediente y entra a Líneas y tributos.
3. Agrega Teclados: cantidad 2, precio 150, descuento 0. Aplica la línea.
4. Desde esa línea, agrega IMPUESTO con código/nombre de prueba y porcentaje 10.
   La base es 300 y el monto 30; no escribas el impuesto en la línea.
5. Agrega Mouse: cantidad 3, precio 100, descuento 50. Su tributo de prueba al
   10 % produce base 250 y monto 25.
6. Comprueba subtotal 600, descuentos 50, impuestos 55 y neto 605. Guarda
   conceptos. Si se usó una declaración provisional distinta, compara con el
   comprobante antes de adoptar explícitamente los totales calculados.
7. Adjunta el DTE de prueba, completa los demás requisitos y pulsa Validar
   documento. El resultado esperado es PENDIENTE_APROBACION.

Los cambios de cantidad y bases pueden probarse antes de RF04. Después de
validar o pagar, la captura queda en consulta. No usar el documento del ejercicio
ni CP-00000001 para estas pruebas.

## Verificaciones

Se añadieron pruebas del motor, servicio transaccional y navegador. El navegador
usa una API simulada y prueba altas, cambios, recuperación total/parcial,
retención general, incluidos en precio, eliminación y consulta sin permisos de
edición. Se mantienen las regresiones anteriores de registro y navegación.

La integración `documento.componentes.oracle.test.ts` se habilita únicamente con
`CXP_COMPONENTES_ORACLE=1`, desde `server`, y exige loopback y host de este equipo.
Usa un documento propio, tasa y contenido DTE ficticios, prueba RF04 completo,
rechazo de versión antigua y fallo después de DML real. Usa SAVEPOINT/ROLLBACK,
no COMMIT, y comprueba cero filas restantes. No ejecuta DDL ni toca documentos
existentes. La secuencia de identidad de Oracle puede avanzar aunque se revierta.
No se simuló una carrera de dos conexiones reales: se verificaron los bloqueos
base y el rechazo por versión en Oracle; las pruebas de error usan una falla
inyectada para demostrar el rollback real.
