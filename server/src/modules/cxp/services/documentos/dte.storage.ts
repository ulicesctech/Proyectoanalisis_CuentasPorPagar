import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { mkdir, open, realpath, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { CxpError } from '../errors';

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const URI_PREFIX = 'cxp-dte://';
const KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|xml)$/;

export type DteContent = {
  buffer: Buffer;
  fileName: string;
  mimeType: 'application/pdf' | 'application/xml';
  sha256: string;
  extension: 'pdf' | 'xml';
};

export function dteMaxBytes(): number {
  const configured = process.env.CXP_DTE_MAX_BYTES;
  if (!configured) return DEFAULT_MAX_BYTES;
  const value = Number(configured);
  if (!Number.isSafeInteger(value) || value < 1 || value > 50 * 1024 * 1024) {
    throw new Error('CXP_DTE_MAX_BYTES debe ser un entero entre 1 y 52428800');
  }
  return value;
}

export function validateDteContent(body: unknown, encodedName: unknown, declaredMime: unknown): DteContent {
  if (!Buffer.isBuffer(body) || body.length === 0) throw new CxpError('Selecciona un archivo DTE', 400);
  if (body.length > dteMaxBytes()) throw new CxpError('El archivo supera el tamaño permitido', 413);
  if (typeof encodedName !== 'string' || !encodedName || encodedName.length > 768) throw new CxpError('Nombre de archivo inválido');
  let decoded: string;
  try { decoded = decodeURIComponent(encodedName); }
  catch { throw new CxpError('Nombre de archivo inválido'); }
  const fileName = decoded;
  if (!fileName || fileName === '.' || fileName === '..' || /[/\\\u0000-\u001f\u007f]/.test(fileName) ||
      Buffer.byteLength(fileName, 'utf8') > 255) throw new CxpError('Nombre de archivo inválido');
  const extension = path.extname(fileName).toLowerCase().slice(1);
  const mime = typeof declaredMime === 'string' ? declaredMime.split(';', 1)[0].trim().toLowerCase() : '';
  if (extension === 'pdf') {
    if (mime !== 'application/pdf' || !body.subarray(0, 8).toString('latin1').startsWith('%PDF-') ||
        !/%%EOF\s*$/.test(body.subarray(-2048).toString('latin1'))) {
      throw new CxpError('El contenido no corresponde a un PDF válido');
    }
  } else if (extension === 'xml') {
    if (!['application/xml', 'text/xml'].includes(mime)) throw new CxpError('El tipo del XML no coincide con su contenido');
    let xml: string;
    try { xml = new TextDecoder('utf-8', { fatal: true }).decode(body); }
    catch { throw new CxpError('El XML no está codificado en UTF-8'); }
    if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(xml)) throw new CxpError('El XML contiene declaraciones no permitidas');
    const result = XMLValidator.validate(xml);
    if (result !== true) throw new CxpError('El XML no está bien formado');
    const parsed = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true }).parse(xml) as Record<string, unknown>;
    if (!('GTDocumento' in parsed) && !('DTE' in parsed)) throw new CxpError('El XML no contiene un documento DTE');
  } else {
    throw new CxpError('Solo se admiten DTE en PDF o XML');
  }
  return {
    buffer: body,
    fileName,
    mimeType: extension === 'pdf' ? 'application/pdf' : 'application/xml',
    sha256: createHash('sha256').update(body).digest('hex'),
    extension,
  };
}

export interface DteStorage {
  save(content: DteContent): Promise<string>;
  read(uri: string): Promise<Buffer>;
  exists(uri: string): Promise<boolean>;
  remove(uri: string): Promise<void>;
}

export function createDteStorage(root = process.env.CXP_DTE_STORAGE_DIR || path.resolve(process.cwd(), 'storage', 'cxp-dte')): DteStorage {
  if (process.env.CXP_DTE_STORAGE_DIR && !path.isAbsolute(root)) {
    throw new Error('CXP_DTE_STORAGE_DIR debe ser una ruta absoluta');
  }
  const directory = path.resolve(root);
  const target = (uri: string): string => {
    if (!uri.startsWith(URI_PREFIX)) throw new CxpError('Este archivo histórico no está disponible para descarga', 404);
    const key = uri.slice(URI_PREFIX.length);
    if (!KEY_PATTERN.test(key)) throw new CxpError('Ubicación de archivo inválida', 404);
    return path.join(directory, key);
  };
  return {
    async save(content) {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const key = `${randomUUID()}.${content.extension}`;
      const file = path.join(directory, key);
      let handle;
      try {
        handle = await open(file, 'wx', 0o600);
        try {
          await handle.writeFile(content.buffer);
          await handle.sync();
        } finally { await handle.close(); }
      } catch (error) {
        if (handle) await rm(file, { force: true });
        throw error;
      }
      return `${URI_PREFIX}${key}`;
    },
    async read(uri) {
      const file = target(uri);
      try {
        const [actualDirectory, actualFile] = await Promise.all([realpath(directory), realpath(file)]);
        if (path.dirname(actualFile) !== actualDirectory) throw new CxpError('Ubicación de archivo inválida', 404);
        const handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
        try {
          const info = await handle.stat();
          if (!info.isFile() || info.size > dteMaxBytes()) throw new CxpError('Archivo no disponible', 404);
          return await handle.readFile();
        } finally { await handle.close(); }
      } catch (error) {
        if (error instanceof CxpError) throw error;
        throw new CxpError('El contenido del archivo no está disponible', 404);
      }
    },
    async exists(uri) {
      try {
        const file = target(uri);
        const [actualDirectory, actualFile, info] = await Promise.all([realpath(directory), realpath(file), stat(file)]);
        return path.dirname(actualFile) === actualDirectory && info.isFile();
      } catch { return false; }
    },
    async remove(uri) { await rm(target(uri), { force: true }); },
  };
}
