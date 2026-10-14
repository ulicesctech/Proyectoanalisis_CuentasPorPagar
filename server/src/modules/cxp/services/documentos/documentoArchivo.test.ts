import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { Connection } from 'oracledb';
import { cxpArchivoService } from '../control/archivo.service';
import { createCxpService } from '../crud.service';
import { cxpDocumentoRepository } from '../../repositories/documentos/documento.repository';
import { createReadDteOperations, createUploadDteOperation } from './documentoArchivo.service';
import { createDteStorage, validateDteContent, type DteStorage } from './dte.storage';

const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
const xml = Buffer.from('<?xml version="1.0" encoding="UTF-8"?><dte:GTDocumento xmlns:dte="urn:fel"></dte:GTDocumento>');
type Row = Record<string, string | number | null>;

function memory(options: { insertFails?: boolean; commitFails?: boolean; committedResponseFails?: boolean;
  documentState?: string; files?: Row[] } = {}) {
  let files: Row[] = (options.files ?? []).map(row => ({ ...row }));
  const writes: string[] = [];
  let closed = 0;
  const connection = {
    async execute(sql: string, binds: Record<string, unknown> = {}) {
      if (sql.includes("P.CODIGO_PAGO LIKE 'CP-%'")) return { rows: [] };
      if (sql.includes('FROM CXP_DOCUMENTO WHERE ID_DOCUMENTO = :id')) {
        return { rows: Number(binds.id) === 4 ? [{ ID_DOCUMENTO: 4, ESTADO: options.documentState ?? 'RECIBIDO', CREADO_POR: 7 }] : [] };
      }
      if (sql.includes('FROM CXP_ARCHIVO') && sql.includes('ID_DOCUMENTO = :idDocumento')) {
        const rows = files.filter(row => row.ID_DOCUMENTO === binds.idDocumento &&
          (binds.idArchivo === undefined || row.ID_ARCHIVO === binds.idArchivo));
        return { rows: rows.map(row => ({ ...row })) };
      }
      if (sql.startsWith('UPDATE CXP_ARCHIVO')) {
        files.forEach(row => { if (row.ID_DOCUMENTO === binds.idDocumento) row.ES_VERSION_ACTUAL = 'N'; });
        writes.push('UPDATE');
        return { rowsAffected: files.length };
      }
      if (sql.startsWith('INSERT INTO CXP_ARCHIVO')) {
        if (options.insertFails) throw new Error('Oracle INSERT failed');
        const columns = sql.match(/INSERT INTO CXP_ARCHIVO \(([^)]+)\)/)![1].split(', ');
        const row: Row = { ID_ARCHIVO: files.length + 1, FECHA_CARGA: '2026-10-05T10:00:00' };
        columns.forEach((column, index) => { row[column] = (binds[`v${index}`] as { val: string | number }).val; });
        files.push(row);
        writes.push('INSERT');
        return { outBinds: { newId: [row.ID_ARCHIVO] } };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    },
    async close() { closed++; },
  } as unknown as Connection;
  const run = (async <T>(operation: (connection: Connection) => Promise<T>): Promise<T> => {
    const before = structuredClone(files);
    try {
      const result = await operation(connection);
      if (options.commitFails) throw new Error('Oracle COMMIT failed');
      if (options.committedResponseFails) throw new Error('Oracle response failed after COMMIT');
      return result;
    } catch (error) { if (!options.committedResponseFails) files = before; throw error; }
  }) as typeof import('../../repositories/crud.repository').withCxpTransaction;
  const storageFiles = new Map<string, Buffer>();
  const storage: DteStorage = {
    async save(content) {
      const uri = `cxp-dte://00000000-0000-4000-8000-000000000001.${content.extension}`;
      storageFiles.set(uri, content.buffer);
      return uri;
    },
    async read(uri) { const content = storageFiles.get(uri); if (!content) throw new Error('missing file'); return content; },
    async exists(uri) { return storageFiles.has(uri); },
    async remove(uri) { storageFiles.delete(uri); },
  };
  const connectionProvider = async () => connection;
  return { run, storage, connectionProvider, writes, storageFiles, get files() { return files; }, get closed() { return closed; } };
}

