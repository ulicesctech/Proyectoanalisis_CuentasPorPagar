import oracledb, { type Connection } from 'oracledb';
import type { OpcionesProceso } from '@erp/contracts';

/** Misma elegibilidad del flujo; sin proveedor exige una búsqueda comercial acotada. */
export async function listEligibleProcessDocuments(connection: Connection, search = '', proveedor?: number): Promise<OpcionesProceso['documentos']> {
  const searchText = search.trim() ? `%${search.trim().toUpperCase()}%` : null;
  const result = await connection.execute<{
    ID_DOCUMENTO: number; SERIE: string | null; NUMERO_DOCUMENTO: string | null; NO_FACTURA_COMPRA: string | null;
    ID_PROVEEDOR: number; PROVEEDOR_NOMBRE: string | null; ID_SUCURSAL: number; MONEDA: string; SALDO_PENDIENTE: number;
  }>(`SELECT D.ID_DOCUMENTO, D.SERIE, D.NUMERO_DOCUMENTO, D.NO_FACTURA_COMPRA,
              D.ID_PROVEEDOR, P.PRO_NOMBRE_ENTIDAD AS PROVEEDOR_NOMBRE, D.ID_SUCURSAL, D.MONEDA, D.SALDO_PENDIENTE
         FROM CXP_DOCUMENTO D
         LEFT JOIN PROVEEDOR P ON P.PRO_ID_PROVEEDOR = D.ID_PROVEEDOR
        WHERE (:provider IS NOT NULL OR :search IS NOT NULL)
          AND (:provider IS NULL OR D.ID_PROVEEDOR = :provider)
          AND (:search IS NULL OR UPPER(D.NUMERO_DOCUMENTO) LIKE :search
               OR UPPER(D.NO_FACTURA_COMPRA) LIKE :search
               OR UPPER(D.SERIE || '-' || D.NUMERO_DOCUMENTO) LIKE :search)
          AND D.NATURALEZA = 'D'
          AND D.POSIBLE_DUPLICADO = 'N'
          AND D.ESTADO IN ('APROBADA', 'CONTABILIZADA', 'PENDIENTE_PAGO', 'PARCIALMENTE_PAGADA', 'VENCIDA')
          AND NOT (D.TIPO_DOCUMENTO = 'FACTURA_ESPECIAL' AND D.ESTADO = 'APROBADA')
          AND D.TIPO_DOCUMENTO <> 'GASTO_CAJA_CHICA'
          AND D.SALDO_PENDIENTE > 0
          AND NOT EXISTS (
            SELECT 1 FROM CXP_APLICACION A JOIN CXP_PAGO P ON P.ID_PAGO = A.ID_PAGO
             WHERE A.ID_DOCUMENTO_DESTINO = D.ID_DOCUMENTO AND A.TIPO_APLICACION = 'PAGO'
               AND (A.ESTADO = 'PENDIENTE' OR (A.ESTADO = 'APLICADA' AND P.CODIGO_PAGO LIKE 'CP-%'))
               AND P.ESTADO NOT IN ('RECHAZADO', 'DEVUELTO', 'ANULADO')
          )
        ORDER BY D.ID_DOCUMENTO DESC
        FETCH FIRST ${searchText ? 20 : 200} ROWS ONLY`, {
    provider: { val: proveedor ?? null, type: oracledb.NUMBER }, search: { val: searchText, type: oracledb.STRING },
  }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return (result.rows ?? []).map(row => ({
    id: row.ID_DOCUMENTO, nombre: [row.SERIE, row.NUMERO_DOCUMENTO || row.NO_FACTURA_COMPRA].filter(Boolean).join(' · ') || 'Sin número comercial',
    serie: row.SERIE, numeroDocumento: row.NUMERO_DOCUMENTO, noFacturaCompra: row.NO_FACTURA_COMPRA,
    proveedor: row.ID_PROVEEDOR, proveedorNombre: row.PROVEEDOR_NOMBRE, sucursal: row.ID_SUCURSAL,
    moneda: row.MONEDA.trim(), saldo: Number(row.SALDO_PENDIENTE),
  }));
}
