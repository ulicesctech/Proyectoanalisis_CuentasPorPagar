-- Solo lectura. Ejecutar en SQL Developer contra el esquema de CXP y compartir resultados.
-- Confirmar estructura real antes de preparar cualquier cambio de datos.
SELECT table_name, column_id, column_name, data_type, nullable
  FROM user_tab_columns
 WHERE table_name IN ('ROL', 'USUARIO', 'CXP_PARAMETRO', 'CXP_REGLA_APROBACION', 'CXP_APROBACION')
 ORDER BY table_name, column_id;

SELECT c.table_name, c.constraint_name, c.constraint_type, c.status,
       cc.column_name, cc.position, c.r_constraint_name
  FROM user_constraints c
  JOIN user_cons_columns cc ON cc.constraint_name = c.constraint_name
 WHERE c.table_name IN ('ROL', 'USUARIO', 'CXP_PARAMETRO', 'CXP_REGLA_APROBACION', 'CXP_APROBACION')
 ORDER BY c.table_name, c.constraint_name, cc.position;

SELECT rol_id_rol, rol_nombre_rol, rol_activo,
       REGEXP_REPLACE(UPPER(rol_nombre_rol), '[[:space:]]', '') AS nombre_normalizado
  FROM rol ORDER BY REGEXP_REPLACE(UPPER(rol_nombre_rol), '[[:space:]]', ''), rol_id_rol;

SELECT REGEXP_REPLACE(UPPER(rol_nombre_rol), '[[:space:]]', '') AS nombre_normalizado, COUNT(*) AS cantidad
  FROM rol
 GROUP BY REGEXP_REPLACE(UPPER(rol_nombre_rol), '[[:space:]]', '')
HAVING REGEXP_REPLACE(UPPER(rol_nombre_rol), '[[:space:]]', '') IS NULL OR COUNT(*) > 1;

-- Sin contraseñas ni otros secretos.
SELECT u.usu_id_usuario, u.usu_nombre_completo, u.usu_activo,
       u.usu_id_rol, r.rol_nombre_rol, r.rol_activo
  FROM usuario u LEFT JOIN rol r ON r.rol_id_rol = u.usu_id_rol
 ORDER BY u.usu_id_usuario;

-- VALOR_NUMERO en el grupo antiguo es ID de USUARIO; en el nuevo es ID de ROL.
SELECT id_parametro, grupo_parametro, codigo, nombre, valor_numero,
       valor_texto, activo
  FROM cxp_parametro
 WHERE grupo_parametro IN ('CXP_FE_APROBADOR', 'CXP_FE_APROBADOR_ROL')
 ORDER BY grupo_parametro, codigo;

SELECT id_regla, nombre_regla, tipo_entidad, nivel, id_rol_aprobador,
       activa
  FROM cxp_regla_aprobacion
 ORDER BY tipo_entidad, nivel, id_regla;
