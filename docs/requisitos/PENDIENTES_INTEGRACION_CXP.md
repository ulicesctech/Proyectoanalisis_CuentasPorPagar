# Pendientes de la integración conjunta de Cuentas por Pagar

Estado al integrar `origin/Dennis-Garay` en `integracion-cxp`. La compilación y las pruebas locales no sustituyen una prueba con Oracle aislado.

## Implementado en código

- Documentos RF03–RF05: registro, DTE, duplicidad, cálculo de vencimiento, expediente, aprobación y protección del saldo. El proceso RF07–RF10 conserva reservas y pagos `CP-*`; las aplicaciones ordinarias se gestionan por separado.
- Facturas especiales: servicio controlado de registro, aprobación, emisión, constancia y anulación; los pagos requieren emisión. Existe la migración `database/oracle/09_migraciones/001_facturas_especiales_tributos.sql`, que no se ejecutó en esta integración.
- Caja chica: fondos, gastos y reposiciones documentales; las aplicaciones a gastos exigen pagos `REPOSICION_CAJA`. El proceso ordinario excluye `GASTO_CAJA_CHICA`.
- Dennis: API de antigüedad, libro y estadística de compras, Asiste Compras, retenciones y bitácora, con exportaciones Excel/PDF. Las consultas de documentos no suman importes mediante uniones con detalles o tributos. Antigüedad usa aplicaciones y reversiones al corte; RF21 consulta solo retenciones no anuladas. Las decisiones de aprobación y las aplicaciones o reversiones ordinarias escriben su evento en la misma transacción. Las exportaciones con evento exigen un período, de acuerdo con `CK_CXP_EVT_ENTIDAD` del snapshot.

## Verificación pendiente con Oracle aislado

| Área | Evidencia y verificación necesaria |
| --- | --- |
| Facturas especiales | Confirmar la aplicación de `001_facturas_especiales_tributos.sql`, las columnas y restricciones de `CXP_FACTURA_ESPECIAL`, `CXP_REGLA_TRIBUTARIA`, `CXP_DOCUMENTO_TRIBUTO.ID_REGLA_TRIBUTARIA` y el recorrido completo registro → aprobación → emisión → pago → anulación. Estas estructuras no aparecen en el snapshot Oracle anterior a la migración. |
| Concurrencia financiera | Probar decisiones simultáneas, reservas de proceso, aplicaciones ordinarias y `CP-*`, reversiones, saldo al corte y consistencia entre `CXP_DOCUMENTO`, `CXP_PAGO` y `CXP_APLICACION` con transacciones reales. Las pruebas locales usan conexiones simuladas. |
| Proveedores | Verificar la unicidad de NIT bajo altas concurrentes. `proveedor.service.ts` serializa las altas de esa API con bloqueo, pero el snapshot no declara una restricción única de `PROVEEDOR.PRO_NIT`; otros caminos de escritura podrían omitirla. |
| Reportes Dennis | Ejecutar consultas y exportaciones sobre `CXP_DOCUMENTO`, `CXP_DOCUMENTO_TRIBUTO`, `CXP_APLICACION`, `CXP_PERIODO` y `CXP_EVENTO` reales, con pagos parciales, reversión antes/después del corte, anulación y facturas especiales emitidas. Comprobar fechas y rendimiento en períodos extensos. Ninguna consulta Oracle se ejecutó durante esta integración. |
| Bitácora | Confirmar restricciones y claves foráneas de `CXP_EVENTO`, escrituras atómicas y ausencia de duplicados en aprobaciones, flujo de pagos y facturas especiales. Verificar la entrega de exportaciones ante fallos de red; el evento se confirma antes de enviar la respuesta. |

## Funcionalidades o definiciones incompletas

- **Pago nuevo `REPOSICION_CAJA`:** existen controles para aplicarlo a `GASTO_CAJA_CHICA`, pero no está implementado un recorrido controlado completo de creación, autorización y ejecución de ese nuevo tipo de pago. No asumir que registrar un documento `REEMBOLSO` lo ejecuta.
- **Clasificación RF02:** falta definir su persistencia. Los reportes rechazan filtro o agrupación por clasificación en lugar de equipararla a `TIPO_DOCUMENTO`. Se necesita definir la columna o relación real antes de habilitarlos.
- **Asiste Compras RF20:** no hay tabla o configuración confirmada de la estructura SAT ni un formato oficial verificable; `versionFormato` es un parámetro de consulta. El XLSX/PDF actual es una salida interna, pendiente de validación fiscal y de definición de campos/reglas oficiales.
- **Alcance fiscal de reportes:** confirmar con los requisitos fiscales el tratamiento de notas de crédito, caja chica, percepciones, anulaciones históricas y retenciones de facturas especiales. Las consultas excluyen borradores, estados previos a aprobación, caja chica del libro y facturas especiales aprobadas aún sin emitir. Antigüedad usa el estado actual y `FECHA_ANULACION`; no hay historial general de todos los estados para reconstruir cualquier estado pasado.
- **Identidad y permisos:** las rutas nuevas de reportes no tienen un mecanismo general de autenticación en este módulo. Las exportaciones con bitácora exigen un `usuarioEvento` existente y activo, pero ese identificador llega por parámetro y aún requiere vincularse a una identidad autenticada. No se debe considerar la bitácora prueba de autoría hasta entonces.
- **Versiones de libro:** el número de versión se calcula contando eventos del período; verificar y definir una reserva atómica si se permite generar el mismo libro concurrentemente.
