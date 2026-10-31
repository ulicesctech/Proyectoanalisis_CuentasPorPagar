# Administración y conciliaciones CXP — 30/10/2026

Segundo bloque sobre `carlitos-cabrera`, HEAD `32cedeaf4d81644f70d9f7b1e1c6a4a4e4404124`. Continúa el [primer bloque de experiencia de uso](estado-experiencia-uso.md). Se conservaron sus cambios locales y los anteriores; no se hicieron commits, push ni operaciones de integración Git.

## Estructura y fuentes de verdad

El monorepo mantiene `@erp/contracts`, `@erp/server` y `@erp/client`. Las pantallas de estos módulos usaban el CRUD de metadatos; el servidor autenticaba la sesión, pero no distinguía todas sus acciones administrativas. Ahora las pantallas utilizan consultas y operaciones específicas bajo `/api/cxp/administracion`. Las escrituras HTTP de los once CRUD administrativos anteriores quedan bloqueadas; las consultas siguen disponibles. Los servicios internos de documentos, aplicaciones, pagos y procesos conservan su funcionamiento.

`database/oracle/01_ddl/DDL_CORREGIDO_F5.sql` no existe en este checkout. `database/oracle/01_ddl/install_ddl.sql` es un marcador, no una instalación completa. La estructura completa disponible y referida por las instrucciones de instalación es `database/oracle/instalacion/01_estructura_completa.sql`; se contrastó con el diccionario de la base local. No se modificaron ni ejecutaron DDL, paquetes, migraciones o semillas.

La identidad sigue el vínculo `SEG_USUARIOS → CXP_CUENTA_USUARIO → USUARIO → ROL`. El servidor obtiene el usuario operativo de la sesión y vuelve a consultar su rol activo antes de escribir. No se equiparan identificadores entre tablas.

## Política autorizada y cuentas comprobadas

| Acción | Rol activo |
| --- | --- |
| Consultar las vistas administrativas | Sesión CXP operativa válida |
| Crear o editar parámetros y reglas no utilizadas | APROBADOR_CXP |
| Crear y abrir, iniciar cierre, cerrar y reabrir períodos | APROBADOR_CXP |
| Registrar cuentas bancarias CXP y compromisos | OPERADOR_CXP, mediante la capacidad CREAR existente |
| Aprobar o rechazar cuentas CXP | APROBADOR_CXP |
| Preparar y comparar conciliaciones; registrar referencias de pagos | TESORERIA_CXP |
| Cerrar una conciliación de proveedor | TESORERIA_CXP, persona distinta de quien la elaboró |

La administración de configuración y períodos es el permiso adicional autorizado para este proyecto. No concede a APROBADOR_CXP capacidades de Tesorería ni anulación. Los botones reflejan esta política y el servidor la exige independientemente de la interfaz.

Se consultaron las cuentas reales, todas activas y vinculadas a usuarios y roles activos:

| Cuenta existente | Usuario operativo | Rol |
| --- | --- | --- |
| andres.cxp | 1 | OPERADOR_CXP |
| aprobador.cxp | 2 | APROBADOR_CXP |
| programador.cxp | 5 | TESORERIA_CXP |
| ejecutor.cxp | 3 | TESORERIA_CXP |
| confirmador.cxp | 4 | TESORERIA_CXP |

Estos nombres e identificadores documentan los datos comprobados; no se usan como reglas de autorización. No se crearon usuarios, cuentas de acceso, vínculos ni roles, ni se reasignaron. Para el ensayo local, programador.cxp elaboró y confirmador.cxp cerró la conciliación.

## Control

Control contiene cuatro entidades, no un tablero de saldos:

| Vista y registro | Origen y uso |
| --- | --- |
| Reglas de aprobación, `CXP_REGLA_APROBACION` | Define entidad, alcance, moneda, rango de monto, nivel, rol y cantidad de aprobadores. Participa en los flujos de documentos, pagos y lotes que consultan esas reglas. |
| Solicitudes y decisiones, `CXP_APROBACION` | Conserva la revisión solicitada o decidida por una operación. La decisión se realiza en el documento, factura especial o proceso correspondiente. |
| Seguimiento de operaciones, `CXP_EVENTO` | Registra eventos, responsable, fecha, resultado y relación financiera. Su estado no sustituye al del documento o pago. |
| Evidencias y archivos, `CXP_ARCHIVO` | Referencia un respaldo relacionado. El contenido DTE se adjunta en su expediente y las constancias se generan en su operación. |