test('carga PDF válido: el servidor calcula los metadatos y deja contenido descargable', async () => {
  const db = memory();
  const uploaded = await createUploadDteOperation(db.run, db.storage, db.connectionProvider)(4, pdf, encodeURIComponent('Factura octubre.pdf'), 'application/pdf');
  assert.equal(uploaded.nombreArchivo, 'Factura octubre.pdf');
  assert.equal(uploaded.tamanoBytes, pdf.length);
  assert.equal(uploaded.hashSha256, createHash('sha256').update(pdf).digest('hex'));
  assert.deepEqual(db.writes, ['INSERT']);
  assert.equal(db.storageFiles.size, 1);
  const reads = createReadDteOperations(db.connectionProvider, db.storage);
  const listed = await reads.list(4);
  assert.equal(listed[0].disponible, true);
  assert.equal('uriAlmacenamiento' in listed[0], false);
  assert.deepEqual((await reads.download(4, uploaded.idArchivo)).content, pdf);
});

test('XML DTE bien formado se admite; extensión, MIME y contenido discordantes se rechazan sin escrituras', async () => {
  const db = memory();
  await createUploadDteOperation(db.run, db.storage, db.connectionProvider)(4, xml, 'dte.xml', 'application/xml');
  assert.equal(db.files[0].TIPO_MIME, 'application/xml');
  for (const [body, name, mime] of [
    [Buffer.from('no es PDF'), 'f.pdf', 'application/pdf'],
    [pdf, 'f.xml', 'application/xml'],
    [Buffer.from('<!DOCTYPE foo><DTE/>'), 'f.xml', 'application/xml'],
    [Buffer.from('<DTE>'), 'f.xml', 'application/xml'],
    [pdf, 'f.exe', 'application/pdf'],
  ] as const) {
    const invalid = memory();
    await assert.rejects(createUploadDteOperation(invalid.run, invalid.storage, invalid.connectionProvider)(4, body, name, mime));
    assert.deepEqual(invalid.writes, []);
    assert.equal(invalid.storageFiles.size, 0);
  }
  assert.throws(() => validateDteContent(Buffer.alloc(10 * 1024 * 1024 + 1), 'grande.pdf', 'application/pdf'), { status: 413 });
  assert.throws(() => validateDteContent(pdf, '../dte.pdf', 'application/pdf'), { status: 400 });
});

test('un archivo de otro documento no se descarga ni se consulta por una ruta manipulada', async () => {
  const row: Row = {
    ID_ARCHIVO: 9, ID_DOCUMENTO: 4, CATEGORIA: 'DTE', NOMBRE_ARCHIVO: 'dte.pdf',
    TIPO_MIME: 'application/pdf', TAMANO_BYTES: pdf.length,
    HASH_SHA256: createHash('sha256').update(pdf).digest('hex'),
    URI_ALMACENAMIENTO: 'cxp-dte://00000000-0000-4000-8000-000000000001.pdf',
    VERSION_ARCHIVO: 1, ES_VERSION_ACTUAL: 'S', FECHA_CARGA: '2026-10-05T10:00:00',
  };
  const db = memory({ files: [row] });
  db.storageFiles.set(String(row.URI_ALMACENAMIENTO), pdf);
  const reads = createReadDteOperations(db.connectionProvider, db.storage);
  await assert.rejects(reads.download(5, 9), { status: 404 });
  await assert.rejects(reads.download(4, 10), { status: 404 });
  assert.deepEqual((await reads.download(4, 9)).content, pdf);
  db.storageFiles.set(String(row.URI_ALMACENAMIENTO), Buffer.from('alterado'));
  assert.equal((await reads.list(4))[0].disponible, false);
  await assert.rejects(reads.download(4, 9), { status: 409 });
});

test('fallo de INSERT o COMMIT revierte metadatos y limpia el archivo físico', async () => {
  for (const options of [{ insertFails: true }, { commitFails: true }]) {
    const db = memory(options);
    await assert.rejects(createUploadDteOperation(db.run, db.storage, db.connectionProvider)(4, pdf, 'dte.pdf', 'application/pdf'));
    assert.equal(db.files.length, 0);
    assert.equal(db.storageFiles.size, 0);
  }
});

