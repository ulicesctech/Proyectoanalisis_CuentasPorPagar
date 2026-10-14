import type { Connection } from 'oracledb';
import type { CxpRecord, CxpResource } from '@erp/contracts';
import { CxpError } from '../services/errors';

/** Evita que el CRUD genérico altere registros administrados por RF07/RF10. */
export async function assertOutsideProcess(
  connection: Connection,
  resource: CxpResource,
  row: CxpRecord,
) {
  const payment = resource === 'pagos' ? row.idPago : row.idPago ?? null;
  const batch = resource === 'lotes-pago' ? row.idLote : row.idLote ?? null;
  const document = resource === 'documentos'
    ? row.idDocumento
    : row.idDocumento ?? row.idDocumentoDestino ?? null;

  if (!payment && !batch && !document) return;

  const result = await connection.execute(
    `SELECT 1
       FROM DUAL
      WHERE EXISTS (
        SELECT 1
          FROM CXP_PAGO P
         WHERE P.CODIGO_PAGO LIKE 'CP-%'
           AND (
             (:payment IS NOT NULL AND P.ID_PAGO = :payment)
             OR (:batch IS NOT NULL AND P.ID_LOTE = :batch)
             OR (:document IS NOT NULL AND EXISTS (
               SELECT 1
                 FROM CXP_APLICACION A
                WHERE A.ID_PAGO = P.ID_PAGO
                  AND A.ID_DOCUMENTO_DESTINO = :document
                  AND A.TIPO_APLICACION = 'PAGO'
                  AND A.ESTADO <> 'CANCELADA'
             ))
           )
      )`,
    { payment, batch, document },
  );

  if (result.rows?.length) {
    throw new CxpError(
      'Este registro pertenece al flujo RF07/RF10. Usa las vistas Contraseñas, Autorizaciones, Pagos o Cheques para conservar aprobaciones y trazabilidad.',
      409,
    );
  }
}
