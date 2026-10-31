import type { Connection } from 'oracledb';
import oracledb from 'oracledb';
import type { CxpDocumentoPagosContexto } from '@erp/contracts';
import { getConnection } from '../../../../config/database';
import { createCxpRepository } from '../../repositories/crud.repository';
import { assertCxpDocumentoForApplication } from './documento.policy';
import { CxpError } from '../errors';

export async function documentoPagosContextoWithConnection(connection: Connection, id: number): Promise<CxpDocumentoPagosContexto> {
  if (!Number.isSafeInteger(id) || id < 1) throw new CxpError('Identificador inválido', 400);
  const doc = await createCxpRepository('documentos').bind(connection).findById(id);
  if (!doc) throw new CxpError('Documento no encontrado', 404);
  const options = { outFormat: oracledb.OUT_FORMAT_OBJECT };
  const processes = await connection.execute<{
    ID_PAGO: number; CODIGO_PAGO: string; ESTADO: string; MONTO_OBLIGACION: number; MONTO_NO_APLICADO: number; RESERVADO: number; APLICADO: number;
  }>(`SELECT P.ID_PAGO, P.CODIGO_PAGO, P.ESTADO, P.MONTO_OBLIGACION, P.MONTO_NO_APLICADO,
       SUM(CASE WHEN A.ESTADO = 'PENDIENTE' AND P.ESTADO NOT IN ('RECHAZADO','DEVUELTO','ANULADO') THEN A.MONTO_TOTAL_APLICADO ELSE 0 END) RESERVADO,
       SUM(CASE WHEN A.ESTADO = 'APLICADA' THEN A.MONTO_TOTAL_APLICADO ELSE 0 END) APLICADO
     FROM CXP_APLICACION A JOIN CXP_PAGO P ON P.ID_PAGO = A.ID_PAGO
     WHERE A.ID_DOCUMENTO_DESTINO = :id AND A.TIPO_APLICACION = 'PAGO' AND P.CODIGO_PAGO LIKE 'CP-%'
     GROUP BY P.ID_PAGO, P.CODIGO_PAGO, P.ESTADO, P.MONTO_OBLIGACION, P.MONTO_NO_APLICADO ORDER BY P.ID_PAGO DESC`, {id}, options);
  const reserved = await connection.execute<{RESERVADO: number}>(`SELECT NVL(SUM(A.MONTO_TOTAL_APLICADO),0) RESERVADO
    FROM CXP_APLICACION A JOIN CXP_PAGO P ON P.ID_PAGO=A.ID_PAGO
    WHERE A.ID_DOCUMENTO_DESTINO=:id AND A.TIPO_APLICACION='PAGO' AND A.ESTADO='PENDIENTE'
      AND P.ESTADO NOT IN ('RECHAZADO','DEVUELTO','ANULADO')`, {id}, options);
  const ordinary = await connection.execute<{TOTAL: number; CON_SALDO: number; ELEGIBLES: number}>(`SELECT COUNT(*) TOTAL,
    COUNT(CASE WHEN MONTO_NO_APLICADO > 0 THEN 1 END) CON_SALDO,
    COUNT(CASE WHEN MONTO_NO_APLICADO > 0 AND ESTADO IN ('EJECUTADO','CONFIRMADO','PARCIALMENTE_APLICADO','APLICADO','CONCILIADO') THEN 1 END) ELEGIBLES
    FROM CXP_PAGO WHERE ID_PROVEEDOR=:proveedor AND MONEDA=:moneda AND TIPO_PAGO='ORDINARIO' AND CODIGO_PAGO NOT LIKE 'CP-%'`,
  {proveedor:doc.idProveedor,moneda:doc.moneda}, options);
  const stats = ordinary.rows?.[0];
  const reservadoDocumento = Number(reserved.rows?.[0]?.RESERVADO ?? 0);
  const motivos: string[] = [];
  let canApply = true;
  if (Number(doc.saldoPendiente) <= 0) { canApply = false; motivos.push('El documento ya no tiene saldo pendiente. No debe volver a aplicarse.'); }
  else {
    try { assertCxpDocumentoForApplication(doc, 'destino'); } catch (e) {
      canApply = false;
      motivos.push(doc.estado==='RECIBIDO'?'Completa y valida el expediente antes de continuar con su aprobación y pago.':doc.estado==='PENDIENTE_APROBACION'?'El documento espera la revisión de un usuario autorizado antes del pago.':e instanceof Error?e.message:'El documento no admite aplicaciones.');
    }
    if (reservadoDocumento > 0) motivos.push('El saldo está reservado. Continúa desde el proceso de pago relacionado.');
    else if (canApply) {
      if (!Number(stats?.TOTAL)) motivos.push('No hay pagos ordinarios de este proveedor en la moneda del documento.');
      else if (!Number(stats?.CON_SALDO)) motivos.push('Los pagos ordinarios compatibles ya consumieron su saldo.');
      else if (!Number(stats?.ELEGIBLES)) motivos.push('Los pagos ordinarios con saldo aún no están ejecutados o confirmados.');
    }
  }
  return { reservadoDocumento, ordinariosDisponibles: canApply && !reservadoDocumento ? Number(stats?.ELEGIBLES ?? 0) : 0, motivos,
    procesos: (processes.rows ?? []).map(p => ({idPago:p.ID_PAGO,codigo:p.CODIGO_PAGO,estado:p.ESTADO,monto:Number(p.MONTO_OBLIGACION),saldoSinAplicar:Number(p.MONTO_NO_APLICADO),reservado:Number(p.RESERVADO),aplicado:Number(p.APLICADO)})) };
}
export async function documentoPagosContexto(id: number) {
  const connection = await getConnection();
  try { return await documentoPagosContextoWithConnection(connection,id); } finally { await connection.close(); }
}
