# Login y autoría de CXP

## Antes de habilitarlo

1. En la base **destino**, ejecutar únicamente los SELECT de
   `database/oracle/09_migraciones/diagnostico_cxp_cuenta_usuario.sql`.
   Confirmar que `SEG_USUARIOS`, `SEG_SESIONES`, `USUARIO` y `ROL` existen con
   las columnas, claves y restricciones del `DDL_CORREGIDO_F5.sql` previsto.
   Ese archivo no demuestra qué objetos están instalados. Resolver nombres de
   usuario o rol ambiguos antes de continuar. No copiar IDs entre tablas.
2. Con autorización del administrador, aplicar
   `database/oracle/09_migraciones/crear_cxp_cuenta_usuario.sql` a la base
   destino. No ejecutar el DDL completo como parte de este cambio.
3. Configurar la API y `VITE_API_URL` del cliente para apuntar a su URL HTTPS.
   Se requieren las variables Oracle existentes y `CORS_ORIGINS` con el origen
   exacto del cliente. En HTTPS, la cookie es
   `Secure`, `HttpOnly`, `SameSite=Lax`, con alcance `/` y sin `Domain`.
   Para **desarrollo local HTTP** únicamente, configurar explícitamente
   `AUTH_ALLOW_INSECURE_HTTP=true`; el servidor lo rechaza en producción o con
   `HOST`/`CORS_ORIGINS` no locales. La opción antigua
   `CXP_AUTH_MODE=provisional` debe retirarse de la configuración del entorno.
4. Los valores iniciales son: 30 minutos de inactividad, ocho horas de vida
   absoluta, cinco fallos de cuenta antes de un bloqueo de 15 minutos y 20
   intentos por IP del socket en 15 minutos. Todos se pueden ajustar con las
   variables `AUTH_*` de `server/.env.example`. El límite IP es en memoria por
   instancia: si se despliega más de un servidor, usar un limitador compartido
   antes de exponer el login. No se confía en `X-Forwarded-For`.

## Aprovisionamiento manual

No hay registro público ni panel de cuentas. El administrador del entorno
selecciona un `USUARIO` existente y activo que ya tenga `ROL` activo. En una
terminal interactiva, establece `CXP_PROVISION_TARGET` con el mismo destino
Oracle que haya revisado en la configuración del proceso, y ejecuta desde
`server`:

```text
pnpm exec tsx scripts/provision-cxp-account.ts
```

La herramienta pide `USERNAME`, nombre, `USUARIO.USU_ID_USUARIO`, el valor de
`SEG_USUARIOS.ROL` (`ADMIN`, `OPERADOR` o `CONSULTA`) y dos veces la contraseña
inicial sin mostrarla. No acepta contraseña por argumento ni escribe su texto
en SQL o logs. Comprueba usuario y rol activos, `USERNAME` duplicado y vínculo
operativo duplicado. Inserta hash Argon2id y vínculo en una transacción; deja
`DEBE_CAMBIAR_CLAVE='S'`. `SEG_USUARIOS.ROL` no concede capacidades CXP.

Para un flujo de pago completo se necesitan cuentas vinculadas a usuarios
operativos distintos: un `OPERADOR_CXP`, los aprobadores que exijan las reglas
vigentes, **tres personas** con `TESORERIA_CXP` para programar, ejecutar y
confirmar, y un `SUPERVISOR_CXP` para anular cuando proceda. Una regla de
aprobación de pago solo acepta a quien tenga tanto la capacidad `APROBAR` como
el rol exigido por esa regla. Facturas especiales conservan su parámetro
independiente `CXP_FE_APROBADOR_ROL/ROL_APROBADOR`, configurado según su
migración específica. No hay asignación automática de roles ni de vínculos.

## Flujo y pruebas manuales

`POST /api/auth/login` autentica y crea una sesión nueva; revoca las sesiones
previas de la cuenta. `GET /api/auth/session` devuelve identidad CXP, estado de
cambio de clave y token CSRF, pero nunca el token de sesión. Si la clave es
inicial, solo se permite cambiarla o cerrar sesión. El cambio de clave revoca
las sesiones previas y rota el token. `POST /api/auth/logout` revoca la sesión.

Todas las rutas `/api/cxp`, incluidas lecturas, archivos y reportes, requieren
cookie válida, cuenta activa, vínculo CXP, `USUARIO` activo y `ROL` activo.
Las escrituras requieren origen permitido y `X-CSRF-Token`. La cabecera
`X-CXP-Actor-Id` y el parámetro `actorId` se rechazan. La identidad de autoría
se toma de la sesión; `solicitadoPor`, `responsablePor` y `usuarioAsignado`
conservan su significado de persona asignada.

En una base aislada, comprobar login correcto e incorrecto, bloqueo, clave
inicial, caducidad por inactividad y absoluta, logout, cambio de contraseña,
cuenta y rol inactivos, cuenta sin vínculo, lectura y descarga sin sesión,
CSRF, suplantación por cabecera, parámetro y cuerpo, creador conservado en
edición, aprobaciones por regla y segregación de tres tesoreros. No se ejecutó
ninguna migración ni prueba contra Oracle compartido durante la implementación.
