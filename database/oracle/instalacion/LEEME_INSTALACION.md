# Instalación local del ERP y demo CXP

Esta carpeta instala el esquema completo del proyecto y la configuración inicial para probar CXP. En una instalación nueva se ejecutan **dos scripts SQL**, `01` y `02`. No se necesita ejecutar migraciones, diagnósticos ni el aprovisionador de cuentas por separado. `03_configuracion_demo_fe.sql` es una reparación DML opcional para una instalación local existente que carezca de configuración de facturas especiales.

Fuentes compatibles: **Develop, commit `97e764135d6c27bf2f80396373f37006345d44c1`**, merge de carlitos-cabrera del PR #7. La estructura se contrastó con `DDL_CORREGIDO_F5.sql`, metadata y código PL/SQL de Oracle local, migraciones y código final de autenticación, documentos y pagos. No se modificó el DDL anterior.

Estos entregables son nuevos archivos locales: mientras no se publiquen en el repositorio, hay que compartir también esta carpeta y `server/.env.example`. Clonar el commit compatible por sí solo todavía no descarga esta entrega.

## 1. Preparación mínima

- Oracle Database **21c**, con una PDB local accesible y un **usuario/esquema nuevo y vacío**. Se validó en Oracle 21c Enterprise; otras versiones y ediciones no se probaron.
- SQL Developer conectado directamente a ese usuario en su PDB local. La cuenta debe poder crear tablas, secuencias, vistas y procedimientos/packages: `CREATE SESSION`, `CREATE TABLE`, `CREATE SEQUENCE`, `CREATE VIEW`, `CREATE PROCEDURE`. Necesita cuota suficiente en su tablespace predeterminado; 100 MB es una referencia para esta demo. No necesita DBA.
- La creación del usuario, los privilegios y la cuota corresponden al administrador de la instalación Oracle local; no forman parte de los dos scripts. Si ya se dispone de un esquema vacío con esos permisos, no hay otro aprovisionamiento de base de datos.
- Node.js y pnpm para instalar y arrancar el monorepo. Validación realizada con Node 24.13.1 y pnpm 10.34.5.

No conectarse al esquema original para instalar. Los scripts no crean usuarios, no cambian de contenedor y no incluyen instrucciones de eliminación de objetos o limpieza de datos.

## 2. Ejecución en SQL Developer

1. Revisar el usuario y el servicio de la **conexión local de destino**. Usar una conexión dedicada, sin transacciones pendientes ni otros procesos escribiendo en ella.
2. Abrir `01_estructura_completa.sql`, seleccionar esa conexión y ejecutar **todo el archivo con F5 / Ejecutar script**. No ejecutar una selección ni usar Ctrl+Enter por fragmentos. Esperar el mensaje `Estructura creada y todos los objetos VALID. Ejecutar 02_datos_demo.sql.`
3. Solo si el paso anterior terminó sin errores, abrir `02_datos_demo.sql` en la misma conexión y ejecutar **todo con F5**. Esperar `Semilla completa: 5 cuentas, 25 proveedores, 50 reglas y cuentas bancarias simuladas.` El script confirma su propia transacción.

`01` comprueba `USER_OBJECTS` antes de crear nada. Si encuentra objetos, cancela la instalación. El DDL tiene commits implícitos de Oracle: un error posterior puede dejar estructura parcial; conservar ese destino para diagnóstico y preparar **otro esquema vacío**. No volver a ejecutar `01` sobre el destino parcial.

`02` exige que todas las tablas estén vacías. Una segunda ejecución cancela con una explicación y no duplica datos. Todo el DML vive en un único bloque PL/SQL con `ROLLBACK` y relanzamiento del error. Tras una carga fallida, las secuencias pueden haber avanzado; esto es normal en Oracle y la semilla resuelve las relaciones con `RETURNING`, sin depender de que los IDs empiecen en 1.

No ejecutar además `database/oracle/install.sql`, el DDL anterior ni las migraciones sobre esta instalación: su estructura final ya está consolidada en `01`.

## 3. Fuentes y configuración de la aplicación

Para una copia nueva:

