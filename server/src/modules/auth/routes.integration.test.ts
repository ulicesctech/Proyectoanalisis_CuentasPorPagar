import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import cxpRoutes from '../cxp/routes';
import { cxpErrorHandler } from '../cxp/controllers/errorHandler';
import { requireAllowedOrigin, requireCsrf, requireSession } from './routes';
import { config } from '../../config';

test('lecturas, archivos, exportaciones y escrituras CXP no llegan al controlador sin sesión', async () => {
  // No se inicializa el pool Oracle: una petición no autenticada debe terminar antes.
  const app = express();
  app.use('/api/cxp', requireAllowedOrigin, requireSession, requireCsrf, cxpRoutes, cxpErrorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}/api/cxp`;
    for (const path of [
      '/documentos', '/catalogos/usuarios', '/documentos/1/archivos/1/descargar',
      '/facturas-especiales/1/constancia', '/reportes/antiguedad',
    ]) {
      const response = await fetch(`${base}${path}`);
      assert.equal(response.status, 401, path);
    }
    const write = await fetch(`${base}/documentos/1/aprobacion`, {
      method: 'POST', headers: { Origin: config.corsOrigins[0], 'X-CXP-Actor-Id': '999' },
    });
    assert.equal(write.status, 401);
  } finally { server.close(); }
});
