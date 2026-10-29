-- SOLO SELECT. Ejecutar y revisar en la base destino antes de la migración.
-- No devuelve PASSWORD_HASH ni otros secretos.

SELECT table_name
  FROM user_tables
 WHERE table_name IN ('SEG_USUARIOS', 'SEG_SESIONES', 'USUARIO', 'ROL', 'CXP_CUENTA_USUARIO')
 ORDER BY table_name;

SELECT table_name, column_name, data_type, data_length, nullable, identity_column
  FROM user_tab_columns
 WHERE table_name IN ('SEG_USUARIOS', 'SEG_SESIONES', 'USUARIO', 'ROL', 'CXP_CUENTA_USUARIO')
 ORDER BY table_name, column_name;

SELECT UPPER(REGEXP_REPLACE(ROL_NOMBRE_ROL, '[[:space:]]', '')) AS nombre_normalizado,
       COUNT(*) AS total
  FROM ROL
 WHERE ROL_NOMBRE_ROL IS NOT NULL
 GROUP BY UPPER(REGEXP_REPLACE(ROL_NOMBRE_ROL, '[[:space:]]', ''))
HAVING COUNT(*) > 1;

SELECT rol_id_rol, rol_nombre_rol, rol_activo
  FROM ROL
 WHERE rol_nombre_rol IS NULL OR TRIM(rol_nombre_rol) IS NULL;

SELECT c.table_name, c.constraint_name, c.constraint_type, c.status,
       cc.column_name, c.r_constraint_name
  FROM user_constraints c JOIN user_cons_columns cc
    ON cc.constraint_name = c.constraint_name
 WHERE c.table_name IN ('SEG_USUARIOS', 'SEG_SESIONES', 'USUARIO', 'ROL', 'CXP_CUENTA_USUARIO')
 ORDER BY c.table_name, c.constraint_name, cc.position;

SELECT i.table_name, i.index_name, i.uniqueness, e.column_expression
  FROM user_ind_expressions e JOIN user_indexes i ON i.index_name = e.index_name
 WHERE i.table_name IN ('SEG_USUARIOS', 'CXP_CUENTA_USUARIO');

SELECT UPPER(TRIM(username)) AS username_normalizado, COUNT(*) AS total
  FROM SEG_USUARIOS GROUP BY UPPER(TRIM(username)) HAVING COUNT(*) > 1;

SELECT u.usu_id_usuario, u.usu_nombre_completo, u.usu_activo,
       u.usu_id_rol, r.rol_nombre_rol, r.rol_activo
  FROM USUARIO u LEFT JOIN ROL r ON r.rol_id_rol = u.usu_id_rol
 ORDER BY u.usu_id_usuario;

SELECT u.usu_id_usuario, u.usu_id_rol, u.usu_activo,
       r.rol_nombre_rol, r.rol_activo
  FROM USUARIO u LEFT JOIN ROL r ON r.rol_id_rol = u.usu_id_rol
 WHERE u.usu_activo = 1 AND (r.rol_id_rol IS NULL OR NVL(r.rol_activo, 0) <> 1)
 ORDER BY u.usu_id_usuario;

SELECT id_usuario, username, nombre, estado, rol, debe_cambiar_clave,
       intentos_fallidos, bloqueado_hasta
  FROM SEG_USUARIOS ORDER BY id_usuario;

-- Si CXP_CUENTA_USUARIO ya existe, comprobar sus filas y duplicados antes de crearla.
-- No se consulta aquí para que el diagnóstico funcione también cuando aún falta la tabla.
