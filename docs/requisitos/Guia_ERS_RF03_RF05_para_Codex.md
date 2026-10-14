# Guía de requisitos RF03–RF05 para Codex

Fuente principal: **ERS_Cuentas_Por_Pagar.pdf**, sección 3.2.2 (páginas impresas 11–13; páginas 12–14 del PDF), reglas de negocio 3.4 (páginas impresas 32–33) y apéndices 4.2–4.3 (páginas impresas 35–36). Fuente complementaria: **Especificación de Cuentas por Pagar.pdf**, secciones 5–12. Este resumen facilita la lectura; para una decisión discutida, consultar la fuente y el esquema Oracle vigente.

## Alcance de esta entrega

| Requisito | Resultado esperado | Actores principales |
| --- | --- | --- |
| RF-03 | Registrar un DTE de proveedor manualmente o por carga de archivo, con datos originales, detalle, adjunto y trazabilidad de origen. | Compras/recepción y analista de CxP. |
| RF-04 | Validar integridad, formato, catálogos, importes y duplicidad antes de aceptar el documento. | Compras/recepción y analista de CxP. |
| RF-05 | Calcular el vencimiento según condiciones de crédito y mantener saldo/estado consistentes tras cada movimiento. | Analista de CxP, tesorería y contabilidad. |

La integración directa con SAT queda fuera de la primera versión. El ERS no exige que este entregable implemente todo el trámite de contraseñas, cheques o reportes: esos son otros RF que dependen de RF03–RF05.

## RF-03. Registro o importación de DTE

**Precondiciones:** proveedor activo y adquisición clasificada. **Datos de entrada:** tipo, serie, número, UUID o autorización, fechas de emisión y recepción, moneda, subtotal, impuestos, total, archivo adjunto y detalle.

1. Elegir proveedor y método de ingreso. En captura manual, ingresar los datos; en carga de archivo, extraer los datos disponibles y presentarlos para revisión.
2. Mostrar un resumen y aplicar RF-04. Al confirmar, conservar documento y archivo asociado con estado recibido y origen trazable.
3. Rechazar archivos ilegibles, incompletos o de formato no permitido. Si falta un dato tras extracción, solicitarlo antes de confirmar.
4. Una falla de carga no debe dejar registros parciales ni archivos huérfanos.

**Aceptación explícita:** un DTE válido de proveedor activo queda registrado con importes y adjunto; un archivo no permitido se rechaza sin crear obligación. Dependencias: RF-01, RF-02, RF-04 y almacenamiento.

**Situación del código reportada en esta conversación:** existe captura guiada de cabecera en `RECIBIDO`, seguida de líneas/tributos y una validación posterior; `CXP_ARCHIVO` almacena metadatos/URI, pero no se ha implementado carga ni descarga del contenido. Esa diferencia con el flujo y la atomicidad descritos en el ERS sigue pendiente de resolver o documentar formalmente. No presentar RF-03 como terminado solo porque la cabecera se guarda.

## RF-04. Validación y duplicidad

**Entradas:** proveedor, tipo, serie, número, UUID, fechas, moneda, subtotal, impuestos, total y detalle.

- Comprobar campos obligatorios, formatos y vigencia de catálogos.
- Conciliar cantidad/precio, suma de líneas, impuestos y total; la tolerancia aplicable debe estar configurada, no inventada en el código.
- Buscar duplicados por proveedor, tipo, serie, número y UUID. Coincidencia exacta: impedir el registro. Coincidencia probable por monto, fecha o número: advertir y exigir revisión autorizada.
- Ante diferencias de total, impedir confirmación hasta corregir o justificar con el permiso correspondiente; mostrar causas concretas.

**Aceptación explícita:** UUID repetido se rechaza sin guardar otro DTE; discrepancia entre total y líneas se identifica e impide confirmar. Dependencias: RF-03 y parámetros de tolerancia.

**Adaptación Oracle ya acordada:** el índice funcional de proveedor/serie/número/tipo solo incluye documentos distintos de `ANULADA`; UUID y hash siguen teniendo unicidad global. Las tolerancias encontradas fueron cantidad 0, precio 2 % y conciliación bancaria 0,01; no se confirmó una tolerancia de total, impuesto ni redondeo para DTE. La consulta previa y el manejo de `ORA-00001` deben respetar el índice real. Evitar interpretar `CONCILIACION` como tolerancia de RF-04.

## RF-05. Crédito, vencimiento y saldo

**Precondición:** documento validado y no anulado. **Datos:** fecha base, condición de pago, días de crédito, cuotas, total, retenciones, notas, pagos y ajustes.

1. Tomar la condición del documento o, si no existe, la condición vigente del proveedor en el momento de registro; calcular y guardar el vencimiento. Contado vence el mismo día del documento (RN-05). Un cambio posterior de condición no modifica documentos históricos sin autorización.
2. Calcular saldo inicial y actualizarlo por movimientos aplicados. No permitir saldo negativo ni pagos sobre documentos anulados o ya pagados. Un excedente requiere una operación de ajuste autorizada y explícita.
3. Reflejar el estado que corresponda a la situación de pago, parcialidad o vencimiento, sin inventar valores fuera de los permitidos por Oracle.

