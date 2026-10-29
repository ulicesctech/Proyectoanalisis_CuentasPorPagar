-- Plantilla manual; NO incluida en install_migraciones.sql. No ejecutar antes de
-- revisar diagnostico_fe_roles.sql y confirmar estructura, nombres y datos reales.
-- En SQL Developer, definir :cxp_fe_rol_nombre con el nombre EXISTENTE elegido.
-- Ejemplo de declaración (sustituir el marcador antes de ejecutar):
-- VARIABLE cxp_fe_rol_nombre VARCHAR2(80)
-- EXEC :cxp_fe_rol_nombre := 'REEMPLAZAR_POR_NOMBRE_REAL'
-- No cambia ni desactiva filas del grupo legado CXP_FE_APROBADOR.

DECLARE
  v_nombre VARCHAR2(80) := TRIM(:cxp_fe_rol_nombre);
  v_cantidad NUMBER;
  v_id_rol NUMBER;
  v_activo NUMBER;
BEGIN
  IF v_nombre IS NULL THEN
    RAISE_APPLICATION_ERROR(-20001, 'Indica un ROL_NOMBRE_ROL existente y no vacío.');
  END IF;
  SELECT COUNT(*), MIN(rol_id_rol), MIN(rol_activo)
    INTO v_cantidad, v_id_rol, v_activo
    FROM rol
   WHERE REGEXP_REPLACE(UPPER(rol_nombre_rol), '[[:space:]]', '') =
         REGEXP_REPLACE(UPPER(v_nombre), '[[:space:]]', '');
  IF v_cantidad <> 1 THEN
    RAISE_APPLICATION_ERROR(-20002, 'Nombre de rol inexistente o ambiguo al ignorar espacios y mayúsculas.');
  END IF;
  IF NVL(v_activo, 0) <> 1 THEN
    RAISE_APPLICATION_ERROR(-20003, 'El rol seleccionado debe estar activo.');
  END IF;
  SELECT COUNT(*) INTO v_cantidad
    FROM cxp_parametro
   WHERE grupo_parametro = 'CXP_FE_APROBADOR_ROL' AND codigo = 'ROL_APROBADOR';
  IF v_cantidad <> 0 THEN
    RAISE_APPLICATION_ERROR(-20004, 'El parámetro nuevo ya existe; revisa su valor antes de cambiarlo.');
  END IF;
  INSERT INTO cxp_parametro
    (grupo_parametro, codigo, nombre, valor_numero, activo)
  VALUES
    ('CXP_FE_APROBADOR_ROL', 'ROL_APROBADOR', 'Rol aprobador de facturas especiales', v_id_rol, 'S');
END;
/
-- Sin COMMIT: revisar la fila y decidir COMMIT o ROLLBACK en la sesión de SQL Developer.
