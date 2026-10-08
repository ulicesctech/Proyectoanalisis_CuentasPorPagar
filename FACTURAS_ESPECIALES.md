# Facturas especiales y tributos (RF-06, RF-14, RF-15, RF-16)

Módulo de CXP para registrar, calcular tributos, revisar, aprobar, emitir (con constancia PDF numerada) y anular facturas especiales. Se integra sobre `CXP_DOCUMENTO` / `CXP_DOCUMENTO_TRIBUTO` y reutiliza aprobaciones (`CXP_APROBACION`), bitácora (`CXP_EVENTO`), archivos (`CXP_ARCHIVO`) y parámetros (`CXP_PARAMETRO`).

## 1. Instalación en una base con CXP instalado

```sql
-- SQL*Plus / SQL Developer, conectado como PROYECTOANALISIS
@database/oracle/09_migraciones/001_facturas_especiales_tributos.sql
```

La migración es re-ejecutable y no borra datos:

| Paso | Cambio |
|---|---|
| 1 | `CK_CXP_DOC_TIPO` admite `FACTURA_ESPECIAL` (se crea y valida la nueva restricción antes de retirar la anterior; los 14 tipos existentes se conservan). |
| 2 | `CXP_REGLA_TRIBUTARIA`: reglas de IVA/ISR con porcentaje, monto fijo, tramo de base, moneda, vigencia y versiones. |
| 3 | `CXP_DOCUMENTO_TRIBUTO.ID_REGLA_TRIBUTARIA` (opcional): versión de la regla aplicada a cada tributo. |
| 4 | `CXP_FACTURA_ESPECIAL`: extensión 1:1 del documento (datos fiscales del proveedor, revisión, emisión y constancia única). |
| 5 | Parámetros `CXP_FACTURA_ESPECIAL`: `SERIE`, `CORRELATIVO_FACTURA`, `CORRELATIVO_CONSTANCIA`. |

Reversión (solo si aún no hay facturas especiales): `001_facturas_especiales_tributos_rollback.sql`.

## 2. Configuración

- **Aprobadores autorizados** (Configuración › Parámetros): `GRUPO_PARAMETRO = CXP_FE_APROBADOR`, `CODIGO = USUARIO_<id>`, `VALOR_NUMERO = USU_ID_USUARIO`, `VALOR_TEXTO = ROL_ID_ROL` con el que aprueba, `ACTIVO = S`.
- **Reglas tributarias** (Facturas especiales › Reglas tributarias): no se precargan porcentajes; se registran los valores vigentes. Cambiar una regla = registrar una **nueva versión** desde hoy o una fecha futura; la anterior queda `REEMPLAZADA` con su vigencia cerrada.
- Si existen reglas de aprobación (`CXP_REGLA_APROBACION`, entidad `DOCUMENTO`) que apliquen a la factura, se exigen sus niveles y cantidades antes de pasar a `APROBADA`.

## 3. Flujo

| Etapa | Estado del documento | Acción (API `POST /api/cxp/facturas-especiales/:id/…`) |
|---|---|---|
| Preparación | `BORRADOR` | registrar (`POST /`), editar (`PATCH /:id`), `enviar-revision` |
| Revisión | `PENDIENTE_REVISION` | `revisar`, `devolver`, `rechazar` |
| Aprobación | `PENDIENTE_APROBACION` | `aprobar` (usuario autorizado y distinto de quien registró), `rechazar` |
| Aprobada | `APROBADA` | `emitir` |
| Emitida | `PENDIENTE_PAGO` + constancia `CFE-AAAA-NNNNNN` | `GET /:id/constancia` (PDF), `anular` |
| Rechazada | `RECHAZADA` | `reabrir`, `anular` |
| Anulada | `ANULADA` | solo consulta; documento, tributos y constancia se conservan |

Cada operación se ejecuta en una transacción y queda en `CXP_EVENTO` (usuario, fecha, estado anterior y nuevo). Las pantallas genéricas de CXP no pueden modificar facturas especiales, sus tributos, aprobaciones, bitácora, constancias ni correlativos.

## 4. Pruebas de aceptación automatizadas

Requieren Oracle con CXP + migración y los datos de `database/oracle/08_tests/fe_00_tablas_comunes_prueba.sql` (usuarios 1-3, rol 1, proveedores 1-2, sucursal 1).

> **Solo contra una base local.** Las pruebas y el instalador crean datos que no se pueden borrar desde la aplicación, por eso se cancelan solos si `server/.env` no apunta a `localhost`. Nunca los ejecutes contra la base compartida o en la nube.

```bash
# Solo en una base de pruebas VACÍA (crea tablas comunes mínimas, el DDL de CXP y la migración)
database/oracle/08_tests/instalar_entorno_prueba.sh ~/Downloads/CXP_Oracle21c_Completo_102FK_sin_triggers.sql

pnpm --filter @erp/server test:fe
```

Cubren: vigencia histórica 5 % → 7 % (Prueba 1), aprobación obligatoria y doble emisión (Prueba 2), emisión concurrente sin números repetidos, constancia PDF (contenido y SHA-256 registrado), duplicados, anulación con historial, bitácora de solo lectura, rechazo/reapertura, documentos normales y respuesta de los demás recursos de CXP.

## 5. Prueba manual

1. Facturas especiales › Reglas tributarias: elegir el usuario de la operación y crear una regla (p. ej. ISR, retención, 5 %, desde el 1.º del mes).
2. Facturas especiales › Nueva factura especial: proveedor, sucursal, fecha de ayer, referencia, descripción y monto. La vista previa muestra el cálculo.
3. En la regla, **Nueva versión** al 7 % desde hoy. Abrir la factura anterior: conserva el 5 % y la versión 1 (pestaña Tributos). Una factura nueva con fecha de hoy usa el 7 %.
4. Enviar a revisión → Marcar revisada → intentar **Emitir**: no está disponible (y el API responde 409). Aprobar con un usuario **no** autorizado: se rechaza. Aprobar con el autorizado.
5. Emitir: se asigna la constancia. Volver a emitir: rechazado. Descargar la constancia PDF.
6. Anular con motivo: la factura queda anulada, la constancia se descarga marcada como ANULADA y el historial muestra cada paso.
