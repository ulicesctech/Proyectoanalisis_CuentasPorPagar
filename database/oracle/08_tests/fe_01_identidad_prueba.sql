-- ============================================================================
-- SOLO PARA PRUEBAS LOCALES - IDENTIDAD Y CATALOGOS DE PRUEBA
-- ============================================================================
-- Completa las tablas minimas de fe_00_tablas_comunes_prueba.sql con las columnas
-- reales que usa CXP (identidad "Operando como", vencimiento y procesos de pago):
--   USUARIO: USU_NOMBRE_COMPLETO, USU_ID_ROL, USU_ID_DEPARTAMENTO, USU_ID_JEFE_INMEDIATO, USU_ACTIVO
--   ROL: ROL_NOMBRE_ROL, ROL_ACTIVO
--   CXC_CONDICIONES_CREDITO: DIAS_CREDITO, ESTADO
--   CXC_FORMAS_PAGO: ESTADO
--   PROVEEDOR: PRO_ACTIVO
-- y carga usuarios, roles y condiciones de prueba.
--
-- Proteccion: se detiene si USUARIO no es la tabla minima de prueba (columna
-- USU_USUARIO creada por fe_00). La tabla real del esquema compartido no la tiene.
-- Es re-ejecutable: solo agrega columnas que falten y usa MERGE para los datos.
-- ============================================================================
SET SERVEROUTPUT ON SIZE UNLIMITED
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

DECLARE
    V_N NUMBER;
BEGIN
    SELECT COUNT(*) INTO V_N FROM USER_TAB_COLUMNS
     WHERE TABLE_NAME = 'USUARIO' AND COLUMN_NAME = 'USU_USUARIO';
    IF V_N = 0 THEN
        RAISE_APPLICATION_ERROR(-20402, 'USUARIO no es la tabla minima de prueba (fe_00). Este script es solo para una base local de pruebas.');
    END IF;
END;
/

DECLARE
    PROCEDURE AGREGAR(P_TABLA VARCHAR2, P_COLUMNA VARCHAR2, P_DEFINICION VARCHAR2) IS
        V_N NUMBER;
    BEGIN
        SELECT COUNT(*) INTO V_N FROM USER_TAB_COLUMNS WHERE TABLE_NAME = P_TABLA AND COLUMN_NAME = P_COLUMNA;
        IF V_N = 0 THEN
            EXECUTE IMMEDIATE 'ALTER TABLE ' || P_TABLA || ' ADD (' || P_COLUMNA || ' ' || P_DEFINICION || ')';
            DBMS_OUTPUT.PUT_LINE('Agregada ' || P_TABLA || '.' || P_COLUMNA);
        END IF;
    END;
BEGIN
    AGREGAR('USUARIO', 'USU_NOMBRE_COMPLETO', 'VARCHAR2(150)');
    AGREGAR('USUARIO', 'USU_ID_ROL', 'NUMBER');
    AGREGAR('USUARIO', 'USU_ID_DEPARTAMENTO', 'NUMBER');
    AGREGAR('USUARIO', 'USU_ID_JEFE_INMEDIATO', 'NUMBER');
    AGREGAR('USUARIO', 'USU_ACTIVO', 'NUMBER DEFAULT 1');
    AGREGAR('ROL', 'ROL_NOMBRE_ROL', 'VARCHAR2(80)');
    AGREGAR('ROL', 'ROL_ACTIVO', 'NUMBER DEFAULT 1');
    AGREGAR('CXC_CONDICIONES_CREDITO', 'DIAS_CREDITO', 'NUMBER');
    AGREGAR('CXC_CONDICIONES_CREDITO', 'ESTADO', 'VARCHAR2(1) DEFAULT ''A''');
    AGREGAR('CXC_FORMAS_PAGO', 'ESTADO', 'VARCHAR2(1) DEFAULT ''A''');
    AGREGAR('PROVEEDOR', 'PRO_ACTIVO', 'NUMBER DEFAULT 1');
END;
/

-- Roles: 1 ya existe (aprobador de facturas especiales en las pruebas de aceptación).
MERGE INTO ROL R USING (
    SELECT 1 ID, 'Aprobador de facturas especiales' NOMBRE FROM DUAL UNION ALL
    SELECT 2, 'Analista CXP' FROM DUAL UNION ALL
    SELECT 3, 'Tesoreria' FROM DUAL
) S ON (R.ROL_ID_ROL = S.ID)
WHEN MATCHED THEN UPDATE SET R.ROL_NOMBRE_ROL = S.NOMBRE, R.ROL_ACTIVO = 1
WHEN NOT MATCHED THEN INSERT (ROL_ID_ROL, ROL_NOMBRE, ROL_NOMBRE_ROL, ROL_ACTIVO) VALUES (S.ID, S.NOMBRE, S.NOMBRE, 1);

-- Usuarios 1-3 ya existen (pruebas de aceptación); 4 y 5 permiten probar la
-- segregación de tesorería (quien programa no ejecuta, quien ejecuta no concilia).
MERGE INTO USUARIO U USING (
    SELECT 1 ID, 'Analista CXP (prueba)' NOMBRE, 'analista' USUARIO, 2 ROL FROM DUAL UNION ALL
    SELECT 2, 'Contador aprobador (prueba)', 'contador', 1 FROM DUAL UNION ALL
    SELECT 3, 'Auxiliar sin autorizacion (prueba)', 'auxiliar', 2 FROM DUAL UNION ALL
    SELECT 4, 'Tesorera A (prueba)', 'tesorera.a', 3 FROM DUAL UNION ALL
    SELECT 5, 'Tesorero B (prueba)', 'tesorero.b', 3 FROM DUAL
) S ON (U.USU_ID_USUARIO = S.ID)
WHEN MATCHED THEN UPDATE SET U.USU_NOMBRE_COMPLETO = S.NOMBRE, U.USU_ID_ROL = S.ROL, U.USU_ACTIVO = 1, U.USU_ID_DEPARTAMENTO = 1
WHEN NOT MATCHED THEN INSERT (USU_ID_USUARIO, USU_NOMBRE, USU_USUARIO, USU_NOMBRE_COMPLETO, USU_ID_ROL, USU_ID_DEPARTAMENTO, USU_ACTIVO)
    VALUES (S.ID, S.NOMBRE, S.USUARIO, S.NOMBRE, S.ROL, 1, 1);

-- Condiciones de crédito para calcular el vencimiento (RF-05).
MERGE INTO CXC_CONDICIONES_CREDITO C USING (
    SELECT 1 ID, 'Contado' NOMBRE, 0 DIAS FROM DUAL UNION ALL
    SELECT 2, 'Credito 30 dias', 30 FROM DUAL
) S ON (C.ID_CONDICION = S.ID)
WHEN MATCHED THEN UPDATE SET C.DIAS_CREDITO = S.DIAS, C.ESTADO = 'A'
WHEN NOT MATCHED THEN INSERT (ID_CONDICION, NOMBRE, DIAS_CREDITO, ESTADO) VALUES (S.ID, S.NOMBRE, S.DIAS, 'A');

UPDATE CXC_FORMAS_PAGO SET ESTADO = 'A' WHERE ESTADO IS NULL;
UPDATE PROVEEDOR SET PRO_ACTIVO = 1 WHERE PRO_ACTIVO IS NULL;

COMMIT;
PROMPT Identidad y catalogos de prueba listos (usuarios 1-5, roles 1-3, condiciones 1-2).