La navegación separa estos propósitos, ofrece filtros combinables, nombres de relaciones, detalle y enlaces al documento o pago. No hay altas, eliminaciones ni cambios manuales de decisiones, eventos o archivos desde Control. Se preservan las APIs específicas de carga y generación de contenido.

El aprobador puede crear reglas y editar una regla sin solicitudes ni decisiones vinculadas. Una regla utilizada queda protegida como historial. Debe elegirse un rol activo existente por nombre; configurar una regla para otra entidad no crea un flujo de aprobación que no exista. El creador original se conserva. Véase la limitación de auditoría de configuración más abajo.

## Conciliaciones

Hay dos operaciones diferentes: comparación del estado de cuenta de un proveedor (`CXP_CONCILIACION_PROVEEDOR` y `CXP_CONCILIACION_PROV_DET`) y referencias de un pago (`CXP_CONCILIACION_PAGO`). Ninguna ejecuta una transferencia, aplica un CP-* o sustituye la conciliación bancaria de Bancos.

### Proveedores: consultar, preparar, comparar y cerrar

1. Selecciona proveedor, intervalo de emisión y una moneda. La consulta muestra el **saldo pendiente actual** de esos documentos; no reconstruye un saldo contable a una fecha histórica. Excluye anulados, rechazados y duplicados; los documentos de crédito restan saldo. No agrega pagos por separado porque sus aplicaciones ya forman parte del saldo de los documentos.
2. Captura el saldo externo real declarado por el proveedor y consulta las fuentes. Tesorería puede preparar una conciliación con esas referencias. Se vuelve a consultar el origen en el servidor. La preparación exige documentos y menos de 100 detalles; reduce el intervalo si se alcanza el límite.
3. La cabecera se crea BORRADOR y los detalles EN_REVISION, con importes de empresa fotografiados al preparar. No se cambian los documentos originales. Captura por referencia el importe, fecha y referencia del estado de cuenta externo. El servidor calcula diferencia y resultado: EN_REVISION, DIFERENCIA_MONTO, DIFERENCIA_FECHA o COINCIDE. No se rellenan automáticamente importes externos para forzar una coincidencia.
4. Si todas las comprobaciones coinciden, el servidor marca CONCILIADA. Otra persona de Tesorería puede cerrar. El cierre conserva CERRADA, cerrador y fecha; ya no permite comparar detalles. No se implementa reapertura.

El cierre estricto comprueba nuevamente, dentro de la transacción y con bloqueo de cabecera y detalles:

- Debe existir al menos un detalle.
- Diferencia total cero con las funciones monetarias existentes del sistema.
- Todos los resultados COINCIDE y los importes individuales coincidentes; también se comprueban las fechas de la comparación.
- Las sumas de detalles deben concordar con ambos saldos de cabecera.
- Ninguna diferencia individual puede compensarse con otra.
- Alcance de moneda conocido, estado CONCILIADA, versión vigente y cerrador distinto del elaborador.

La observación es información adicional y no omite condiciones. El detalle muestra las referencias y comprobaciones que requieren revisión. Los bloqueos no cambian automáticamente estados, importes ni saldos. El control de versión incluye cabecera, detalles y contexto de moneda; un cambio concurrente devuelve 409 y conserva la captura del formulario.

**Moneda:** las tablas de conciliación de proveedor no tienen columna MONEDA. Sin cambiar el esquema, la preparación controlada conserva moneda, base y elaborador en `CXP_EVENTO.RESULTADO_JSON`, usando la relación existente con la conciliación. Ese contexto forma parte de la versión. Los registros históricos sin contexto no pueden cerrarse infiriendo una moneda. Los listados históricos no presentan un total agregado entre conciliaciones.

La clave única actual es proveedor + fecha inicial + fecha final, sin moneda: tampoco permite preparar dos conciliaciones con ese mismo intervalo para monedas diferentes. La segunda preparación se rechaza como duplicada; no reutiliza ni combina la primera. Admitir ambos alcances exigiría revisar esa clave y migrar el contexto monetario, con autorización previa de estructura.

