-- Plantilla independiente y manual. No se incluye en el instalador.
-- Definir :cxp_usuario_id con el ID real de UN usuario ya creado y
-- :cxp_rol_nombre con UNO de los cuatro nombres de rol de proceso.
-- No cambia usuarios que ya tienen un rol, ni asigna permisos en masa.
DECLARE
  v_nombre VARCHAR2(80) := REGEXP_REPLACE(UPPER(:cxp_rol_nombre), '[[:space:]]', '');
  v_usuario NUMBER := :cxp_usuario_id;
  v_cantidad NUMBER;
  v_id_rol NUMBER;
  v_activo NUMBER;
BEGIN
  IF v_nombre NOT IN ('OPERADOR_CXP', 'APROBADOR_CXP', 'TESORERIA_CXP', 'SUPERVISOR_CXP') THEN
    RAISE_APPLICATION_ERROR(-20021, 'Indica un nombre válido de rol de proceso.');
  END IF;
  IF v_usuario IS NULL OR v_usuario <= 0 OR v_usuario <> TRUNC(v_usuario) THEN
    RAISE_APPLICATION_ERROR(-20022, 'Indica un USU_ID_USUARIO real y positivo.');
  END IF;
  SELECT COUNT(*), MIN(rol_id_rol), MIN(rol_activo)
    INTO v_cantidad, v_id_rol, v_activo
    FROM rol
   WHERE REGEXP_REPLACE(UPPER(rol_nombre_rol), '[[:space:]]', '') = v_nombre;
  IF v_cantidad <> 1 OR NVL(v_activo, 0) <> 1 THEN
    RAISE_APPLICATION_ERROR(-20023, 'El rol indicado no existe, está inactivo o es ambiguo.');
  END IF;
  UPDATE usuario
     SET usu_id_rol = v_id_rol
   WHERE usu_id_usuario = v_usuario
     AND usu_activo = 1
     AND usu_id_rol IS NULL;
  IF SQL%ROWCOUNT <> 1 THEN
    RAISE_APPLICATION_ERROR(-20024, 'El usuario no existe, está inactivo o ya tiene un rol; no se reasigna automáticamente.');
  END IF;
END;
/
-- Sin COMMIT: revisar la asociación y decidir COMMIT o ROLLBACK.
