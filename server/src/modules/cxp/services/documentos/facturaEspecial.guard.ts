import oracledb, { type Connection } from 'oracledb';
import type { CxpRecord, CxpResource } from '@erp/contracts';
import { CxpError } from '../errors';

const TIPO = 'FACTURA_ESPECIAL';
const MENSAJE = 'Las facturas especiales se gestionan desde Facturas especiales, que aplica su flujo de revisión, aprobación, emisión y anulación.';

async function esFacturaEspecial(connection: Connection, idDocumento: unknown): Promise<boolean> {
  if (idDocumento == null || idDocumento === '') return false;
  const result = await connection.execute<{ TIPO_DOCUMENTO: string }>(
    'SELECT TIPO_DOCUMENTO FROM CXP_DOCUMENTO WHERE ID_DOCUMENTO = :id', { id: Number(idDocumento) }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows?.[0]?.TIPO_DOCUMENTO === TIPO;
}

/**
 * Impide que el CRUD genérico de CXP modifique una factura especial o su trazabilidad
 * (documento, detalle, tributos, aprobaciones, eventos, constancias y correlativos).
 * `current` es la fila existente (update/remove) y `input` lo que se va a guardar.
 */
export async function checkFacturaEspecialGuard(connection: Connection, resource: CxpResource, current: CxpRecord | null, input: CxpRecord | null): Promise<void> {
  switch (resource) {
    case 'documentos':
      if (current?.tipoDocumento === TIPO || input?.tipoDocumento === TIPO) throw new CxpError(MENSAJE, 409);
      return;
    case 'documentos-detalle':
    case 'documentos-tributos':
    case 'aprobaciones':
      if (await esFacturaEspecial(connection, current?.idDocumento) || await esFacturaEspecial(connection, input?.idDocumento)) {
        throw new CxpError(MENSAJE, 409);
      }
      return;
    case 'eventos':
      // La bitácora del flujo es de solo lectura.
      if (String(current?.tipoEvento ?? input?.tipoEvento ?? '').startsWith('FE_')) throw new CxpError('Los movimientos de facturas especiales son de solo lectura.', 409);
      return;
    case 'archivos':
      if (current?.categoria === 'CONSTANCIA_FE' || input?.categoria === 'CONSTANCIA_FE') throw new CxpError('Las constancias de facturas especiales las genera el sistema al emitir o anular.', 409);
      return;
    case 'parametros':
      // Los correlativos solo avanzan al registrar o emitir; retrocederlos permitiría números repetidos.
      for (const record of [current, input]) {
        if (record?.grupoParametro === 'CXP_FACTURA_ESPECIAL' && String(record.codigo ?? '').startsWith('CORRELATIVO_')) {
          throw new CxpError('Los correlativos de facturas especiales los administra el sistema.', 409);
        }
      }
      return;
    default:
      return;
  }
}