### Referencias de pagos

Tesorería selecciona el pago por referencia y captura movimiento, fecha, importe bancario informado y observación. El servidor toma del pago la cuenta de origen y el importe transferido, calcula la diferencia y crea una referencia MANUAL/PENDIENTE. No permite introducir libremente un estado confirmado ni importes del sistema. El detalle enlaza al pago e indica su moneda real.

No hay en este alcance un importador de extractos, verificación de evidencias bancarias, cierre de esta entidad ni confirmación de Bancos. No se presenta una referencia manual como prueba de un movimiento confirmado.

## Parámetros

`CXP_PARAMETRO` controla configuración consumida por servicios. La vista separa grupo, estado y búsqueda y permite comprobar la configuración actual de facturas especiales sin reservar números.

| Configuración conocida | Control y efecto |
| --- | --- |
| CXP_FACTURA_ESPECIAL / SERIE | Texto de 1 a 40 caracteres usado en el registro de factura especial. |
| CXP_FACTURA_ESPECIAL / CORRELATIVO_* | Consulta únicamente. La numeración avanza bajo bloqueo al registrar o emitir; no se reinicia, edita ni crea desde esta administración. |
| CXP_FE_APROBADOR_ROL / ROL_APROBADOR | Selector de rol activo existente, almacenado en VALOR_NUMERO. No es un usuario de acceso ni un usuario operativo. |

El aprobador puede crear o editar configuración permitida, con un único tipo de valor, validación del servidor y unicidad de grupo/código. En una edición no se renombran grupo ni código. Se conservan el último modificador derivado de sesión y la fecha; no se aceptan autores enviados por el cliente. Los grupos no conocidos mantienen sus campos y significado, sin inventar nuevos grupos ni un catálogo fiscal. La configuración demo anterior no se cambió y este bloque no requiere nuevos datos de semilla.

## Períodos

`CXP_PERIODO` controla la cobertura de una sucursal y un intervalo para programar pagos; sus acumulados se consultan, no se capturan. No constituye un cierre contable.

El aprobador crea y abre un rango; año y mes proceden de la fecha inicial y los acumulados iniciales son cero. La creación se serializa y rechaza superposiciones por sucursal con extremos incluidos. No altera un período existente para hacer espacio.

Acciones: ABIERTO/REABIERTO → EN_CIERRE o CERRADO; EN_CIERRE → CERRADO; CERRADO → REABIERTO con motivo obligatorio. Cierre y reapertura registran usuario operativo y fecha de servidor. Cada acción exige versión vigente y conserva trazabilidad. No se ofrecen edición de fechas, saldos ni eliminación.

La comprobación de sucursal y fecha reproduce la regla de pagos: cuenta **todos** los intervalos aplicables, exige exactamente uno y luego comprueba ABIERTO/REABIERTO. Un período abierto superpuesto con otro cerrado sigue siendo conflicto. La pantalla muestra los intervalos y estados en vez de indicar que falta un período. No se añadieron requisitos contables de cierre ajenos al modelo.

## Cuentas bancarias

`CXP_CUENTA_BANCARIA` distingue origen de EMPRESA y destino de PROVEEDOR. La tabla identifica titular, banco, número, moneda y estados CXP, con filtros separados.

El operador registra datos de cuenta y titular; el servidor fija ACTIVA/PENDIENTE y la autoría. El aprobador decide sobre una cuenta activa pendiente o que requiere revalidación. Aprobar exige confirmar coincidencia del titular y prohíbe aprobar la cuenta registrada por esa misma persona. Rechazar exige motivo. No hay selector libre de aprobación o verificación ni edición genérica posterior.

El detalle consulta la integración por propietario, número y banco compatible, **no por igualdad de IDs entre CXP y Bancos**. Informa cero, una o varias coincidencias, moneda, estado, posibilidad de pagos y, para destinos, decisión de verificación, vigencia y documentos registrados. Es un diagnóstico; no comprueba los bytes de las evidencias ni certifica que pueda ejecutarse una transferencia. Las validaciones existentes del flujo de pago siguen siendo la autoridad final.

