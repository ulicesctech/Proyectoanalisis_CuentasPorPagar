# Resultados de validación — 29/10/2026

> Esta es la validación histórica de la instalación original. El 30/10/2026 se agregaron dos reglas tributarias ficticias a `02` y el script DML de reparación local `03_configuracion_demo_fe.sql`. La semilla actual incorpora 210 filas en 23 tablas (dos reglas más); no se repitió la instalación completa de `01`/`02` tras ese cambio. La reparación se ejecutó dos veces sin duplicar datos y se verificaron registro, cálculo y bloqueo de numeración mediante operaciones reales con rollback. Véanse el apartado final de LEEME y [el informe de correcciones](../../../docs/cxp/correcciones-pagos-sesion-facturas.md). Las cifras y huellas siguientes describen el ensayo original, no una nueva ejecución de la semilla modificada.

Commit compatible de Develop: `97e764135d6c27bf2f80396373f37006345d44c1` (PR #7). Las referencias se actualizaron con `git fetch origin`; la rama de trabajo se conservó. El contenido de HEAD coincide con el merge, sin necesidad de cambiar de rama. No se hizo commit ni push.

## Fuentes y extracción

- `DDL_CORREGIDO_F5.sql`: SHA-256 `16f44e43d92266eff72a4205a5172721fae00cbdcf10a63aa87080398fb0c89c`. Se leyó sin sobrescribirlo.
- Diccionario real: USER_OBJECTS, USER_TAB_COLUMNS, USER_TAB_IDENTITY_COLS, USER_CONSTRAINTS, USER_CONS_COLUMNS, USER_INDEXES, USER_IND_COLUMNS, USER_SEQUENCES, USER_SOURCE, USER_DEPENDENCIES y USER_ERRORS. DDL mediante DBMS_METADATA; fuentes PL/SQL mediante USER_SOURCE.
- Migraciones 001 de facturas especiales/tributos, creación de CXP_CUENTA_USUARIO y preparación de roles y aprobadores. Se contrastaron con el estado instalado; no se concatenaron sus CREATE/ALTER/MERGE.
- Código final de auth, identidad, componentes/RF04, aprobación documental, procesos de pago y proceso-bank.repository.

Antes de consultar el origen se comprobó la conexión efectiva de dotenv más variables de proceso: loopback local. Oracle confirmó SERVER_HOST igual al nombre del equipo ejecutor y servicio de la PDB local. No se incorporaron credenciales de conexión, archivos .env ni rutas personales a los entregables.

La extracción omite propietario, atributos físicos, almacenamiento y tablespaces. Conserva tipos, longitudes, escalas, defaults, modalidad identity, claves, checks, índices funcionales y código. Las 23 secuencias explícitas y las identities empiezan en 1 en una instalación nueva; no se exportan sus avances operativos del origen. Las secuencias ISEQ se crean con las columnas identity, sin duplicarlas.

El orden es: guardia de esquema vacío; secuencias; todas las tablas y claves locales; claves/índices que DBMS_METADATA emitió separados; 297 FK; índices adicionales; vistas; 16 especificaciones; 16 cuerpos de packages; comprobación de compilación. Se separaron las sentencias múltiples que DBMS_METADATA devuelve para algunas tablas y se extrajo cada especificación/cuerpo una sola vez.

## Diferencias frente al DDL anterior

| Elemento | Resultado |
| --- | --- |
| Tablas | 113 anteriores + **CXP_CUENTA_USUARIO** = 114 |
| Tabla nueva | SEG_ID_USUARIO y USU_ID_USUARIO; PK_CXP_CUENTA_USUARIO, UQ_CXP_CUENTA_USUARIO_OPERATIVO, FK_CXP_CUENTA_SEG y FK_CXP_CUENTA_USU |
| índices nuevos | Los dos que respaldan PK/UNIQUE de CXP_CUENTA_USUARIO |
| Packages | Se incorpora **PKG_MB_FORMATOS_IMPORTACION**, especificación y cuerpo presentes en Oracle |
| Otros 15 packages | Mismo código al comparar fuentes sin comentarios/espacios de presentación |
| Tablas anteriores | Mismo conjunto de columnas; ninguna columna agregada o retirada |
| CHECK anteriores | Las 228 condiciones nombradas del DDL anterior coinciden con Oracle |
| Restricciones nombradas | Ninguna retirada; solo las cuatro de la tabla nueva se incorporan |
| Secuencias explícitas y vistas | Mismos 23 y ocho nombres del DDL anterior |
| Triggers, tipos propios, funciones/procedimientos independientes | No existen en el esquema consultado; no se inventaron |

SEG_USUARIOS y SEG_SESIONES ya estaban en el DDL anterior y se incluyen completas. Las estructuras de facturas especiales/tributos ya estaban instaladas y se incluyen en su forma final, sin recrearlas por migración. La corrección ORA-02014 del repositorio TypeScript de transferencias no se atribuye a un cambio de package.

## Instalación y compilación

Instalación final comprobada en el esquema nuevo **CXP_IT_1793316174532**, separado del origen, en Oracle 21c local. Se ejecutaron **635 sentencias** de 01 (633 DDL y dos bloques de control) y el bloque transaccional completo de 02 usando node-oracledb y separación de sentencias SQL/PLSQL. La interfaz gráfica F5 de SQL Developer no se ejecutó; se proporciona su formato de script y se documenta el uso de F5 completo.

| Objetos finales | Cantidad |
| --- | ---: |
| Tablas | 114 |
| Columnas visibles | 1411 |
| Restricciones totales, incluidos NOT NULL | 1533 |
| PK / UNIQUE / FK | 114 / 61 / 297 |
| índices, incluidos los de claves y LOB | 315 |
| Secuencias explícitas / identity | 23 / 75 |
| Vistas | 8 |
| Especificaciones / cuerpos de package | 16 / 16 |
| Segmentos LOB del diccionario | 9 |
| Objetos INVALID / errores de compilación | **0 / 0** |

Paridad entre origen y destino: **1411 columnas** con tipos, longitudes, precisión, escala, nullabilidad, defaults e identity coincidentes, normalizando solo el nombre de la secuencia identity. Coinciden las **1533 restricciones** en cantidad y todas las restricciones nombradas en tipo, condición, habilitación y validación. Las 12155 líneas de fuentes PL/SQL conservan su lógica al comparar sin comentarios y espacios de presentación.

En el origen, antes de exportar, los siguientes 16 cuerpos estaban INVALID; USER_ERRORS no tenía filas:

- `MB_CONCILIACION`
- `MB_FONDOS`
- `MB_IMPORTACION`
- `MB_VERIFICACION`
- `PKG_MB_BANCOS`
- `PKG_MB_CATALOGOS`
- `PKG_MB_CHEQUERAS`
- `PKG_MB_CUENTAS`
- `PKG_MB_FORMATOS_IMPORTACION`
- `PKG_MB_INTEGRACION_CXC`
- `PKG_MB_INTEGRACION_CXP`
- `PKG_MB_OPERACIONES`
- `PKG_MB_PAGOS`
- `PKG_MB_PARAMETROS_CONCILIACION`
- `PKG_MB_PLANTILLAS_CHEQUE`
- `PKG_MB_REGLAS_APROBACION`

Todos compilaron VALID en el destino aislado al instalar sus dependencias antes de los cuerpos. No se ejecutó ALTER COMPILE ni se reemplazaron objetos en el origen. Esta entrega no presenta los estados INVALID originales como funcionales sin comprobarlos: se comprobó la compilación en el destino nuevo. La consulta final verificó que la metadata completa de objetos original, incluidos estados y LAST_DDL_TIME, y las 23 tablas de configuración inspeccionadas no cambiaron.

Durante la preparación se detectó una falta de separadores en la primera exportación de sentencias múltiples (ORA-00922); se corrigió antes de la instalación final. La prueba de rollback detectó referencias lógicas sin FK que aún usaban IDs originales; se corrigieron con variables generadas y se repitió el flujo satisfactoriamente con IDs avanzados. No quedan errores de exportación conocidos en la ejecución final.

Para no eliminar ni reconstruir destinos, se conservaron los esquemas de ensayos anteriores: CXP_IT_1793315321404 (exportación inicial parcial), CXP_IT_1793315541735 (primera instalación y flujo), CXP_IT_1793316047426 (detección de referencias tras rollback), además del destino final indicado arriba. No se eliminó ningún destino existente. Estos esquemas de ensayo no son un paso que el equipo deba repetir.

## Semilla inicial

**208 filas en 22 tablas**; conteos tomados antes de crear las operaciones del ensayo HTTP.

| Tabla | Filas |
| --- | ---: |
| `CXC_CONDICIONES_CREDITO` | 3 |
| `CXC_EMPRESAS` | 1 |
| `CXC_FORMAS_PAGO` | 2 |
| `CXC_SUCURSALES` | 1 |
| `CXP_CUENTA_BANCARIA` | 26 |
| `CXP_CUENTA_USUARIO` | 5 |
| `CXP_PARAMETRO` | 4 |
| `CXP_PERIODO` | 15 |
| `CXP_REGLA_APROBACION` | 50 |
| `DEPARTAMENTO` | 1 |
| `MB_BANCO` | 1 |
| `MB_CATALOGO_BANCARIO` | 4 |
| `MB_CHEQUERA` | 1 |
| `MB_CUENTA_BANCARIA` | 1 |
| `MB_CUENTA_BANCARIA_PROVEEDOR` | 25 |
| `MB_DOCUMENTO_BANCARIO` | 2 |
| `MB_VERIFICACION_CTA_PROVEEDOR` | 25 |
| `MONEDA` | 1 |
| `PROVEEDOR` | 25 |
| `ROL` | 5 |
| `SEG_USUARIOS` | 5 |
| `USUARIO` | 5 |

Las demás 92 tablas quedan vacías. En particular, SEG_SESIONES, SEG_RECUPERACION, SEG_BITACORA_ACCESO, CXP_DOCUMENTO, CXP_DOCUMENTO_DETALLE, CXP_DOCUMENTO_TRIBUTO, CXP_ARCHIVO, CXP_APLICACION, CXP_PAGO, CXP_APROBACION, CXP_EVENTO, MB_OPERACION_BANCARIA y MB_TRANSFERENCIA_BANCARIA no reciben datos iniciales. Las verificaciones bancarias sembradas son únicamente configuración simulada, marcada como tal en cada fila. Las operaciones y sesiones creadas después por el ensayo permanecen exclusivamente en el destino de ensayo; no se exportaron a 02.

Se comprobaron reglas de DOCUMENTO/PAGO compatibles con APROBADOR_CXP para **los 25 proveedores**, sin posiciones adicionales que exijan aprobadores inexistentes. También se comprobaron sus 25 cuentas compatibles entre CXP y Bancos, moneda, evidencias y solicitante/verificador distintos.

## Atomicidad, integridad e IDs

- Reejecutar 01 rechaza el esquema no vacío con -20001, antes de DDL. Reejecutar 02 rechaza tablas pobladas con -20002 y rollback. No hubo duplicación.
- Se inyectó un fallo privado inmediatamente antes del COMMIT de 02, después de sus INSERT y validaciones. Se verificaron **las 114 tablas vacías** tras el rollback. El archivo entregado no contiene esa inyección.
- Se cargó de nuevo el archivo 02 íntegro sobre esa estructura vacía, con secuencias/identity ya avanzadas. Los logins funcionaron con usuarios operativos 6, 7, 10, 8 y 9, demostrando que el vínculo no depende de IDs 1–5.
- Las **75 identity** y las **23 secuencias explícitas** entregaron NEXTVAL superior a los IDs presentes en sus tablas. Todas las FK quedaron ENABLED/VALIDATED.
- Se ejecutaron INSERT normales mediante la API después de sembrar: sesión, documento, detalle, tributo, archivo, aprobación, pago, aplicación, evento, operación bancaria y transferencia; no hubo ORA-00001 por generadores.
- USUARIO y diversas columnas comunes/auditoras de Bancos carecen de FK física en el origen. La carga también resuelve esas referencias lógicas con RETURNING y conserva la ausencia de FK. RESPONSABLE_ID/CUSTODIO_ID siguen las identidades operativas de la configuración demo; el esquema no declara su relación física con otra entidad.
- VERIFICACION_ID no tiene generador instalado. La semilla usa sus IDs fijos 1–25. Se conserva, sin ejecutarlo durante la carga, el MAX + 1 bajo bloqueo del package preexistente MB_VERIFICACION; no se añadió una secuencia ni se cambió Bancos.

## Prueba de aplicación real

Servidor Express local en puerto efímero, con los routers y middlewares reales del commit compatible: sesiones Oracle, origen, CSRF, CXP y errores. Todas las conexiones de prueba apuntaron al usuario aislado mediante variables del proceso; no se modificó .env.

| Cuenta | Rol comprobado | Capacidad |
| --- | --- | --- |
| `andres.cxp` | `OPERADOR_CXP` | `CREAR` |
| `aprobador.cxp` | `APROBADOR_CXP` | `APROBAR` |
| `programador.cxp` | `TESORERIA_CXP` | `TESORERIA` |
| `ejecutor.cxp` | `TESORERIA_CXP` | `TESORERIA` |
| `confirmador.cxp` | `TESORERIA_CXP` | `TESORERIA` |

Hashes Argon2id nuevos verificados con las contraseñas documentadas, cambio obligatorio desactivado conscientemente y tres identidades distintas de tesorería. Login HTTP y resolución de rol correctos para las cinco cuentas. Lectura CXP sin sesión rechazada. Logout correcto de las cinco cuentas al finalizar. El parámetro por rol de facturas especiales autorizó únicamente al usuario APROBADOR_CXP mediante el repositorio real.

El flujo completo se ejecutó con **CXP_DEMO25_PROV_02**, no con el proveedor 1:

1. Alta de documento RECIBIDO, condición de crédito activa y autoría automática.
2. Dos líneas y dos tributos ficticios del 10 %; neto 605 e impuesto 55.
3. RF04 rechazó el expediente sin DTE. Se cargó y descargó el XML real del fixture, comparando sus bytes. RF04 completo avanzó a PENDIENTE_APROBACION.
4. El creador no pudo aprobar; el aprobador correcto dejó el documento APROBADA.
5. Contraseña de pago, solicitud, aprobación, programación y generación bancaria.
6. El programador no pudo ejecutar; el ejecutor distinto ejecutó. El ejecutor no pudo confirmar; el confirmador distinto confirmó.
7. Resultado: **documento PAGADA, aplicado 605, saldo 0; transferencia EJECUTADA y operación CONFIRMADA**. El creador documental se conservó y los actores bancarios coincidieron con las sesiones de programación y confirmación.

Las dos evidencias bancarias se abrieron desde sus rutas relativas y coincidieron en tamaño y SHA-256:

| Fixture | Bytes | SHA-256 |
| --- | ---: | --- |
| `carta_solicitud_SIMULACION_LOCAL.txt` | 336 | `8da19020abe546146fe23b652b1b6bee77327f6da789ff400215fc80edb1bbe2` |
| `constancia_bancaria_SIMULACION_LOCAL.txt` | 335 | `a9b43dbf9b9363489e5808b1ab74b4c1ed8a7150565956041c435c547881b7a8` |

## Compilación y pruebas existentes

- `pnpm --filter @erp/contracts build`: correcto.
- `pnpm --filter @erp/server build`: correcto.
- `pnpm --filter @erp/client build`: correcto; advertencias existentes de anotaciones de Zod y tamaño de bundle, sin errores.
- Pruebas compiladas de `server/dist`, excluyendo pruebas Oracle optativas: **149 correctas, cero fallos, cero omitidas**, mediante `node --test --test-concurrency=1`. Incluyen login, identidad, CSRF, RF04, componentes, aprobación, segregación, pagos y repositorio bancario.

En este entorno pnpm se invocó como pnpm.cmd. El runner tsx encontró una limitación del entorno Windows al consultar os.userInfo; se ejecutaron los mismos tests compilados por tsc con Node. La primera compilación de Vite encontró una restricción de lectura del sandbox; la repetición autorizada fuera de esa restricción compiló correctamente.

## Límites pendientes

- La ejecución visual de F5 en SQL Developer y la navegación de las pantallas deben comprobarse manualmente; la instalación Oracle y el flujo HTTP sí se ejecutaron.
- No se validaron otras versiones/ediciones de Oracle, otros sistemas operativos ni concurrencia durante la instalación; debe realizarse sobre una conexión dedicada.
- En el ensayo original no había reglas tributarias de facturas especiales. La actualización del 30/10 incorpora reglas explícitamente ficticias del 10 % y 2 %; se comprobó registro en preparación, cálculo y numeración con rollback. Sigue pendiente la definición fiscal y la prueba completa de emisión de facturas especiales.
- No se ejecutó el antiguo test:fe: usa cabecera de actor e IDs fijos de una etapa anterior al login. La configuración de aprobador se comprobó con el repositorio vigente.
- La transferencia de esta demo actualiza la integración local en Oracle; no envía dinero a una entidad bancaria. Los fixtures y tasas del ejercicio son ficticios.
- Los períodos y reglas demo llegan hasta el 31/12/2027. Solo GTQ estaba configurada en el origen. No se sembraron módulos completos de Compras/CxC ni una cuenta de supervisor para anulaciones.

## Huellas de los SQL entregados

- `01_estructura_completa.sql`: SHA-256 `d99d7cb484cec5aeeb8d80691e14a97f5685d56349a17699e9a4f69239bcb8ee`.
- `02_datos_demo.sql`: SHA-256 `d6813cd928055f7194d3038fa6703b94f0e0af3ffcb9c1486976b3cf5299df00`.