```text
git clone --branch Develop https://github.com/ulicesctech/Proyectoanalisis_CuentasPorPagar.git
cd Proyectoanalisis_CuentasPorPagar
git checkout --detach 97e764135d6c27bf2f80396373f37006345d44c1
```

Incorporar la carpeta de esta entrega si aún no está publicada. Copiar `server/.env.example` a `server/.env` y completar **las credenciales propias del esquema Oracle recién instalado**. No usar las contraseñas de aplicación de la sección siguiente como credenciales Oracle.

```dotenv
NODE_ORACLEDB_USER=<usuario_del_esquema_local_nuevo>
NODE_ORACLEDB_PASSWORD=<su_contraseña_Oracle>
NODE_ORACLEDB_CONNECTIONSTRING=localhost:1521/orclpdb
PORT=3000
```

`orclpdb` es un ejemplo de servicio local: sustituirlo por el servicio real de la PDB de cada integrante. El archivo de ejemplo conserva los demás parámetros `AUTH_*`. No definir el antiguo `CXP_AUTH_MODE=provisional`. `AUTH_ALLOW_INSECURE_HTTP=true` solo se admite con host y orígenes locales y fuera de producción.

Desde la raíz del monorepo:

```text
pnpm install --frozen-lockfile
pnpm --filter @erp/contracts build
pnpm dev
```

En Windows, si PowerShell bloquea `pnpm.ps1`, usar `pnpm.cmd` en los mismos comandos. Son la instalación habitual de dependencias y el arranque; no aprovisionan cuentas ni modifican Oracle.

Abrir **http://localhost:5173**. El cliente usa por defecto `http://localhost:3000/api`; no necesita `.env` propio para esta configuración. Si cambia la URL, configurar `VITE_API_URL` en el entorno del cliente y ajustar `CORS_ORIGINS` a su origen exacto, sin ruta ni barra final. Usar `localhost` de forma consistente en las URLs del navegador y la API para las cookies de sesión.

## 4. Cuentas exclusivas de demostración

| Cuenta | Contraseña demo | Rol operativo CXP |
| --- | --- | --- |
| `andres.cxp` | `DemoCxp-Operador-2026!` | `OPERADOR_CXP` |
| `aprobador.cxp` | `DemoCxp-Aprobador-2026!` | `APROBADOR_CXP` |
| `programador.cxp` | `DemoCxp-Programador-2026!` | `TESORERIA_CXP` |
| `ejecutor.cxp` | `DemoCxp-Ejecutor-2026!` | `TESORERIA_CXP` |
| `confirmador.cxp` | `DemoCxp-Confirmador-2026!` | `TESORERIA_CXP` |

Los cinco hashes son nuevos, exclusivos de demo y Argon2id v19, con `m=19456`, `t=2`, `p=1`, como `ARGON2_OPTIONS` del login. `DEBE_CAMBIAR_CLAVE='N'` se eligió expresamente para permitir pruebas inmediatas: **no se solicita cambio en el primer ingreso**. Todas las cuentas empiezan activas, con cero intentos fallidos, sin bloqueo, sin último login y sin sesiones. `SEG_SESIONES` se llena únicamente mediante el login normal.

`SEG_USUARIOS.ROL='OPERADOR'` no concede permisos CXP. Estos provienen del rol real de `USUARIO`, enlazado mediante `CXP_CUENTA_USUARIO`. El programador, ejecutor y confirmador son tres usuarios operativos distintos. Se conserva también el catálogo `SUPERVISOR_CXP`, pero no se agrega una sexta cuenta de supervisor; la anulación no forma parte de la prueba demo principal.

## 5. Datos disponibles y archivos

