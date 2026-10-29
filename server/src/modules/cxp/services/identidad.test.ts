import assert from 'node:assert/strict';
import test from 'node:test';
import type { Connection } from 'oracledb';
import { actorDesdeUsuario, exigirActor, exigirRolProceso } from './identidad';
import { findUsuarioOperativoWithConnection, type UsuarioOperativoRow } from '../repositories/control/usuario.repository';
import { assertDistinctOperator } from './procesos/workflow';

const usuario: UsuarioOperativoRow = {
  idUsuario: 7, nombre: 'Tesorera', idRol: 3, rolActivo: true,
  nombreRolNormalizado: 'TESORERIA_CXP', coincidenciasNombreRol: 1,
};

test('USUARIO activo se relaciona con ROL activo por USU_ID_ROL', async () => {
  let sql = '';
  const connection = { execute: async (query: string) => {
    sql = query;
    return { rows: [{ ID: 7, NOMBRE: 'Tesorera', ID_ROL: 3, ROL_ACTIVO: 1,
      NOMBRE_ROL_NORMALIZADO: 'TESORERIA_CXP', COINCIDENCIAS_NOMBRE_ROL: 1 }] };
  } } as unknown as Connection;
  assert.deepEqual(await findUsuarioOperativoWithConnection(connection, 7), usuario);
  assert.match(sql, /R\.ROL_ID_ROL = U\.USU_ID_ROL/);
  assert.match(sql, /U\.USU_ACTIVO = 1/);
});

test('capacidad derivada del nombre y rol activo, sin IDs fijos', () => {
  for (const [nombreRolNormalizado, permission] of [
    ['OPERADOR_CXP', 'CREAR'], ['APROBADOR_CXP', 'APROBAR'],
    ['TESORERIA_CXP', 'TESORERIA'], ['SUPERVISOR_CXP', 'ANULAR'],
  ]) {
    for (const idRol of [17, 932]) {
      const actor = actorDesdeUsuario({ ...usuario, idRol, nombreRolNormalizado });
      assert.deepEqual(actor.permisos, [permission]);
      assert.deepEqual(actor.roles, [idRol]);
    }
  }
  assert.deepEqual(actorDesdeUsuario({ ...usuario, rolActivo: false }).permisos, []);
  assert.deepEqual(actorDesdeUsuario({ ...usuario, nombreRolNormalizado: 'DESCONOCIDO' }).permisos, []);
  assert.throws(() => actorDesdeUsuario({ ...usuario, coincidenciasNombreRol: 2 }), /ambiguo/);
});

test('tres personas con TESORERIA_CXP siguen siendo distintas', () => {
  const one = actorDesdeUsuario(usuario);
  const two = actorDesdeUsuario({ ...usuario, idUsuario: 8 });
  const three = actorDesdeUsuario({ ...usuario, idUsuario: 9 });
  assert.throws(() => assertDistinctOperator({ programadoPor: one.id }, one, ['programadoPor'], 'Otra persona'), { status: 403 });
  assert.doesNotThrow(() => assertDistinctOperator({ programadoPor: one.id }, two, ['programadoPor'], 'Otra persona'));
  assert.throws(() => assertDistinctOperator({ programadoPor: one.id, ejecutadoPor: two.id }, two, ['programadoPor', 'ejecutadoPor'], 'Tercera persona'), { status: 403 });
  assert.doesNotThrow(() => assertDistinctOperator({ programadoPor: one.id, ejecutadoPor: two.id }, three, ['programadoPor', 'ejecutadoPor'], 'Tercera persona'));
});

test('sin actor o sin rol activo se deniega el proceso', () => {
  const nextErrors: unknown[] = [];
  const next = (error?: unknown) => { nextErrors.push(error); };
  exigirActor({} as never, { locals: {} } as never, next);
  exigirRolProceso({} as never, { locals: { cxpActor: { id: 8, roles: [], permisos: ['CREAR'] } } } as never, next);
  assert.deepEqual(nextErrors.map(error => (error as { status: number }).status), [401, 401]);
});
