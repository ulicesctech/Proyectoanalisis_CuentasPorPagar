-- ============================================================================
-- REVERSION DE LA MIGRACION 001 - FACTURAS ESPECIALES Y TRIBUTOS
-- ============================================================================
-- Solo para entornos de desarrollo o si la migracion debe retirarse ANTES de
-- registrar facturas especiales. Se detiene si existen datos del modulo, para
-- no perder historial fiscal: las facturas especiales se anulan, no se borran.
-- ============================================================================

SET SERVEROUTPUT ON SIZE UNLIMITED
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

DECLARE
    V_N NUMBER;
    PROCEDURE EJECUTAR(P_SQL VARCHAR2) IS
    BEGIN
        EXECUTE IMMEDIATE P_SQL;
    EXCEPTION WHEN OTHERS THEN
        -- ORA-00942 / ORA-02443 / ORA-00904: el objeto ya no existe.
        IF SQLCODE NOT IN (-942, -2443, -904, -1418) THEN RAISE; END IF;
    END;
BEGIN
    SELECT COUNT(*) INTO V_N FROM CXP_DOCUMENTO WHERE TIPO_DOCUMENTO = 'FACTURA_ESPECIAL';
    IF V_N > 0 THEN
        RAISE_APPLICATION_ERROR(-20302, 'Existen ' || V_N || ' facturas especiales. No se revierte para conservar el historial.');
    END IF;

    EJECUTAR('DROP TABLE CXP_FACTURA_ESPECIAL');
    EJECUTAR('ALTER TABLE CXP_DOCUMENTO_TRIBUTO DROP CONSTRAINT FK_CXP_TRIB_REGLA');
    EJECUTAR('DROP INDEX IX_CXP_TRIB_REGLA');
    EJECUTAR('ALTER TABLE CXP_DOCUMENTO_TRIBUTO DROP COLUMN ID_REGLA_TRIBUTARIA');
    EJECUTAR('DROP TABLE CXP_REGLA_TRIBUTARIA');

    EXECUTE IMMEDIATE q'[
        ALTER TABLE CXP_DOCUMENTO ADD CONSTRAINT CK_CXP_DOC_TIPO_V1 CHECK
        (TIPO_DOCUMENTO IN ('FACTURA', 'FACTURA_CAMBIARIA', 'NOTA_CREDITO',
                            'NOTA_DEBITO', 'RECIBO', 'REEMBOLSO',
                            'LIQUIDACION_VIATICO', 'GASTO_CAJA_CHICA',
                            'CUOTA_CONTRATO', 'CUOTA_PRESTAMO',
                            'OBLIGACION_FISCAL', 'SALDO_INICIAL',
                            'COMPROBANTE_SERVICIO', 'OTRO')) ENABLE VALIDATE]';
    EJECUTAR('ALTER TABLE CXP_DOCUMENTO DROP CONSTRAINT CK_CXP_DOC_TIPO');
    EXECUTE IMMEDIATE 'ALTER TABLE CXP_DOCUMENTO RENAME CONSTRAINT CK_CXP_DOC_TIPO_V1 TO CK_CXP_DOC_TIPO';

    DELETE FROM CXP_PARAMETRO WHERE GRUPO_PARAMETRO IN ('CXP_FACTURA_ESPECIAL', 'CXP_FE_APROBADOR');
    COMMIT;
    DBMS_OUTPUT.PUT_LINE('Migracion 001 revertida.');
END;
/