- Una empresa, una sucursal, un departamento y la moneda local GTQ, según la configuración local comprobada.
- Veinticinco proveedores ficticios `CXP_DEMO25_PROV_01` a `CXP_DEMO25_PROV_25`, condiciones de crédito de 0, 15 y 30 días y formas de pago transferencia/cheque.
- Una cuenta origen de empresa y una cuenta destino por proveedor en CXP y Bancos. Banco BI y números ficticios que coinciden en ambos módulos. Una chequera de configuración, sin cheques emitidos.
- Una regla DOCUMENTO y una PAGO por proveedor: GTQ, nivel 1, un aprobador, montos de 0 a 1 000 000 000, sin condiciones adicionales ni delegación. Vigentes del 01/10/2026 al 31/12/2027. Las 50 reglas apuntan al rol real `APROBADOR_CXP`; no se agregan reglas generales superpuestas.
- Quince períodos abiertos, mensuales y sin solapamientos, entre octubre de 2026 y diciembre de 2027. Fuera de ese intervalo hay que configurar períodos y vigencias mediante las funciones habituales de la aplicación.
- Serie `FESP`, correlativos iniciales en cero y parámetro `CXP_FE_APROBADOR_ROL/ROL_APROBADOR` con el ID generado de `APROBADOR_CXP`.

Las dos evidencias bancarias de `fixtures/` son **simulaciones locales sin validez bancaria**. `MB_DOCUMENTO_BANCARIO` guarda sus rutas relativas a la raíz del repositorio, tamaño y SHA-256. Las 25 verificaciones de cuentas son configuración ficticia inicial, con solicitante distinto del verificador y vigencia hasta 31/12/2027. No corresponden a pagos ni a una revisión humana real. No hay que copiar archivos a `server/storage`.

`fixtures/dte_demo.xml` permite adjuntar un DTE ficticio durante la prueba RF04. No está asociado a un documento inicial: se carga desde la aplicación. Por defecto, el backend guarda los nuevos adjuntos en `server/storage/cxp-dte` al arrancar con pnpm; crea el directorio al cargar el primer archivo. Opcionalmente puede definirse `CXP_DTE_STORAGE_DIR` con una ruta absoluta **propia** y escribible; no es necesaria para la instalación local estándar.

## 6. Prueba manual del flujo principal

1. Ingresar como `andres.cxp`. Registrar una FACTURA electrónica, SIN_OC, en GTQ y con tipo de cambio 1; seleccionar la sucursal demo, cualquier proveedor demo y una condición de crédito activa. Usar fecha de hoy dentro de un período abierto, serie/número/UUID nuevos. La autoría se completa desde la sesión.
2. En el expediente, agregar dos líneas: 2 × 150 sin descuento y 3 × 100 con descuento 50. Agregar a cada línea un impuesto porcentual ficticio del 10 %, base derivada y tratamiento no recuperable. Adoptar los totales: subtotal 600, descuento 50, impuesto 55, total neto **605**. Esta tasa es un dato de prueba, no una configuración fiscal oficial.
3. Adjuntar `fixtures/dte_demo.xml` y validar RF04. Debe pasar de RECIBIDO a PENDIENTE_APROBACION. Sin adjunto, la validación debe rechazarlo.
4. Salir e ingresar como `aprobador.cxp`; aprobar el documento con su regla disponible. El creador no puede aprobar su propio documento.
5. Como `andres.cxp`, crear la contraseña de pago de ese documento, seleccionar transferencia, cuenta origen de empresa y destino del mismo proveedor, y solicitar autorización.
6. Como `aprobador.cxp`, aprobar la autorización de pago.
7. Como `programador.cxp`, programar para hoy y generar la transferencia. Una fecha futura no permite ejecutarla anticipadamente.
8. Como `ejecutor.cxp`, ejecutar la transferencia. Como `confirmador.cxp`, confirmarla. Cada cambio de identidad requiere cerrar sesión e iniciar la siguiente.
9. Revisar el expediente: documento PAGADA, aplicado 605, saldo **0**. En Bancos, transferencia EJECUTADA y operación CONFIRMADA. La interfaz reutiliza nombres internos como `CHEQUE_EMITIDO`, `ENTREGADO` y `COBRADO` también para transferencias; son los estados del código compatible.

La instalación no trae documentos, pagos, aplicaciones, autorizaciones, eventos operativos ni el documento del ejercicio original. Todo lo anterior se crea durante la prueba.

## 7. Límites y resultado verificado

