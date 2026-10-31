# Correcciones de pagos, sesión y facturas especiales — 30/10/2026

Rama `carlitos-cabrera`, HEAD `32cedeaf4d81644f70d9f7b1e1c6a4a4e4404124`. Se conservaron los cambios locales anteriores, incluida la alineación del panel de pagos. Sin commit ni push. Se leyeron las instrucciones de AGENTS.md y se mantuvo el monorepo y la arquitectura existente.

## Pagos desde el expediente: causa comprobada

La consulta vigente admite únicamente pagos `ORDINARIO`, con código distinto de `CP-*`, mismo proveedor y moneda del documento, `MONTO_NO_APLICADO > 0` y estado `EJECUTADO`, `CONFIRMADO`, `PARCIALMENTE_APLICADO`, `APLICADO` o `CONCILIADO`. La búsqueda reduce por código o ID y devuelve hasta 50 resultados. El estado por sí solo no convierte un pago consumido en elegible.

El servicio conserva `MONTO_NO_APLICADO = MONTO_OBLIGACION - MONTO_APLICADO`, con operaciones monetarias existentes. Al aplicar exige importe positivo con hasta dos decimales y menor o igual al saldo del pago y del documento. Bloquea las filas y vuelve a validar proveedor, moneda, estado, reservas y saldos dentro de la transacción. La autoría proviene de la sesión y siguen vigentes los permisos por rol del servidor. No se modificaron esos servicios ni se creó una ruta alternativa para aplicar CP.

Auditoría real inicial de Oracle local:

| Pago | Estado | Obligación | Aplicado | Sin aplicar | Interpretación |
| --- | --- | ---: | ---: | ---: | --- |
| CP-00000001 | CONCILIADO | 100 | 100 | 0 | Documento 1 pagado; no aplicar otra vez |
| CP-00000008 | PROGRAMADO | 605 | 0 | 605 | Reserva pendiente de 605 para documento 10; no es dinero libre |
| CP-00000009 | CONCILIADO | 550 | 550 | 0 | Documento 14 pagado; no aplicar otra vez |

No había pagos ordinarios libres. Los documentos 8 y 9 estaban RECIBIDO y PENDIENTE_APROBACION respectivamente; tampoco estaban listos para aplicación. El selector vacío era coherente con estos datos, no una consulta que debía incluir las contraseñas.

Se agregó un contexto de consulta que explica los motivos, muestra la reserva y las aplicaciones de cada CP relacionado y permite abrirlo en la pantalla original de Pagos. Allí se conservan generación del medio, ejecución bancaria, permisos y segregación. Los procesos ya aplicados se muestran para consulta. El saldo bruto sin aplicar de un CP se identifica explícitamente como no reutilizable en el panel ordinario.

Mientras se consulta el contexto o existe reserva, el panel ordinario queda bloqueado. Después de aplicar se recargan expediente, aplicaciones, saldo y contexto; si el saldo llega a cero desaparece el formulario. El buscador conserva la primera fila completa, selector e importe comparten altura y alineación, las ayudas quedan debajo y en móvil los controles se apilan.

Archivos de este bloque:

- `packages/contracts/src/modules/cxp/documento.ts`: contrato aditivo de contexto; no cambia contratos de aplicación existentes.
- `server/src/modules/cxp/services/documentos/documento.pagosContexto.ts`, controlador y rutas de documentos: consulta del contexto.
- `client/src/modules/cxp/documentos/components/DocumentoPagosSection.tsx`, `DocumentoPagoPanel.tsx` y `DocumentoExpedientePage.tsx`: explicación, enlaces, bloqueo visual y actualización.

## Sesión y navegación

El footer común contenía un icono sin acción; la barra superior repetía identidad y logout. Se compuso un footer local CXP con el estilo e icono habituales, nombre accesible/tooltip «Cerrar sesión», bloqueo inmediato de clics repetidos y error visible con posibilidad de reintento. La composición reutiliza Sidebar sin editar componentes comunes. El menú móvil incorpora el mismo footer, control de foco, Escape y restauración del desplazamiento.

Se usa el POST de logout existente y se espera su respuesta. Un fallo de revocación conserva la sesión visible y permite reintentar. Una respuesta satisfactoria o sesión ya expirada limpia estado, catálogos y claves CXP de almacenamiento, desmonta el estado de las pantallas y vuelve al login. Se descartan respuestas JSON y binarias de una sesión anterior; un 401 tardío no expulsa a la cuenta siguiente.

Se retiró la campana y el punto decorativo: el botón no tenía navegación ni funcionalidad asociada.

Archivos de este bloque:

- `client/src/modules/cxp/auth/session.tsx`, nuevo `sessionScope.ts`.
- `client/src/modules/cxp/components/CxpSidebar.tsx`, `CxpTopBar.tsx`, `RelationSelect.tsx` y nuevo `catalogCache.ts`.
- `client/src/modules/cxp/CxpLayout.tsx`, `cxp.css`, `api.ts` y `client/src/shared/api/index.ts`.
- Protección de descarga de constancia en `client/src/modules/cxp/facturas-especiales/api.ts`.

## Facturas especiales: presentación y listado

Documentos y facturas especiales comparten clases de título, subtítulo, encabezado oscuro y footer en `CxpCaptureSection.tsx`; también comparten indicadores de pasos, botones, iconos de avance/registro, controles y separadores. Se igualaron los espacios principales de captura. Los encabezados «Proveedor» y «Operación» dejaron de usar azul y mayúsculas decorativas. No se alteraron los colores funcionales de estados y acciones.

En el listado general se quitó únicamente el indicador redundante de usuario. La captura automática y la consulta de autoría en detalle/historial permanecen. El filtro independiente de proveedor usa el mismo selector de Documentos, se combina con búsqueda y etapa, reinicia la página y puede limpiarse. Se conservaron los conteos del servidor y se acota la página tras cambios de resultados.

Archivos: `CxpCaptureSection.tsx`, `documentos/DocumentoRegistroPage.tsx`, `facturas-especiales/FacturasEspecialesPage.tsx`, `components/FacturaEspecialForm.tsx`, `components/ListadoFacturas.tsx` y `api.ts`.

## Configuración local y semilla

Destino efectivo verificado antes de escribir: conexión loopback `localhost/orclpdb`, PDB `ORCLPDB`, esquema `PROYECTOANALISISFINAL`. No se modificó .env ni se mostraron credenciales.

En el origen faltaban los parámetros de facturas especiales y las reglas tributarias. Se insertaron estos cuatro parámetros activos, sin reemplazar configuración existente:

| Grupo | Código | Valor |
| --- | --- | --- |
| CXP_FACTURA_ESPECIAL | SERIE | FESP |
| CXP_FACTURA_ESPECIAL | CORRELATIVO_FACTURA | 0, sin números previos de esa serie |
| CXP_FACTURA_ESPECIAL | CORRELATIVO_CONSTANCIA | 0, sin constancias previas |
| CXP_FE_APROBADOR_ROL | ROL_APROBADOR | 3, rol activo APROBADOR_CXP comprobado |

Se agregaron dos reglas **ficticias, SIN VALIDEZ FISCAL**, `CXP_DEMO_FE_IMP` (impuesto IVA_DEMO 10 %) y `CXP_DEMO_FE_RET` (retención ISR_DEMO 2 %). Aplican a FACTURA_ESPECIAL, GTQ, base desde cero sin máximo, vigencia 01/10/2026–31/12/2027. Una operación de 100 sin descuento produce impuesto 10, retención 2 y total 108. No representan legislación vigente.

La consulta real en `CXP_REGLA_TRIBUTARIA` filtra por tipo de documento, `VIGENTE_DESDE <= fecha`, `VIGENTE_HASTA` nula o mayor/igual a fecha, y moneda nula o coincidente. La evaluación usa `fechaDocumento` y `moneda` de la captura, no la fecha del servidor. El cálculo aplica los rangos de base y las fórmulas existentes. La consulta no depende de la etiqueta ESTADO: las versiones históricas se determinan por sus fechas.

Guardar en PREPARACION admite cero reglas; enviar a revisión las exige. No se eliminaron controles de revisión, aprobación por rol, separación de creador/aprobador ni emisión/constancia. La numeración existente bloquea la fila del contador con `FOR UPDATE`, incrementa en la misma transacción y forma números de factura de ocho dígitos. La constancia usa `CFE-año-contador`, con contador global, sin reinicio anual.

Se agregó consulta temprana de configuración por fecha/moneda, con mensajes, enlaces a parámetros/reglas en otra pestaña y reintento sin perder captura. Serie y contador de factura inválidos impiden crear; faltas de reglas, contador de constancia o aprobador se advierten para sus etapas posteriores. El servidor revalida antes de crear y conserva la asignación bajo bloqueo. Un contador inferior a números ya usados se rechaza con explicación.

Archivos:

