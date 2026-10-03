#!/usr/bin/env bash
# ============================================================================
# Instala un entorno de pruebas LOCAL para el modulo de facturas especiales:
#   1. Tablas comunes minimas de prueba (fe_00_tablas_comunes_prueba.sql).
#   2. Tablas, FK y parametros del DDL oficial de CXP (sin vistas ni auditoria,
#      que exigen CREATE VIEW).
#   3. Migracion 001 de facturas especiales y tributos.
#
# Uso: database/oracle/08_tests/instalar_entorno_prueba.sh <ruta al DDL de CXP>
#      (p. ej. ~/Downloads/CXP_Oracle21c_Completo_102FK_sin_triggers.sql)
# Requiere el contenedor Docker "oracle-xe" (o ORACLE_CONTAINER) y server/.env.
# Solo para una base de pruebas vacia: el paso 1 se detiene si hay tablas comunes.
# ============================================================================
set -euo pipefail

DDL="${1:?Indica la ruta del DDL de CXP}"
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../../.." && pwd)"
CONTAINER="${ORACLE_CONTAINER:-oracle-xe}"

set -a; . "$ROOT/server/.env"; set +a

# Protección: solo se instala en una base local; nunca en la base compartida o en la nube.
HOST_BD="${NODE_ORACLEDB_CONNECTIONSTRING#//}"
HOST_BD="$(printf '%s' "${HOST_BD%%[:/]*}" | tr '[:upper:]' '[:lower:]')"
case "$HOST_BD" in
  localhost|127.0.0.1) ;;
  *) echo "Cancelado: server/.env apunta a \"${HOST_BD:-(vacío)}\". Este instalador solo se ejecuta contra una base local (localhost)." >&2; exit 1 ;;
esac

SERVICE="${NODE_ORACLEDB_CONNECTIONSTRING#*/}"
CONNECT="$NODE_ORACLEDB_USER/$NODE_ORACLEDB_PASSWORD@//localhost:1521/$SERVICE"

run_sql() {
  { echo "SET DEFINE OFF"; echo "WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK"; cat; echo "EXIT"; } \
    | docker exec -i "$CONTAINER" sqlplus -s "$CONNECT"
}

echo "== 1. Tablas comunes de prueba"
run_sql < "$DIR/fe_00_tablas_comunes_prueba.sql"

echo "== 2. DDL de CXP (tablas, FK y parametros)"
{
  awk '/^PROMPT 1\. /{on=1} /^PROMPT 3\. /{on=0} on' "$DDL"
  awk '/^PROMPT 4\. /{on=1} /^PROMPT 5\. /{on=0} on' "$DDL"
} | run_sql

echo "== 3. Migracion 001"
run_sql < "$DIR/../09_migraciones/001_facturas_especiales_tributos.sql"

echo "Entorno de pruebas listo."
