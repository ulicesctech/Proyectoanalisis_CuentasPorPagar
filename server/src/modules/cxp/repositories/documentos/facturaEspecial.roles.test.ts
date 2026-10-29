import assert from 'node:assert/strict';
import test from 'node:test';
import type { Connection } from 'oracledb';
import { facturaEspecialTx } from './facturaEspecial.repository';

const valid = {
  ID_ROL_CONFIG: 73, TEXTO_CONFIG: null, NOMBRE_ROL_CONFIG: 'Aprobador CXP', ACTIVO_ROL_CONFIG: 1,
  ID_ROL_USUARIO: 73, ACTIVO_USUARIO: 1, ACTIVO_ROL_USUARIO: 1,
};
type RoleRow = Omit<typeof valid, 'TEXTO_CONFIG' | 'NOMBRE_ROL_CONFIG'> & {
  TEXTO_CONFIG: string | null; NOMBRE_ROL_CONFIG: string | null;
};

function repository(rows: RoleRow[], matchingNames = 1) {
  const queries: string[] = [];
  const usuariosConsultados: number[] = [];
  const connection = {
    async execute(sql: string, binds: { idUsuario?: number } = {}) {
      queries.push(sql);
      if (sql.includes('FROM CXP_PARAMETRO P')) {
        usuariosConsultados.push(Number(binds.idUsuario));
        return { rows };
      }
      if (sql.includes('COUNT(*) AS TOTAL FROM ROL')) return { rows: [{ TOTAL: matchingNames }] };
      throw new Error(`Consulta inesperada: ${sql}`);
    },
  } as unknown as Connection;
  return { tx: facturaEspecialTx(connection), queries, usuariosConsultados };
}

test('factura especial autoriza a varios usuarios del mismo rol sin parámetros por persona', async () => {
  const { tx, queries, usuariosConsultados } = repository([valid]);
  assert.deepEqual(await tx.aprobadorAutorizado(851), { idRol: 73 });
  assert.deepEqual(await tx.aprobadorAutorizado(852), { idRol: 73 });
  assert.deepEqual(usuariosConsultados, [851, 852]);
  assert.match(queries[0], /U\.USU_ID_USUARIO = :idUsuario/);
  assert.match(queries[0], /CXP_FE_APROBADOR_ROL/);
  assert.doesNotMatch(queries[0], /VALOR_NUMERO = :idUsuario/);
  assert.match(queries[1], /REGEXP_REPLACE\(UPPER\(ROL_NOMBRE_ROL\)/);
});

test('factura especial rechaza un usuario con otro rol o con rol inactivo', async () => {
  assert.equal(await repository([{ ...valid, ID_ROL_USUARIO: 74 }]).tx.aprobadorAutorizado(851), null);
  assert.equal(await repository([{ ...valid, ACTIVO_USUARIO: 0 }]).tx.aprobadorAutorizado(851), null);
  assert.equal(await repository([{ ...valid, ACTIVO_ROL_USUARIO: 0 }]).tx.aprobadorAutorizado(851), null);
});

test('factura especial falla con configuración ausente, inválida o nombres ambiguos', async () => {
  await assert.rejects(repository([]).tx.aprobadorAutorizado(851), /exactamente un parámetro activo/);
  await assert.rejects(repository([valid, valid]).tx.aprobadorAutorizado(851), /exactamente un parámetro activo/);
  await assert.rejects(repository([{ ...valid, TEXTO_CONFIG: '73' }]).tx.aprobadorAutorizado(851), /solo el ID/);
  await assert.rejects(repository([{ ...valid, ACTIVO_ROL_CONFIG: 0 }]).tx.aprobadorAutorizado(851), /rol activo/);
  await assert.rejects(repository([{ ...valid, NOMBRE_ROL_CONFIG: '  ' }]).tx.aprobadorAutorizado(851), /ROL_NOMBRE_ROL válido/);
  await assert.rejects(repository([valid], 2).tx.aprobadorAutorizado(851), /ambiguo/);
});