La prueba desde cero, el rollback, los generadores y el flujo HTTP completo están detallados en [RESULTADOS_VALIDACION.md](RESULTADOS_VALIDACION.md). Los dos SQL se ejecutaron mediante el driver Oracle, con las mismas sentencias que procesa F5; la interfaz de SQL Developer y la navegación manual del navegador no se automatizaron.

En el origen había 16 cuerpos de packages INVALID, sin filas en `USER_ERRORS`. Sus fuentes se conservaron y **los 16 compilaron VALID en el destino aislado**, sin modificar el esquema original. El final de `01` cancela si quedan objetos INVALID. El flujo CXP validado usa SQL directo del repositorio bancario; un cambio TypeScript no implica una modificación del package PL/SQL.

La metadata instalada no declara FK para `USUARIO.USU_ID_ROL`, `USU_ID_DEPARTAMENTO` ni varias referencias comunes/auditoras de Bancos. Se conservó esa estructura. La semilla resuelve sus referencias lógicas con variables, además de las FK físicas, y verifica los vínculos operativos antes de confirmar; no se agregaron restricciones compartidas nuevas.

`MB_VERIFICACION_CTA_PROVEEDOR.VERIFICACION_ID` no tiene identity, secuencia ni trigger. Sus 25 filas de configuración usan IDs explícitos 1–25. El package instalado `MB_VERIFICACION` conserva su mecanismo preexistente `MAX + 1` bajo bloqueo de tabla; la semilla no lo usa como generador ni inventa una secuencia. Las siguientes verificaciones de ese package parten de los datos existentes. Cambiar ese mecanismo requeriría un cambio separado en Bancos.

La semilla incluye dos reglas de facturas especiales **ficticias, sin validez fiscal**: impuesto `IVA_DEMO` del 10 % y retención `ISR_DEMO` del 2 %, identificadas como `CXP_DEMO_FE_IMP` y `CXP_DEMO_FE_RET`. Solo se aplican a `FACTURA_ESPECIAL`, GTQ y fechas del 01/10/2026 al 31/12/2027, desde base cero y sin máximo. Una base de 100 sin descuento produce impuesto 10, retención 2 y total a pagar 108. Estos porcentajes no representan legislación vigente.

Para un esquema local existente, revisar y ejecutar **solo** `03_configuracion_demo_fe.sql` con F5 en una conexión dedicada sin transacciones pendientes. No volver a ejecutar `01` ni `02`. `03` verifica conexión local, conserva parámetros válidos, agrega únicamente los faltantes y rechaza duplicados, valores inválidos o correlativos inferiores a números utilizados. Solo agrega las reglas demo si no existe ninguna regla de facturas especiales; no completa parcialmente ni sustituye configuraciones tributarias existentes. Usa bloqueos breves `NOWAIT`, revierte ante error y confirma su propio DML; no contiene DDL ni crea operaciones o sesiones.

Los parámetros son `CXP_FACTURA_ESPECIAL / SERIE` (`FESP` como demo), `CORRELATIVO_FACTURA`, `CORRELATIVO_CONSTANCIA` y `CXP_FE_APROBADOR_ROL / ROL_APROBADOR`. En una reparación, los contadores faltantes parten de los números ya usados, sin reiniciar los existentes. La API bloquea la fila del contador con `FOR UPDATE` antes de incrementarlo. La fecha de operación y la moneda determinan las reglas vigentes; también se evalúa el rango de base. Sin reglas puede guardarse en preparación, pero no enviarse a revisión. La interfaz permite corregir la configuración en otra pestaña y volver a comprobar sin perder la captura.

El 30/10/2026 se comprobó en Oracle local la reparación idempotente, el cálculo anterior, dos registros en preparación con números distintos y el bloqueo del contador desde otra conexión. Las operaciones de prueba se revirtieron; la configuración demo permanece. No se repitió la instalación completa de `01`/`02` después de agregar estas dos reglas. No se certifica emisión fiscal ni tasas legales. Las pantallas/API de Compras y Bancos no están montadas como módulos completos en el servidor compatible; esta entrega incluye sus estructuras y las dependencias que CXP sí consume.
