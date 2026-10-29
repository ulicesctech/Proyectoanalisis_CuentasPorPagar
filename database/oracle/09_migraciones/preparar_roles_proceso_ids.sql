-- Alternativa manual SOLO si ROL_ID_ROL no es identity. No se incluye en el instalador.
-- Ejecutar primero diagnostico_roles_proceso.sql y obtener cada ID faltante del
-- generador REAL de la instalación. Definir estos binds numéricos en SQL Developer:
-- :cxp_id_operador, :cxp_id_aprobador, :cxp_id_tesoreria, :cxp_id_supervisor.
-- Un bind puede ser NULL si el rol correspondiente ya existe activo.
-- No calcular IDs con MAX(ROL_ID_ROL)+1 ni elegir números arbitrarios.
DECLARE
  v_nombres sys.odcivarchar2list := sys.odcivarchar2list(
    'OPERADOR_CXP', 'APROBADOR_CXP', 'TESORERIA_CXP', 'SUPERVISOR_CXP');
  v_ids sys.odcinumberlist := sys.odcinumberlist(
    :cxp_id_operador, :cxp_id_aprobador, :cxp_id_tesoreria, :cxp_id_supervisor);
  v_cantidad NUMBER;
  v_activo NUMBER;
  v_colision NUMBER;
BEGIN
  FOR i IN 1 .. v_nombres.COUNT LOOP
    SELECT COUNT(*), MIN(rol_activo)
      INTO v_cantidad, v_activo
      FROM rol
     WHERE REGEXP_REPLACE(UPPER(rol_nombre_rol), '[[:space:]]', '') = v_nombres(i);
    IF v_cantidad > 1 THEN
      RAISE_APPLICATION_ERROR(-20031, 'Nombre de rol ambiguo: ' || v_nombres(i));
    ELSIF v_cantidad = 1 AND NVL(v_activo, 0) <> 1 THEN
      RAISE_APPLICATION_ERROR(-20032, 'El rol existente está inactivo: ' || v_nombres(i));
    ELSIF v_cantidad = 0 THEN
      IF v_ids(i) IS NULL OR v_ids(i) <= 0 OR v_ids(i) <> TRUNC(v_ids(i)) THEN
        RAISE_APPLICATION_ERROR(-20033, 'Falta ID válido del generador real para ' || v_nombres(i));
      END IF;
      SELECT COUNT(*) INTO v_colision FROM rol WHERE rol_id_rol = v_ids(i);
      IF v_colision <> 0 THEN
        RAISE_APPLICATION_ERROR(-20034, 'El ID proporcionado ya existe para ' || v_nombres(i));
      END IF;
      INSERT INTO rol (rol_id_rol, rol_nombre_rol, rol_activo)
      VALUES (v_ids(i), v_nombres(i), 1);
    END IF;
  END LOOP;
END;
/
-- Sin COMMIT: verificar las filas y decidir COMMIT o ROLLBACK.
