import type { Connection } from 'oracledb';
import type { CxpRecord } from '@erp/contracts';
import { findDocumentoDuplicate } from '../../repositories/documentos/documento.repository';
import { CxpError } from '../errors';

export async function assertNoDocumentoDuplicate(connection: Connection, input: CxpRecord, excludeId?: number): Promise<void> {
  const duplicate = await findDocumentoDuplicate(connection, input, excludeId);
  if (duplicate) {
    const messages = {
      uuidFiscal: 'El UUID fiscal ya está registrado en otro documento',
      hashOrigen: 'El hash de origen ya está registrado en otro documento',
      numeroDocumento: 'Ya existe un documento no anulado con el mismo proveedor, serie, número y tipo',
    };
    throw new CxpError(`${messages[duplicate.campo]} (ID ${duplicate.idDocumento})`, 409, [
      { campo: duplicate.campo, mensaje: messages[duplicate.campo] },
    ]);
  }
}

export function mapDocumentoUniqueError(error: unknown, input?: CxpRecord): never {
  const oracle = error as { errorNum?: number; code?: string; message?: string };
  if (oracle?.errorNum === 1 || oracle?.code === 'ORA-00001' || /ORA-00001/.test(oracle?.message ?? '')) {
    const constraint = oracle?.message?.match(/\(\s*(?:"?[\w$#]+"?\s*\.\s*)?"?(UK_CXP_DOC_UUID|UK_CXP_DOC_HASH|UX_CXP_DOC_DUPLICADO)"?\s*\)/i)?.[1]?.toUpperCase();
    if (constraint === 'UK_CXP_DOC_UUID') {
      throw new CxpError('El UUID fiscal ya está registrado en otro documento', 409, [
        { campo: 'uuidFiscal', mensaje: 'Conflicto con UK_CXP_DOC_UUID' },
      ]);
    }
    if (constraint === 'UK_CXP_DOC_HASH') {
      throw new CxpError('El hash de origen ya está registrado en otro documento', 409, [
        { campo: 'hashOrigen', mensaje: 'Conflicto con UK_CXP_DOC_HASH' },
      ]);
    }
    if (constraint === 'UX_CXP_DOC_DUPLICADO') {
      const complete = input?.idProveedor != null && Boolean(input.tipoDocumento && input.serie && input.numeroDocumento);
      const message = complete
        ? 'Ya existe un documento no anulado con el mismo proveedor, serie, número y tipo'
        : 'Oracle rechazó la clave de UX_CXP_DOC_DUPLICADO; la identificación del documento está incompleta';
      throw new CxpError(message, 409, [
        { campo: complete ? 'numeroDocumento' : 'documento', mensaje: message },
      ]);
    }
    throw new CxpError('Oracle rechazó una clave única del documento; no se identificó cuál', 409);
  }
  throw error;
}
