# Estado de experiencia de uso CXP — 30/10/2026

Continuación del segundo bloque: [Administración, permisos y cierre estricto de conciliaciones](administracion-y-conciliaciones.md), con sus verificaciones separadas contra Oracle local. El contenido de este archivo describe el primer bloque.

Continuación en `carlitos-cabrera`, HEAD `32cedeaf4d81644f70d9f7b1e1c6a4a4e4404124`. Se conservó el trabajo local anterior. Sin commit ni push, cambios sin preparar para revisión. No se modificaron .env, DDL, estructura ni datos de Oracle en este bloque.

## Cambios implementados

- **Salir sin guardar:** `CxpFormGuardProvider` centraliza el diálogo «¿Salir sin guardar?», con «Seguir editando» como acción principal y «Salir sin guardar» para descartar. Protege cierre, cancelación, navegación del router y logout. El cierre/recarga de la pestaña conserva `beforeunload` nativo, sin personalizar su texto. La comparación usa el contenido inicial o la respuesta guardada, no referencias de objetos. Incluye borradores de líneas/tributos y archivos seleccionados. Un error no limpia la captura. Se protegió también el alta rápida de proveedor.
- **Pagos:** se quitó únicamente la identidad repetida junto a Nueva contraseña; se mantiene el footer con logout. Las ayudas del expediente son breves, con detalle desplegable y motivos específicos. Sin saldo se prioriza historial; sin elegibles no se muestra un formulario vacío. Las reservas conservan el enlace al proceso vigente.
- **NIT/proveedor:** ambos formularios usan `CxpNitInput` y `useCxpProveedorIdentity`. Consulta con espera de 250 ms y máximo 20 sugerencias, selección con flechas/Enter/Escape/Home/End, error/reintento y descarte de respuestas tardías. Solo una coincidencia exacta y única puede resolverse automáticamente; las parciales y ambiguas requieren elección. Una relación incompatible se limpia al escribir. El alta manual existente se ofrece únicamente con permiso CREAR, en otra pestaña para conservar la captura.
- **Datos maestros y comprobante:** PROVEEDOR solo declara ID, NIT, nombre y activo. No se inventaron dirección, CUI ni régimen. Un proveedor sin NIT conserva las alternativas de identificación permitidas. Los nombres de factura autocompletados siguen la selección; los editados manualmente se conservan y se explica su revisión. Sustituir un NIT manual requiere confirmación. En Documentos el NIT emisor es un dato independiente del DTE; se permite esa excepción explícita y al editar se conserva la instantánea histórica. Abrir una edición no sobrescribe sus campos.
- **Servidor:** consulta de identidad autenticada con binds y conteo exacto independiente del límite; alta de proveedor exige CREAR. Facturas especiales valida que una nueva relación/NIT corresponda al maestro, manteniendo la instantánea histórica si ID y NIT no cambiaron. No se deriva ninguna regla fiscal del NIT.
- **Conceptos:** estado visible guardado/pendiente, bloqueo de envíos duplicados y progreso. El botón normal queda atenuado y deshabilitado sin cambios. Guardar correctamente adopta la versión y el contenido devueltos por el servidor; un 409 conserva la captura y exige resolver la versión. La recarga pide confirmar el descarte. Adoptar totales se evalúa por separado y sigue disponible si conceptos guardados difieren de cabecera.
- **Adjunto:** `DocumentoDteUpload` muestra selección, nombre, reemplazo, retirada, confirmación y errores junto al siguiente paso. Seleccionar no carga. Solo una respuesta exitosa lo marca adjuntado. Se mantienen formato, contenido, tamaño, versiones y servicio existentes. Adjuntar no exige guardar conceptos: el bloqueo era de interfaz. La actualización posterior conserva la captura de conceptos pendiente; RF04 sí sigue exigiendo sus valores persistidos y conciliados.
- **Validación:** «Documento validado y enviado a aprobación. Un usuario autorizado debe revisarlo antes de continuar con el pago» solo cuando la respuesta devuelve PENDIENTE_APROBACION. Otras respuestas no anuncian ese avance; se mantienen los errores de negocio.

## Pagos ordinarios y contraseñas CP-*

El pago ordinario elegible tiene tipo ORDINARIO, código distinto de CP-*, mismo proveedor y moneda, saldo `MONTO_NO_APLICADO > 0` y estado EJECUTADO, CONFIRMADO, PARCIALMENTE_APLICADO, APLICADO o CONCILIADO. El saldo se mantiene como obligación menos aplicado. El importe no puede superar ese saldo ni el del documento, que debe admitir aplicaciones y no tener reservas activas.

La contraseña CP-* agrupa documentos. `workflow.create` reserva dentro de la transacción (`tx.reserve`); el importe reservado todavía no es una aplicación final. En la acción existente `entregar`, el servicio valida medio, fecha, cuentas y un ejecutor distinto del programador, ejecuta Bancos y llama `tx.apply`. La confirmación posterior no vuelve a aplicar. Por eso un CP puede aparecer relacionado con reserva o historial y quedar fuera del selector ordinario. No se ampliaron elegibilidad, permisos ni vías de aplicación.

Referencias: `documento.payment.ts`, `application.service.ts`, `services/procesos/workflow.ts` y `documento.pagosContexto.ts`.

## Tributos y sus opciones

`CXP_DOCUMENTO_TRIBUTO.CODIGO_TRIBUTO` identifica el tributo junto con su tipo y nombre; no es `CODIGO_REGLA` ni una referencia del comprobante. Una regla tiene otra identidad y versión y determina porcentaje, monto fijo, tramos, vigencia y moneda.

