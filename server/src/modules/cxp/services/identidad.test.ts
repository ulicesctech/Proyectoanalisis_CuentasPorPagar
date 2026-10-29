import assert from 'node:assert/strict';
import test from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { parseCorsOrigins, parseCxpAuthMode, parsePort } from '../../../config';
import {
  createExigirListadoUsuarios, createResolverActor, exigirActor, listadoUsuariosDisponible,
} from './identidad';
import type { UsuarioOperativoRow } from '../repositories/control/usuario.repository';
import { assertApprovalSegregation } from './procesos/workflow';

const usuario: UsuarioOperativoRow = { idUsuario: 7, nombre: 'Tesorera' };

function run(handler: (req: Request, res: Response, next: NextFunction) => unknown, header?: string) {
  const res = { locals: {} as Record<string, unknown>, headers: {} as Record<string, string>,
    setHeader(name: string, value: string) { this.headers[name] = value; } };
  const req = { header: (name: string) => (name === 'X-CXP-Actor-Id' ? header : undefined) };
  return new Promise<{ error: unknown; res: typeof res }>(resolve => {
    void handler(req as unknown as Request, res as unknown as Response, (error?: unknown) => resolve({ error, res }));
  });
}

test('sin encabezado el actor queda en null y no se consulta Oracle', async () => {
  let consultas = 0;
  const { error, res } = await run(createResolverActor(async () => { consultas += 1; return usuario; }));
  assert.equal(error, undefined);
  assert.equal(res.locals.cxpActor, null);
  assert.equal(consultas, 0);
});

test('resuelve un usuario operativo activo', async () => {
  const { error, res } = await run(createResolverActor(async id => (id === 7 ? usuario : null)), '7');
  assert.equal(error, undefined);
  assert.deepEqual(res.locals.cxpActor, { id: 7, nombre: 'Tesorera', roles: [], permisos: ['CREAR', 'APROBAR', 'TESORERIA', 'ANULAR'] });
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

test('un encabezado inválido es 401 sin consultar Oracle', async () => {
  for (const header of ['abc', '0', '-3', '1.5', '7 OR 1=1']) {
    let consultas = 0;
    const { error } = await run(createResolverActor(async () => { consultas += 1; return usuario; }), header);
    assert.equal((error as { status?: number })?.status, 401, header);
    assert.equal(consultas, 0, header);
  }
});

test('los roles no se usan: el actor siempre se identifica con roles vacíos', async () => {
  const { error, res } = await run(createResolverActor(async () => ({ idUsuario: 8, nombre: 'Sin rol' })), '8');
  assert.equal(error, undefined);
  assert.deepEqual((res.locals.cxpActor as { roles: number[] }).roles, []);
});

test('un usuario sin rol puede decidir una aprobación de pago', () => {
  const aprobacion = { id: 1, regla: 9, nombre: 'Firma', nivel: 1, rol: 4, decision: 'PENDIENTE' as const };
  assert.doesNotThrow(() => assertApprovalSegregation({ aprobaciones: [aprobacion] }, aprobacion,
    { id: 8, nombre: 'Sin rol', roles: [], permisos: ['APROBAR'] }));
});

test('un usuario inexistente o inactivo es 401', async () => {
  const { error } = await run(createResolverActor(async () => null), '99');
  assert.equal((error as { status?: number })?.status, 401);
});

test('exigirActor rechaza la petición sin actor', async () => {
  const sinActor = await run(exigirActor);
  assert.equal((sinActor.error as { status?: number })?.status, 401);
});

test('el listado de usuarios solo existe en el modo provisional', async () => {
  assert.equal(listadoUsuariosDisponible('provisional'), true);
  assert.equal(listadoUsuariosDisponible('sesion' as never), false);
  const bloqueado = await run(createExigirListadoUsuarios(() => 'sesion' as never));
  assert.equal((bloqueado.error as { status?: number })?.status, 404);
  const permitido = await run(createExigirListadoUsuarios(() => 'provisional'));
  assert.equal(permitido.error, undefined);
});

test('el modo provisional es el predeterminado y no arranca en producción', () => {
  assert.equal(parseCxpAuthMode(undefined, undefined), 'provisional');
  assert.equal(parseCxpAuthMode('provisional', 'development'), 'provisional');
  assert.throws(() => parseCxpAuthMode(undefined, 'production'), /production/);
  assert.throws(() => parseCxpAuthMode('jwt', undefined), /no es válido/);
});

test('CORS usa http://localhost:5173 por defecto y exige orígenes exactos', () => {
  assert.deepEqual(parseCorsOrigins(undefined), ['http://localhost:5173']);
  assert.deepEqual(parseCorsOrigins('http://localhost:5173, https://erp.example.test'), ['http://localhost:5173', 'https://erp.example.test']);
  assert.throws(() => parseCorsOrigins('*'), /inválido/);
  assert.throws(() => parseCorsOrigins('http://localhost:5173/'), /exactos/);
  assert.throws(() => parseCorsOrigins('http://localhost:5173/app'), /exactos/);
});

test('PORT se valida como número', () => {
  assert.equal(parsePort(undefined), 3000);
  assert.equal(parsePort('4000'), 4000);
  assert.throws(() => parsePort('abc'));
  assert.throws(() => parsePort('70000'));
});
