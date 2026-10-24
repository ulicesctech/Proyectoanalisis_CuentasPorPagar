import { createCxpService } from '../crud.service';
import { withCxpTransaction } from '../../repositories/crud.repository';
import { cxpDocumentoRepository } from '../../repositories/documentos/documento.repository';
import { getDocumentoComponents, getDocumentoExpediente, listDocumentos } from '../../repositories/documentos/documento.repository';
import { assertNoDocumentoDuplicate } from './documento.duplicate';
import { collectDocumentoValidationIssues } from './documento.validation';
import { collectCxpDocumentoCalendarDateIssues } from './documento.policy';
import { documentoDteAttachmentIssue } from './documentoArchivo.service';
import { createDteStorage, type DteStorage } from './dte.storage';
import { CxpError } from '../errors';
import { buildPaginationMeta, getCxpEntity } from '@erp/contracts';
import oracledb, { type Connection } from 'oracledb';
import type { CxpValidationIssue } from '@erp/contracts';

/**
 * FECHA_RECEPCION y FECHA_CREACION tienen DEFAULT SYSTIMESTAMP y no conservan
 * zona horaria. Se contrastan con ese mismo reloj, sin reinterpretarlas como
 * fechas de Guatemala ni modificar los valores almacenados.
 */
async function verifyOracleAuditDates(
  connection: Connection, id: number, issues: CxpValidationIssue[],
): Promise<CxpValidationIssue[]> {
  const message = 'Esta fecha no puede ser posterior al día de hoy';
  const auditFields = new Set(['fechaRecepcion', 'fechaCreacion']);
  if (!issues.some(issue => auditFields.has(issue.campo) && issue.mensaje === message)) return issues;

  const result = await connection.execute<{ RECEPCION_VALIDA: number; CREACION_VALIDA: number }>(
    `SELECT
       CASE WHEN FECHA_RECEPCION <= CAST(SYSTIMESTAMP AS TIMESTAMP) THEN 1 ELSE 0 END AS RECEPCION_VALIDA,
       CASE WHEN FECHA_CREACION <= CAST(SYSTIMESTAMP AS TIMESTAMP) THEN 1 ELSE 0 END AS CREACION_VALIDA
     FROM CXP_DOCUMENTO WHERE ID_DOCUMENTO = :id`,
    { id }, { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const audit = result.rows?.[0];
  if (!audit) throw new CxpError('No se pudieron comprobar las fechas automáticas del documento', 409);
  const verified = new Set<string>();
  if (audit.RECEPCION_VALIDA === 1) verified.add('fechaRecepcion');
  if (audit.CREACION_VALIDA === 1) verified.add('fechaCreacion');
  return issues.filter(issue => !(verified.has(issue.campo) && issue.mensaje === message));
}

export const cxpDocumentoService = createCxpService(cxpDocumentoRepository);

export async function listDocumentoPage(query: {
  page?: string; limit?: string; search?: string; estado?: string; idProveedor?: string; venceHasta?: string;
}) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 10 : Number(query.limit);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new CxpError('Paginación inválida');
  }
  const states = getCxpEntity('documentos')!.fields.find(field => field.name === 'estado')?.options ?? [];
  if (query.estado && !states.includes(query.estado)) throw new CxpError('Estado de documento inválido');
  const idProveedor = query.idProveedor ? Number(query.idProveedor) : undefined;
  if (idProveedor !== undefined && (!Number.isSafeInteger(idProveedor) || idProveedor <= 0)) throw new CxpError('Proveedor inválido');
  if (query.venceHasta) {
    const parsed = new Date(`${query.venceHasta}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(query.venceHasta) || Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== query.venceHasta) throw new CxpError('Fecha de vencimiento inválida');
  }
  const result = await listDocumentos({
    page, limit, search: query.search?.trim().slice(0, 150), estado: query.estado,
    idProveedor, venceHasta: query.venceHasta,
  });
  return { data: result.data, meta: buildPaginationMeta(result.total, page, limit) };
}

export async function readDocumentoExpediente(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new CxpError('El identificador debe ser un entero positivo');
  const expediente = await getDocumentoExpediente(id);
  if (!expediente) throw new CxpError('Documento no encontrado', 404);
  return expediente;
}

export function createDocumentoValidationOperation(
  run: typeof withCxpTransaction = withCxpTransaction,
  storage: DteStorage = createDteStorage(),
) {
  return async (id: number) => {
    if (!Number.isSafeInteger(id) || id <= 0) throw new CxpError('El identificador debe ser un entero positivo');
    return run(async connection => {
      const transaction = cxpDocumentoRepository.bind(connection);
      const document = await transaction.findById(id, true);
      if (!document) throw new CxpError('Documento no encontrado', 404);
      if (document.estado !== 'RECIBIDO') throw new CxpError('Solo se puede validar un documento RECIBIDO', 409);
      const { details, tributes } = await getDocumentoComponents(connection, id);
      const issues = await verifyOracleAuditDates(
        connection, id, collectDocumentoValidationIssues(document, details, tributes),
      );
      issues.push(...collectCxpDocumentoCalendarDateIssues(document));
      const attachmentIssue = await documentoDteAttachmentIssue(connection, id, storage);
      if (attachmentIssue) issues.push(attachmentIssue);
      try { await assertNoDocumentoDuplicate(connection, document, id); }
      catch (error) {
        if (error instanceof CxpError && error.status === 409) issues.push(...error.details);
        else throw error;
      }
      if (issues.length) throw new CxpError('El documento no superó la validación RF04', 422, issues);
      await transaction.update(id, { estado: 'PENDIENTE_APROBACION' });
      return (await transaction.findById(id))!;
    });
  };
}

export const validateReceivedDocumento = createDocumentoValidationOperation();