La aprobación CXP no crea una cuenta MB, no verifica Bancos y no altera las comprobaciones de proveedor, evidencia, vigencia o segregación bancaria. La API administrativa de Bancos está comentada/no montada en el servidor actual: debe completarse la gestión bancaria por el módulo responsable antes de intentar el pago. No se implementaron una verificación ficticia ni una desactivación sin ciclo definido.

## Compromisos

`CXP_COMPROMISO` representa una obligación o fondo vinculable a documentos. Se muestran proveedor, sucursal, tipo, referencia, moneda, vigencia, responsable y estado; el detalle enlaza sus documentos sin sumar monedas incompatibles.

El operador registra la obligación con el estado inicial ACTIVO que utiliza el servicio existente. El servidor inicia el saldo de FONDO_CAJA_CHICA con su monto total. No se capturan autor, estado ni acumulados. El responsable seleccionado es un dato del compromiso, distinto de su autor de sesión.

Para un fondo se muestran comprometido, saldo disponible persistido e importe utilizado calculado con la aritmética monetaria existente. Los gastos aprobados consumen saldo bajo bloqueo y las reposiciones lo recuperan mediante sus aplicaciones; estas operaciones no se sustituyen por edición de campos.

Los demás tipos no disponen de un motor automático de consumo, cuotas o liberación. Por ello se muestra «saldo capital persistido», sin presentarlo como disponibilidad calculada. No se ofrecen eliminación, cancelación, suspensión ni liberación. Para habilitarlas faltan reglas de transición, tratamiento de documentos asociados y reversión de importes; se requiere definirlas antes de implementar esas acciones.

## Componentes, API y archivos

Se reutilizan `CxpLayout`, `CxpPageHeader`, `CxpButton`, `RelationSelect`, `DataTable`, `CxpManagementDialog`, `CxpCaptureSectionHeading` y `CxpFormGuard`. Los formularios son compactos por tarea y conservan errores, progreso y confirmación de cambios pendientes. Se mantiene el acceso explícito a `/cxp`. No se crea un indicador de etapas artificial ni se modifica el UI kit global.

Archivos nuevos principales:

- `client/src/modules/cxp/administracion/{CxpAdministracionPage,OperacionDialog,Herramientas}.tsx` y `vistas.ts`.
- `server/src/modules/cxp/services/administracion/{consulta.service,diagnosticos.service,operaciones.service,conciliacion.service,politica,administracion.test}.ts`.
- `server/src/modules/cxp/routes/administracion.routes.ts`.
- `packages/contracts/src/modules/cxp/administracion.ts` y `client/tests/cxpAdministracion.browser.test.mjs`.

Archivos existentes ajustados en este bloque: las once páginas de Control/Conciliaciones/configuración, `home/cxpHome.config.ts`, `CxpEntityForm.tsx` (opciones aditivas para tareas, con comportamiento anterior por defecto), `CxpManagementUI.tsx` (foco del diálogo superior), `catalogos.repository.ts` (nombres en la conexión actual), `routes/index.ts`, `contracts/cxp/index.ts` y `actor-fields.ts` (autor inicial de parámetros). No se reestructuraron paquetes.

El contrato compartido añade tipos de consulta, detalle, permisos y diagnóstico; conserva los contratos existentes. Las listas incluyen registro y etiquetas de relaciones. Las operaciones exigen versión, campos de tarea y actor de sesión. Rutas principales:

- `GET /administracion/permisos`, `GET /administracion/:entidad`, `GET /administracion/:entidad/:id`.
- `POST /administracion/:entidad`, `PATCH /administracion/:entidad/:id` para configuración permitida.
- `POST /administracion/periodos/:id/{iniciar-cierre,cerrar,reabrir}` y `GET /administracion/periodos/consulta`.
- `POST /administracion/cuentas-bancarias/:id/{aprobar,rechazar}`.
- `GET /administracion/conciliaciones-proveedor/fuentes`, `POST /administracion/conciliaciones-proveedor/preparar`, `POST /administracion/conciliaciones-proveedor/:id/{comparar,cerrar}`.

Todas llevan el prefijo `/api/cxp`, autenticación y controles de sesión existentes. Las escrituras usan las transacciones/rollback existentes; los conflictos de bloqueo, duplicidad y versión se comunican como conflictos, no como éxitos.

## Limitación de auditoría y propuesta sin aplicar