- `packages/contracts/src/modules/cxp/factura-especial.ts`: contrato aditivo de diagnóstico.
- Nuevo `server/src/modules/cxp/services/documentos/facturaEspecial.configuracion.ts`, rutas de factura especial, servicio de creación y repositorio de numeración.
- API y formulario de facturas especiales del cliente.
- `database/oracle/instalacion/02_datos_demo.sql`: incorpora solo las dos reglas demo; los cuatro parámetros ya estaban en la semilla.
- Nuevo `03_configuracion_demo_fe.sql`: reparación DML local, transaccional e idempotente. Conserva valores válidos y toma máximos usados al crear contadores faltantes. No sobreescribe parámetros inválidos/duplicados ni inserta reglas demo si ya hay reglas de facturas especiales. Usa bloqueos NOWAIT sobre configuración y requiere conexión dedicada.
- `LEEME_INSTALACION.md` y `RESULTADOS_VALIDACION.md`: instrucciones y separación de la validación histórica respecto del cambio actual.

`03` se ejecutó dos veces sin duplicar configuración. Solo esos cuatro parámetros y dos reglas permanecen como DML funcional de esta tarea. Los contadores siguen en cero después del rollback de las pruebas; no se reiniciaron manualmente. `01_estructura_completa.sql` conserva su SHA-256 inicial. No se ejecutó DDL ni se cambió estructura.

## Verificación

Pruebas con Oracle real y API HTTP real, autorizadas expresamente por el usuario:

- Cuenta, documento aprobado y pago ordinario aislados de los registros existentes. Pago visible; aplicación de 40 correcta, saldo final cero y autoría de sesión. Repetición rechazada con 409. CP excluido/rechazado y aplicación ordinaria a documento con reserva rechazada con 409.
- Cálculo demo de 100 → 108 y dos facturas PREPARACION con números FESP-00000001 y FESP-00000002. Otra conexión recibió ORA-00054 al intentar bloquear el mismo contador con NOWAIT.
- Filtro real de proveedor + búsqueda + etapa, con dos resultados y dos páginas al usar límite uno.
- Login y logout reales: revocación LOGOUT en SEG_SESIONES; consulta de sesión y acceso protegido posteriores respondieron 401.
- Se compararon los pagos 1/8/9 y documentos 1/8/9/10/14 antes y después: intactos. ROLLBACK final verificado: cero documentos, pagos o cuentas de prueba; tampoco se dejaron sesiones activas de prueba.

Para asegurar reversibilidad se interceptaron los COMMIT internos únicamente en el proceso de prueba, usando una conexión Oracle real y una transacción exterior con savepoints. No se modificó el código productivo para ello. La comprobación de números distintos y bloqueo es real, pero no equivale a un ensayo de dos altas simultáneas confirmadas en producción. Las secuencias identity pueden dejar huecos normales tras rollback.

Verificación automatizada y visual:

- Servidor: **155 pruebas unitarias correctas**, con guardia que impide conectar a Oracle en esa suite.
- Cliente: **34 pruebas unitarias correctas**, usando su tsconfig JSX.
- Navegador Chrome real con API simulada: **5 pruebas correctas**. Incluyen regresiones de documentos/componentes/navegación, aplicación y actualización del expediente, CP relacionado, aviso temprano conservando captura, filtros combinados, estilo calculado igual al de Documentos, un único indicador visible, fallo/reintento de logout, doble clic bloqueado, cambio de cuenta sin catálogo anterior, respuesta 401 y descarga tardías descartadas, logout móvil y alineación/apilado de campos.
- Capturas inspeccionadas a 1440×1000 y 390×844: pagos ordinarios, reserva CP, factura especial, fallo de logout y menú móvil. Estas capturas usan datos simulados; no se presentan como evidencia visual de una sesión Oracle.
- `pnpm.cmd build`: tipos y compilación de contratos, servidor y cliente correctos. Advertencias de anotaciones de Zod y tamaño de bundle de Vite, sin error.
- `git diff --check`: correcto. .env, .env.example y fixtures de instalación conservan sus huellas iniciales. Sin cambios en componentes UI comunes.

Pruebas nuevas: `client/tests/sessionScope.test.ts`, `client/tests/cxpCorrecciones.browser.test.mjs`, `server/src/modules/cxp/services/documentos/documento.pagosContexto.test.ts` y `facturaEspecial.configuracion.test.ts`. Se adaptaron las simulaciones de los navegadores existentes a los dos endpoints de consulta nuevos.

Evidencia local ignorada: `client/node_modules/.cache/cxp-correcciones/` (resultados Oracle, logs, huellas y harness con rollback); capturas bajo `.cache/cxp-correcciones-browser/`. No se incluyen credenciales ni artefactos generados entre los cambios de código.

## Límites

No se repitió la instalación completa de `01`/`02` después de añadir las dos reglas a la semilla; sí se ejecutó y reejecutó la reparación DML con la misma configuración. No se certificaron tasas fiscales ni emisión legal. No se repitió la ejecución bancaria de las contraseñas existentes: sus registros se conservaron y el enlace reutiliza el flujo vigente. No hay commit ni push; los cambios previos y estos ajustes quedan para revisión.
