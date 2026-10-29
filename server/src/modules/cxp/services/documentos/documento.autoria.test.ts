import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { applyCxpActorFields } from '@erp/contracts';
import { requireCxpSession } from '../../../auth/routes';
import { createCxpController } from '../../controllers/crud.controller';
import { cxpErrorHandler } from '../../controllers/errorHandler';
import { cxpDocumentoService } from './documento.service';

test('API documentos: la sesión rechaza suplantación por cuerpo, cabecera y query sin abrir Oracle', async () => {
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    res.locals.authSession = { mustChangePassword: false,
      actor: { id: 7, nombre: 'Operador autenticado', roles: [1], permisos: ['CREAR'] } };
    next();
  }, requireCxpSession);
  app.post('/documentos', createCxpController(cxpDocumentoService).create);
  app.use(cxpErrorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}/documentos`;
    for (const [path, headers, body] of [
      ['', {}, { creadoPor: 99 }],
      ['', {}, { modificadoPor: 99 }],
      ['', { 'X-CXP-Actor-Id': '99' }, {}],
      ['?actorId=99', {}, {}],
    ] as const) {
      const response = await fetch(base + path, { method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
      assert.equal(response.status, 403);
    }
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('documentos: la sesión fija el autor y conserva el creador original al editar', () => {
  const created = applyCxpActorFields('documentos', 7, { solicitadoPor: 12, responsablePor: 13 });
  assert.equal(created.record.creadoPor, 7);
  assert.equal(created.record.solicitadoPor, 12);
  assert.equal(created.record.responsablePor, 13);
  const original = { creadoPor: 9, modificadoPor: null };
  const edited = applyCxpActorFields('documentos', 7, { observaciones: 'Corrección' }, original);
  assert.deepEqual(edited.issues, []);
  assert.equal(edited.record.modificadoPor, 7);
  assert.equal(Object.hasOwn(edited.record, 'creadoPor'), false);
  assert.equal(original.creadoPor, 9);
  assert.ok(applyCxpActorFields('documentos', 7, { creadoPor: 7 }, original).issues.length);
});
