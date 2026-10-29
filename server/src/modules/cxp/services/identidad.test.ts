import assert from 'node:assert/strict';
import test from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import type { ActorProceso } from '@erp/contracts';
import type { Connection } from 'oracledb';
import { parseCorsOrigins, parseCxpAuthMode, parsePort } from '../../../config';
import {
  actorDesdeUsuario, createExigirListadoUsuarios, createResolverActor, exigirActor, exigirRolProceso, listadoUsuariosDisponible,
} from './identidad';
import { findUsuarioOperativoWithConnection, type UsuarioOperativoRow } from '../repositories/control/usuario.repository';
import { assertDistinctOperator } from './procesos/workflow';

const usuario: UsuarioOperativoRow = {
  idUsuario: 7, nombre: 'Tesorera', idRol: 3, rolActivo: true,
  nombreRolNormalizado: 'TESORERIA_CXP', coincidenciasNombreRol: 1,
};

function run(handler: (req: Request, res: Response, next: NextFunction) => unknown, header?: string, actor?: ActorProceso) {
  const res = { locals: actor ? { cxpActor: actor } : {} as Record<string, unknown>, headers: {} as Record<string, string>,
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
  assert.deepEqual(res.locals.cxpActor, { id: 7, nombre: 'Tesorera', roles: [3], permisos: ['TESORERIA'] });
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

test('la consulta conserva la relación real USUARIO → ROL y distingue rol inactivo', async () => {
  let sql = '';
  const connection = { execute: async (query: string) => {
    sql = query;
    return { rows: [{ ID: 7, NOMBRE: 'Tesorera', ID_ROL: 3, ROL_ACTIVO: 0,
      NOMBRE_ROL_NORMALIZADO: 'TESORERIA_CXP', COINCIDENCIAS_NOMBRE_ROL: 1 }] };
  } } as unknown as Connection;
  const row = await findUsuarioOperativoWithConnection(connection, 7);
  assert.deepEqual(row, { idUsuario: 7, nombre: 'Tesorera', idRol: 3, rolActivo: false,
    nombreRolNormalizado: 'TESORERIA_CXP', coincidenciasNombreRol: 1 });
  assert.match(sql, /R\.ROL_ID_ROL = U\.USU_ID_ROL/);
  assert.match(sql, /U\.USU_ACTIVO = 1/);
  assert.match(sql, /REGEXP_REPLACE\(UPPER\(R\.ROL_NOMBRE_ROL\)/);
  assert.match(sql, /COUNT\(\*\) OVER \(PARTITION BY REGEXP_REPLACE/);
});

test('cada nombre de rol activo concede solo su capacidad, sin depender del ID', () => {
  const matrix = [
    ['OPERADOR_CXP', 'CREAR'], ['APROBADOR_CXP', 'APROBAR'],
    ['TESORERIA_CXP', 'TESORERIA'], ['SUPERVISOR_CXP', 'ANULAR'],
  ] as const;
  for (const [nombreRolNormalizado, permiso] of matrix) {
    for (const idRol of [17, 932]) {
      const actor = actorDesdeUsuario({ ...usuario, idRol, nombreRolNormalizado });
      assert.deepEqual(actor.permisos, [permiso]);
      assert.deepEqual(actor.roles, [idRol]);
    }
  }
  const dosTesoreros = [7, 8].map(idUsuario => actorDesdeUsuario({ ...usuario, idUsuario }));
  assert.deepEqual(dosTesoreros.map(actor => actor.permisos), [['TESORERIA'], ['TESORERIA']]);
  assert.notEqual(dosTesoreros[0].id, dosTesoreros[1].id);
});

test('rol desconocido, ausente o inactivo no recibe capacidades', () => {
  assert.deepEqual(actorDesdeUsuario({ ...usuario, nombreRolNormalizado: 'OTRO_ROL' }).permisos, []);
  assert.deepEqual(actorDesdeUsuario({ ...usuario, nombreRolNormalizado: null }).permisos, []);
  assert.deepEqual(actorDesdeUsuario({ ...usuario, rolActivo: false }).permisos, []);
  assert.deepEqual(actorDesdeUsuario({ ...usuario, idRol: null }).permisos, []);
});

test('un nombre configurado duplicado produce error claro', () => {
  assert.throws(() => actorDesdeUsuario({ ...usuario, coincidenciasNombreRol: 2 }), /ambiguo en ROL/);
});

test('varias personas de TESORERIA_CXP conservan la segregación de programar, ejecutar y confirmar', () => {
  const programador = actorDesdeUsuario({ ...usuario, idUsuario: 7 });
  const ejecutor = actorDesdeUsuario({ ...usuario, idUsuario: 8 });
  const confirmador = actorDesdeUsuario({ ...usuario, idUsuario: 9 });
  const pago = { programadoPor: programador.id, ejecutadoPor: ejecutor.id };
  assert.throws(() => assertDistinctOperator(pago, programador, ['programadoPor'], 'Otra persona'), { status: 403 });
  assert.doesNotThrow(() => assertDistinctOperator(pago, ejecutor, ['programadoPor'], 'Otra persona'));
  assert.throws(() => assertDistinctOperator(pago, ejecutor, ['programadoPor', 'ejecutadoPor'], 'Tercera persona'), { status: 403 });
  assert.doesNotThrow(() => assertDistinctOperator(pago, confirmador, ['programadoPor', 'ejecutadoPor'], 'Tercera persona'));
});

test('un encabezado inválido es 401 sin consultar Oracle', async () => {
  for (const header of ['abc', '0', '-3', '1.5', '7 OR 1=1']) {
    let consultas = 0;
    const { error } = await run(createResolverActor(async () => { consultas += 1; return usuario; }), header);
    assert.equal((error as { status?: number })?.status, 401, header);
    assert.equal(consultas, 0, header);
  }
});

test('un usuario activo sin rol activo puede operar fuera del proceso', async () => {
  const { error, res } = await run(createResolverActor(async () => ({ ...usuario, idUsuario: 8, nombre: 'Sin rol', rolActivo: false })), '8');
  assert.equal(error, undefined);
  assert.deepEqual((res.locals.cxpActor as { roles: number[] }).roles, []);
  assert.deepEqual((res.locals.cxpActor as { permisos: string[] }).permisos, []);
});

test('el proceso exige un rol activo aunque se le inyecte una capacidad', async () => {
  const actor = { id: 8, nombre: 'Sin rol', roles: [], permisos: ['CREAR', 'APROBAR', 'TESORERIA', 'ANULAR'] } as ActorProceso;
  assert.equal(((await run(exigirRolProceso, undefined, actor)).error as { status?: number }).status, 401);
  assert.equal((await run(exigirRolProceso, undefined, { ...actor, roles: [3] })).error, undefined);
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