No existe un catálogo maestro independiente en el esquema consultado. Se reutilizan:

1. Identificaciones del propio documento, incluidos sus datos históricos.
2. Hasta 50 identificaciones históricas distintas de documentos del mismo tipo, sin copiar tasas ni importes.
3. Identificaciones y reglas de `CXP_REGLA_TRIBUTARIA` compatibles con tipo, fecha y moneda del documento. La copia explícita de valores simples solo se ofrece para su rango de base; exige confirmación. Las reglas por excedente o con porcentaje más fijo no se convierten silenciosamente a una fórmula incompatible.

Elegir identificación completa tipo/código/nombre y conserva los importes. Copiar una regla no crea un vínculo fiscal automático ni cambia documentos históricos. Se mantienen base × porcentaje, importes fijos, recuperación parcial, conservación histórica y revisión manual existentes. RF04 y la conciliación no se modificaron.

La consulta real para el documento local 8 devolvió cuatro identificaciones históricas y cero reglas compatibles. Las dos reglas demo locales de FACTURA_ESPECIAL no se copiaron a FACTURA.

Si más adelante se requiere administrar un maestro separado, la propuesta es `CXP_CATALOGO_TRIBUTO` con ID, tipo, código, nombre y activo, unicidad de tipo/código y sin tasas. Las reglas conservarían sus versiones/vigencias separadas y las operaciones guardarían su instantánea histórica. **Solo propuesta; no se creó ni alteró estructura.** Requiere revisar contratos y aprobación antes de cualquier DDL.

## Función exacta de los tres botones

| Acción | Resultado verificado |
| --- | --- |
| Guardar conceptos | Persiste líneas, tributos y criterios de cálculo; actualiza los importes derivados de las líneas y registra evento. Conserva los importes declarados en cabecera. Requiere cambios locales. |
| Guardar y adoptar totales calculados | Guarda lo anterior y sustituye los importes de cabecera que admite el servicio por los calculados, con confirmación y trazabilidad de valores anteriores. Puede ser útil sin cambios locales si hay diferencias con cabecera. |
| Recargar conceptos | Consulta la versión persistida; después de confirmar, descarta cambios locales de conceptos. No guarda silenciosamente ni descarta el archivo pendiente. |

Ambos guardados conservan el control de versión y las restricciones de edición, aplicaciones, reservas, tributos aplicados y RF04 del servidor. La referencia de comparación solo cambia con una lectura aceptada o una respuesta de guardado exitosa.

## Componentes y archivos para continuar

Nuevos compartidos locales CXP: `components/CxpFormGuard.tsx`, `components/draftFingerprint.ts`, `components/CxpProveedorIdentity.tsx` y `documentos/components/DocumentoDteUpload.tsx`. Se reutilizan CxpButton, SearchableSelect, RelationSelect, Modal, CxpCaptureDialog y las clases de captura de Documentos/Pagos. No se modificó el kit UI común.

Integración: rutas CXP, CxpCrudPage/CxpEntityForm, RelationSelect, CxpSidebar, registro/expediente/componentes de Documentos y formularios/listado/detalle de facturas especiales. Pagos solo pierde el texto duplicado y se simplifican sus ayudas relacionadas.

Contratos aditivos: `proveedor-identidad.ts` y `tributo-opciones.ts`; se conservan las interfaces de escritura anteriores. Nuevas consultas: GET `/cxp/proveedores/identidad` y `/cxp/documentos/:id/opciones-tributos`. Servicios: `proveedor-identidad.service.ts`, `documento.tributoOpciones.ts`; ajustes de validación en `facturaEspecial.service.ts` y mensajes en `documento.pagosContexto.ts`.

Para el próximo rediseño administrativo: componer estos componentes y conservar la separación entre identidad maestra, instantánea del comprobante, regla versionada y valores declarados/calculados. No reemplazar formularios ni sus servicios por CRUD sin sus guardas.

## Verificaciones y límites

- Tipos y `pnpm.cmd build` de contratos, servidor y cliente: correctos; avisos existentes de anotaciones de Zod y tamaño de bundle Vite.
- Cliente: **35 pruebas correctas**. Servidor: **161 correctas**, tres pruebas optativas omitidas; la suite unitaria impide conexiones Oracle.
- Chrome con API simulada: **seis recorridos correctos** entre la suite nueva y regresiones. Se revisaron capturas a 1440×1000 y 390×844. Incluyen formulario intacto/deshecho, cancelación y navegación, fallo/reintento de guardado, doble envío, 409 y recarga confirmada, NIT parcial/único/ambiguo/sin resultados, proveedor sin NIT, datos históricos, tributos y recuperación parcial, adjunto fallido/exitoso conservando conceptos, estado de botones, mensajes y pagos relacionados. Los escenarios afectados se repitieron después de los últimos ajustes.
- Oracle **real, solo lectura**: destino loopback ORCLPDB/PROYECTOANALISISFINAL verificado; columnas de PROVEEDOR, reglas existentes, búsqueda de identidad y opciones tributarias consultadas con los servicios nuevos. No se ejecutó DML ni se repitieron las pruebas transaccionales de la entrega anterior.
- `git diff --check`: correcto. .env y DDL conservados. Sin commit ni push.

Las pruebas de escritura y errores de esta entrega son simuladas en navegador y unitarias; no se presentan como altas, cargas DTE o validaciones nuevas contra Oracle. No se probó un lector de pantalla ni otro navegador. Las tres pruebas optativas omitidas y una instalación completa siguen fuera de esta verificación.
