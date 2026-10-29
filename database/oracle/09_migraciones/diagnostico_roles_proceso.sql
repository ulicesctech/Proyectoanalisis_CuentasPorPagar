-- Solo SELECT. Ejecutar en SQL Developer y revisar antes de crear roles o asignar usuarios.
SELECT table_name, column_id, column_name, data_type, nullable, identity_column
  FROM user_tab_columns
 WHERE table_name IN ('ROL', 'USUARIO')
 ORDER BY table_name, column_id;

SELECT table_name, column_name, generation_type
  FROM user_tab_identity_cols
 WHERE table_name IN ('ROL', 'USUARIO')
 ORDER BY table_name, column_name;

SELECT trigger_name, table_name, status, triggering_event
  FROM user_triggers
 WHERE table_name IN ('ROL', 'USUARIO')
 ORDER BY table_name, trigger_name;

SELECT sequence_name, increment_by, cycle_flag
  FROM user_sequences
 WHERE sequence_name LIKE '%ROL%'
 ORDER BY sequence_name;

SELECT constraint_name, constraint_type, status, search_condition_vc
  FROM user_constraints
 WHERE table_name IN ('ROL', 'USUARIO')
 ORDER BY table_name, constraint_name;

SELECT rol_id_rol, rol_nombre_rol, rol_activo,
       REGEXP_REPLACE(UPPER(rol_nombre_rol), '[[:space:]]', '') AS nombre_normalizado
  FROM rol
 ORDER BY nombre_normalizado, rol_id_rol;

SELECT REGEXP_REPLACE(UPPER(rol_nombre_rol), '[[:space:]]', '') AS nombre_normalizado,
       COUNT(*) AS cantidad
  FROM rol
 GROUP BY REGEXP_REPLACE(UPPER(rol_nombre_rol), '[[:space:]]', '')
HAVING REGEXP_REPLACE(UPPER(rol_nombre_rol), '[[:space:]]', '') IS NULL OR COUNT(*) > 1;

SELECT u.usu_id_usuario, u.usu_nombre_completo, u.usu_activo,
       u.usu_id_rol, r.rol_nombre_rol, r.rol_activo
  FROM usuario u LEFT JOIN rol r ON r.rol_id_rol = u.usu_id_rol
 ORDER BY u.usu_id_usuario;

SELECT a.id_regla, a.tipo_entidad, a.nombre_regla, a.nivel,
       a.id_rol_aprobador, r.rol_nombre_rol, r.rol_activo,
       a.activa, a.monto_desde, a.monto_hasta,
       CASE WHEN REGEXP_REPLACE(UPPER(r.rol_nombre_rol), '[[:space:]]', '') = 'APROBADOR_CXP'
            AND r.rol_activo = 1 THEN 'COMPATIBLE_CON_APROBAR'
            ELSE 'REVISAR_ROL_DE_REGLA' END AS diagnostico_rol
  FROM cxp_regla_aprobacion a
  LEFT JOIN rol r ON r.rol_id_rol = a.id_rol_aprobador
 WHERE a.tipo_entidad IN ('PAGO', 'LOTE')
 ORDER BY a.tipo_entidad, a.nivel, a.id_regla;
