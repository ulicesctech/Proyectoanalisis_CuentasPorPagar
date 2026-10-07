import oracledb, { type Connection } from 'oracledb';
import { cxpArchivoRepository } from '../control/archivo.repository';

export type DocumentoArchivoRow = {
  idArchivo: number;
  idDocumento: number;
  categoria: string;
  nombreArchivo: string;
  tipoMime: string;
  tamanoBytes: number;
  hashSha256: string;
  uriAlmacenamiento: string;
  versionArchivo: number;
  esVersionActual: string;
  fechaCarga: string;
};

type OracleArchivoRow = Record<string, string | number | null>;

function mapArchivo(row: OracleArchivoRow): DocumentoArchivoRow {
  return {
    idArchivo: Number(row.ID_ARCHIVO),
    idDocumento: Number(row.ID_DOCUMENTO),
    categoria: String(row.CATEGORIA),
    nombreArchivo: String(row.NOMBRE_ARCHIVO),
    tipoMime: String(row.TIPO_MIME),
    tamanoBytes: Number(row.TAMANO_BYTES),
    hashSha256: String(row.HASH_SHA256),
    uriAlmacenamiento: String(row.URI_ALMACENAMIENTO),
    versionArchivo: Number(row.VERSION_ARCHIVO),
    esVersionActual: String(row.ES_VERSION_ACTUAL).trim(),
    fechaCarga: String(row.FECHA_CARGA),
  };
}

export async function listDocumentoArchivos(connection: Connection, idDocumento: number): Promise<DocumentoArchivoRow[]> {
  const result = await connection.execute<OracleArchivoRow>(
    `SELECT ID_ARCHIVO, ID_DOCUMENTO, CATEGORIA, NOMBRE_ARCHIVO, TIPO_MIME,
            TAMANO_BYTES, HASH_SHA256, URI_ALMACENAMIENTO, VERSION_ARCHIVO, ES_VERSION_ACTUAL,
            TO_CHAR(FECHA_CARGA, 'YYYY-MM-DD"T"HH24:MI:SS') AS FECHA_CARGA
       FROM CXP_ARCHIVO
      WHERE ID_DOCUMENTO = :idDocumento
      ORDER BY ID_ARCHIVO DESC`,
    { idDocumento }, { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  return (result.rows ?? []).map(mapArchivo);
}

export async function findDocumentoArchivo(connection: Connection, idDocumento: number, idArchivo: number): Promise<DocumentoArchivoRow | null> {
  const result = await connection.execute<OracleArchivoRow>(
    `SELECT ID_ARCHIVO, ID_DOCUMENTO, CATEGORIA, NOMBRE_ARCHIVO, TIPO_MIME,
            TAMANO_BYTES, HASH_SHA256, URI_ALMACENAMIENTO, VERSION_ARCHIVO, ES_VERSION_ACTUAL,
            TO_CHAR(FECHA_CARGA, 'YYYY-MM-DD"T"HH24:MI:SS') AS FECHA_CARGA
       FROM CXP_ARCHIVO
      WHERE ID_DOCUMENTO = :idDocumento AND ID_ARCHIVO = :idArchivo`,
    { idDocumento, idArchivo }, { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  return result.rows?.[0] ? mapArchivo(result.rows[0]) : null;
}

export async function createDocumentoArchivo(connection: Connection, input: {
  idDocumento: number;
  nombreArchivo: string;
  tipoMime: string;
  tamanoBytes: number;
  hashSha256: string;
  uriAlmacenamiento: string;
  cargadoPor: number;
  versionArchivo: number;
}): Promise<number> {
  return cxpArchivoRepository.bind(connection).create({
    ...input, categoria: 'DTE', esVersionActual: 'S',
  });
}

export async function retireDocumentoDteVersions(connection: Connection, idDocumento: number): Promise<void> {
  await connection.execute(
    `UPDATE CXP_ARCHIVO SET ES_VERSION_ACTUAL = 'N'
      WHERE ID_DOCUMENTO = :idDocumento AND CATEGORIA = 'DTE'`,
    { idDocumento },
  );
}