**Aceptación explícita:** para un documento de Q1,000, una aplicación de Q600 deja Q400 y estado parcial; un documento ya pagado no admite otro pago.

**Reglas conexas:** RN-04 define saldo como total menos retenciones, notas, pagos y créditos, más ajustes autorizados, sin saldo negativo. La implementación debe determinar cómo se reflejan esos conceptos en `MONTO_APLICADO` y `SALDO_PENDIENTE` para cumplir el `CHECK` real de Oracle y evitar descontar una retención dos veces. RN-13 pide calcular antigüedad con saldo histórico y fecha de corte; no inferir saldos históricos a partir del saldo actual.

**Situación reportada:** el servicio de aplicaciones bloquea registros y actualiza saldos transaccionalmente; no se ha demostrado cálculo automático de vencimiento. Un campo manual de fecha de vencimiento y una validación de coherencia de fechas no satisfacen por sí solos RF-05.

## Estados y aprobaciones: distinción necesaria

La sección 4.2 del ERS enumera `borrador, recibido, validado, observado, confirmado, parcial, pagado, vencido, anulado`. Esos nombres no son la enumeración literal de `CXP_DOCUMENTO` en Oracle. **Decisión del proyecto:** adaptar la funcionalidad y actualizar el ERS para explicar la correspondencia; no agregar estados a Oracle salvo necesidad demostrada.

- El código reportado crea en `RECIBIDO` y valida RF-04 mediante una transición controlada a `PENDIENTE_APROBACION`.
- La operación controlada para completar aprobaciones y pasar a `APROBADA` sigue pendiente según el último informe; el CRUD común no debe sustituirla.
- La aprobación de *documentos* descrita en la especificación funcional no es idéntica a RF-08 del ERS, que trata la revisión, autorización y programación de una **solicitud de pago**. No usar una aprobación de pago como sustituto automático de la aprobación documental.
- `VENCIDA`, `BLOQUEADA` y `CON_DIFERENCIAS` requieren tratamiento explícito; no inferir que etapas anteriores terminaron solo por el nombre de un estado.

La especificación funcional complementaria pide registrar actor, fecha y comentario de cada cambio; rechazos con motivo; segregación de funciones; y reiniciar aprobaciones si cambian datos aprobados. Verificar contra las tablas y roles reales antes de programar niveles o permisos.

## Requisitos transversales que afectan esta entrega

- **RN-02:** unicidad documental; usar las restricciones reales del servidor y conservar la protección frente a concurrencia.
- **RN-07:** documentos anulados conservan número, estado, motivo e historial y no reciben nuevos pagos.
- **RN-12:** período cerrado impide cambios directos; correcciones mediante ajuste o anulación autorizada.
- **RN-15:** creación, modificación, aprobación, rechazo, aplicación y anulación deben quedar en bitácora.
- **RNF-07:** actualizaciones de documento, saldo y movimientos atómicas, sin registros parciales tras fallas.
- **Interfaz 3.1.1:** errores junto al campo, acciones según rol, estados con texto, montos con moneda y dos decimales; búsqueda/filtros/paginación donde corresponda.
- **Archivos 3.1.4:** validar tipo, tamaño, extensión y contenido, además de controles contra software malicioso, antes de conservarlos. El ERS no fija proveedor de almacenamiento ni contrato técnico de carga.

## Casos mínimos para probar la entrega

1. Alta manual válida con proveedor activo, detalle y adjunto; persistencia y vínculo correctos.
2. Archivo inválido o carga interrumpida: sin documento incompleto ni archivo huérfano.
3. UUID o clave exacta duplicada: rechazo; altas concurrentes no producen duplicados.
4. Diferencia entre líneas, tributos y cabecera: causas visibles y sin avance de validación.
5. Vencimiento contado igual a fecha del documento; crédito calculado con condición vigente conservada históricamente.
6. Documento histórico vencido admitido; fecha de vencimiento anterior a emisión rechazada.
7. Pago parcial Q600 sobre Q1,000: saldo Q400; pago total: saldo cero; pago excedido o repetido: rechazo.
8. Anulación, reversión y período cerrado: no se permiten escrituras prohibidas; historial y auditoría conservados.
9. Usuarios autorizados y no autorizados; aprobación/rechazo con actor, motivo y transición controlada cuando la política esté definida.

## Instrucción de uso para Codex

Usa este resumen como índice de RF03–RF05. Contrasta decisiones de implementación con el código y con consultas **de solo lectura** al esquema Oracle vigente. Los instaladores de `database/oracle` no son el DDL final. Si una regla del ERS contradice estados, columnas o restricciones reales, señala la diferencia y propón la adaptación mínima antes de escribir datos o alterar el esquema. Las verificaciones automatizadas no deben escribir en el Oracle compartido.
