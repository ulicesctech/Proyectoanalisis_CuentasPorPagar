import { createHash } from 'node:crypto';
import type { CxpValidationIssue } from '@erp/contracts';
import type { Connection } from 'oracledb';
import { getConnection } from '../../../../config/database';
import { withCxpTransaction } from '../../repositories/crud.repository';
import { cxpDocumentoRepository } from '../../repositories/documentos/documento.repository';
import {
  createDocumentoArchivo, findDocumentoArchivo, listDocumentoArchivos, retireDocumentoDteVersions,
  type DocumentoArchivoRow,
} from '../../repositories/documentos/documentoArchivo.repository';
import { CxpError } from '../errors';
import { createDteStorage, validateDteContent, type DteStorage } from './dte.storage';

function positiveId(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new CxpError(`${label} inválido`);
  return value;
}

async function requireDocumento(connection: Connection, idDocumento: number, lock = false) {
  const documento = await cxpDocumentoRepository.bind(connection).findById(idDocumento, lock);
  if (!documento) throw new CxpError('Documento no encontrado', 404);
  return documento;
}

async function readVerifiedDte(row: DocumentoArchivoRow, storage: DteStorage): Promise<Buffer> {
  const content = await storage.read(row.uriAlmacenamiento);
  if (content.length !== row.tamanoBytes ||
      createHash('sha256').update(content).digest('hex') !== row.hashSha256.toLowerCase()) {
    throw new CxpError('El contenido del archivo no coincide con su registro', 409);
  }
  return content;
}

export function createUploadDteOperation(
  run: typeof withCxpTransaction = withCxpTransaction,
  storage: DteStorage = createDteStorage(),
  connectionProvider: typeof getConnection = getConnection,
) {
  return async (idDocumento: number, body: unknown, fileName: unknown, mimeType: unknown) => {
    positiveId(idDocumento, 'Documento');
    const content = validateDteContent(body, fileName, mimeType);
    const progress: { storedUri: string | null; created: { idArchivo: number; nombreArchivo: string;
      tipoMime: string; tamanoBytes: number; hashSha256: string; versionArchivo: number } | null } = {
      storedUri: null, created: null,
    };
    try {
      return await run(async connection => {
        const documento = await requireDocumento(connection, idDocumento, true);
        if (documento.estado !== 'RECIBIDO') throw new CxpError('Solo se puede adjuntar un DTE a un documento RECIBIDO', 409);
        const existing = (await listDocumentoArchivos(connection, idDocumento)).filter(item => item.categoria === 'DTE');
        if ((await Promise.all(existing.filter(item => item.esVersionActual === 'S')
          .map(item => storage.exists(item.uriAlmacenamiento)))).some(Boolean)) {
          throw new CxpError('El documento ya tiene un DTE adjunto', 409);
        }
        const versionArchivo = Math.max(0, ...existing.map(item => item.versionArchivo)) + 1;
        progress.storedUri = await storage.save(content);
        if (existing.length) await retireDocumentoDteVersions(connection, idDocumento);
        const idArchivo = await createDocumentoArchivo(connection, {
          idDocumento, nombreArchivo: content.fileName, tipoMime: content.mimeType,
          tamanoBytes: content.buffer.length, hashSha256: content.sha256,
          uriAlmacenamiento: progress.storedUri, cargadoPor: Number(documento.creadoPor), versionArchivo,
        });
        progress.created = { idArchivo, nombreArchivo: content.fileName, tipoMime: content.mimeType,
          tamanoBytes: content.buffer.length, hashSha256: content.sha256, versionArchivo };
        return progress.created;
      });
    } catch (error) {
      if (progress.storedUri) {
        if (progress.created) {
          // Un COMMIT puede haber terminado aunque falle la respuesta o el cierre de conexión.
          // Antes de compensar, comprueba si Oracle ya confirmó el metadato.
          let connection: Connection | undefined;
          try {
            connection = await connectionProvider();
            const row = await findDocumentoArchivo(connection, idDocumento, progress.created.idArchivo);
            if (row?.uriAlmacenamiento === progress.storedUri) return progress.created;
          } catch (verificationError) {
            throw new AggregateError([error, verificationError],
              'No se pudo confirmar si Oracle guardó el DTE; se conserva el archivo para evitar metadatos sin contenido');
          } finally { try { await connection?.close(); } catch { /* La consulta ya resolvió el estado del COMMIT. */ } }
        }
        try { await storage.remove(progress.storedUri); }
        catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Falló la carga y no se pudo limpiar el archivo físico'); }
      }
      throw error;
    }
  };
}

export const uploadDocumentoDte = createUploadDteOperation();

/** RF04 solo acepta un adjunto del propio documento cuyo contenido coincide con Oracle. */
export async function documentoDteAttachmentIssue(
  connection: Connection, idDocumento: number, storage: DteStorage = createDteStorage(),
): Promise<CxpValidationIssue | null> {
  const rows = (await listDocumentoArchivos(connection, idDocumento))
    .filter(row => row.categoria === 'DTE' && row.esVersionActual === 'S');
  for (const row of rows) {
    try {
      await readVerifiedDte(row, storage);
      return null;
    } catch { /* Un archivo histórico o inaccesible no satisface RF04. */ }
  }
  return { campo: 'archivos', mensaje: 'Adjunta un DTE válido y disponible para poder validar el documento' };
}

export function createReadDteOperations(
  connectionProvider: typeof getConnection = getConnection,
  storage: DteStorage = createDteStorage(),
) {
  return {
    async list(idDocumento: number) {
      positiveId(idDocumento, 'Documento');
      const connection = await connectionProvider();
      try {
        await requireDocumento(connection, idDocumento);
        const rows = await listDocumentoArchivos(connection, idDocumento);
        return await Promise.all(rows.map(async item => {
          const { uriAlmacenamiento, ...row } = item;
          let disponible = false;
          if (row.categoria === 'DTE') {
            try { await readVerifiedDte(item, storage); disponible = true; }
            catch { /* Se conserva el metadato histórico aunque falte su contenido. */ }
          }
          return { ...row, disponible };
        }));
      } finally { await connection.close(); }
    },
    async download(idDocumento: number, idArchivo: number): Promise<{ metadata: DocumentoArchivoRow; content: Buffer }> {
      positiveId(idDocumento, 'Documento');
      positiveId(idArchivo, 'Archivo');
      const connection = await connectionProvider();
      let metadata: DocumentoArchivoRow | null;
      try {
        await requireDocumento(connection, idDocumento);
        metadata = await findDocumentoArchivo(connection, idDocumento, idArchivo);
      } finally { await connection.close(); }
      if (!metadata) throw new CxpError('El archivo no pertenece a este documento', 404);
      if (metadata.categoria !== 'DTE') throw new CxpError('Este archivo histórico no tiene contenido descargable', 404);
      const content = await readVerifiedDte(metadata, storage);
      return { metadata, content };
    },
  };
}

export const documentoDteReads = createReadDteOperations();