test('si Oracle confirmó el COMMIT aunque falle la respuesta, conserva contenido y metadatos', async () => {
  const db = memory({ committedResponseFails: true });
  const uploaded = await createUploadDteOperation(db.run, db.storage, db.connectionProvider)(4, pdf, 'dte.pdf', 'application/pdf');
  assert.equal(uploaded.idArchivo, db.files[0].ID_ARCHIVO);
  assert.equal(db.storageFiles.size, 1);
  assert.equal((await createReadDteOperations(db.connectionProvider, db.storage).list(4))[0].disponible, true);
});

test('documento no recibido y carga repetida no escriben ni reemplazan contenido', async () => {
  const approved = memory({ documentState: 'APROBADA' });
  await assert.rejects(createUploadDteOperation(approved.run, approved.storage, approved.connectionProvider)(4, pdf, 'dte.pdf', 'application/pdf'), { status: 409 });
  assert.equal(approved.storageFiles.size, 0);
  const db = memory();
  const upload = createUploadDteOperation(db.run, db.storage, db.connectionProvider);
  await upload(4, pdf, 'dte.pdf', 'application/pdf');
  await assert.rejects(upload(4, pdf, 'dte.pdf', 'application/pdf'), { status: 409 });
  assert.equal(db.files.length, 1);
  assert.equal(db.storageFiles.size, 1);
});

test('un expediente histórico sin contenido sigue consultable y admite adjuntar una nueva versión', async () => {
  const db = memory({ files: [{
    ID_ARCHIVO: 3, ID_DOCUMENTO: 4, CATEGORIA: 'DTE', NOMBRE_ARCHIVO: 'anterior.pdf',
    TIPO_MIME: 'application/pdf', TAMANO_BYTES: 100, HASH_SHA256: 'a'.repeat(64),
    URI_ALMACENAMIENTO: 'file:///almacenamiento/anterior.pdf', VERSION_ARCHIVO: 1,
    ES_VERSION_ACTUAL: 'S', FECHA_CARGA: '2025-01-01T10:00:00',
  }] });
  const reads = createReadDteOperations(db.connectionProvider, db.storage);
  assert.equal((await reads.list(4))[0].disponible, false);
  const uploaded = await createUploadDteOperation(db.run, db.storage, db.connectionProvider)(4, pdf, 'actual.pdf', 'application/pdf');
  assert.equal(uploaded.versionArchivo, 2);
  assert.equal(db.files[0].ES_VERSION_ACTUAL, 'N');
  assert.equal(db.files[1].ES_VERSION_ACTUAL, 'S');
  assert.equal((await reads.list(4)).filter(row => row.disponible).length, 1);
});

test('los metadatos de un DTE no se crean con una URI enviada al CRUD común', async () => {
  await assert.rejects(cxpArchivoService.create({
    idDocumento: 4, categoria: 'DTE', nombreArchivo: 'f.pdf', tipoMime: 'application/pdf',
    tamanoBytes: pdf.length, hashSha256: 'a'.repeat(64), uriAlmacenamiento: 'file:///tmp/f.pdf', cargadoPor: 7,
  }), { status: 409 });
});

test('el CRUD no elimina un documento con archivo asociado', async () => {
  const db = memory();
  await createUploadDteOperation(db.run, db.storage, db.connectionProvider)(4, pdf, 'dte.pdf', 'application/pdf');
  await assert.rejects(createCxpService(cxpDocumentoRepository, db.run).remove(4), { status: 409 });
  assert.equal(db.files.length, 1);
  assert.equal(db.storageFiles.size, 1);
});

test('almacenamiento local rechaza URI con traversal y elimina el contenido bajo su clave', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'cxp-dte-test-'));
  try {
    const storage = createDteStorage(directory);
    const uri = await storage.save(validateDteContent(pdf, 'f.pdf', 'application/pdf'));
    assert.deepEqual(await storage.read(uri), pdf);
    await assert.rejects(storage.read('cxp-dte://../secreto.pdf'), { status: 404 });
    await storage.remove(uri);
    assert.equal(await storage.exists(uri), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