`CK_CXP_EVT_ENTIDAD` exige exactamente una relación financiera en cada evento y no admite relación con parámetro ni regla. No se utilizó una entidad ficticia ni se relajó la restricción. Parámetros conserva último editor/fecha; reglas conserva creador y bloquea modificaciones si ya se utilizó. **No existe historial completo de cada edición de parámetros o reglas en CXP_EVENTO.** Las demás operaciones nuevas sí registran eventos en su transacción.

Propuesta para una fase posterior: permitir referencias explícitas de configuración en la bitácora, mediante relaciones propias con CXP_PARAMETRO/CXP_REGLA_APROBACION y ajuste de la restricción de entidad, o crear una bitácora específica de configuración. Finalidad: almacenar antes/después, actor y fecha sin falsificar una relación financiera. Impacto: DDL, contratos, repositorio de eventos y compatibilidad de informes/instalación; requiere autorización previa y pruebas de migración. Alternativa actual: campos existentes y protección de reglas utilizadas, con la limitación descrita. No se preparó ni aplicó DDL.

Una columna de moneda explícita para conciliaciones permitiría consultar su alcance sin la metadata del evento, pero también necesita decisión de migración para históricos. La alternativa implementada evita inventar moneda y bloquea cierres históricos sin contexto.

## Verificaciones y reproducción

- `pnpm.cmd build`: tipos y compilación de los tres paquetes; advertencias existentes de anotaciones de Zod y tamaño del bundle.
- Servidor: 170 pruebas aprobadas; 3 pruebas Oracle opcionales omitidas en esta ejecución unitaria. Se cargó un protector que impide conexiones Oracle durante esta suite.
- Cliente: 35 pruebas unitarias aprobadas.
- Navegador real Chrome con Vite y API simulada: siete escenarios aprobados, incluido el nuevo de administración y las seis regresiones anteriores. Escritorio 1440×1000 y móvil 390×844 en el escenario nuevo, que cubre las once vistas, filtros combinados, ausencia de acciones no autorizadas, contadores, reglas utilizadas, error/reintento, cambios sin guardar, cierre/reapertura, aprobación CXP, importes del fondo, estados vacíos y conciliación estricta por dos personas. Capturas en `client/node_modules/.cache/cxp-administracion-browser/` (ignoradas por Git). La primera ejecución conjunta detectó una carrera de espera en la prueba de navegación 6/7/8 al recargar: se ajustó `procesosNavegacion.browser.test.mjs` para esperar el documento nuevo y se repitió correctamente, manteniendo sus aserciones y el código de pagos.
- Oracle real local: destino verificado `localhost/orclpdb`, PDB ORCLPDB, esquema PROYECTOANALISISFINAL. Consultas reales de las once entidades y vínculos de las cuentas existentes. DML aislado mediante los servicios reales y una transacción exterior con rollback final: configuración y protección de contador, versiones obsoletas, creación/cierre/reapertura de período, superposición en extremo, registro/aprobación CXP de cuenta, fondo, dos documentos aislados y preparación/comparación/cierre de conciliación. Se rechazaron permisos insuficientes, pendientes, diferencias compensadas, versiones antiguas y mismo elaborador. Se comprobó el cerrador distinto y la autoría original.
- Después del rollback se compararon documentos y pagos originales, estados y saldos, usuarios, cuentas de acceso, vínculos, roles, parámetros y cantidades de registros: iguales al inicio. No quedó configuración nueva ni se actualizaron semillas. Las secuencias pueden consumir números por inserciones revertidas; no se alteraron ni reiniciaron.

Los informes locales están en `client/node_modules/.cache/cxp-administracion/{oracle-consultas,cuentas-existentes,oracle-resultados}.json`; el último informa `rollbackVerificado: true` y `registrosOriginalesIntactos: true`. El respaldo inicial de fuentes y hashes está en el mismo directorio (`baseline/` e `inicial.json`), sin credenciales en este documento.

Las pruebas de navegador usan datos simulados; las de Oracle invocan servicios con actores operativos existentes y no realizan login HTTP. No se verificó una instalación completa, un importador de extractos, una verificación bancaria ni una transferencia real como parte de este bloque. Se conservaron las pruebas de regresión de RF04, reservas/aplicaciones, ejecución transaccional y segregación del flujo CP-*.
