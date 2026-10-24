import assert from 'node:assert/strict';
import test from 'node:test';
import type { Connection } from 'oracledb';
import { requireOpenPaymentPeriod } from './proceso.repository';

type PeriodRow = { ID_PERIODO: number; ESTADO: string };

function connectionWith(covering: PeriodRow[], branchPeriods: PeriodRow[] = covering) {
  const calls: Array<{ sql: string; binds: Record<string, unknown> }> = [];
  const connection = {
    async execute(sql: string, binds: Record<string, unknown>) {
      calls.push({ sql, binds });
      return { rows: calls.length === 1 ? covering : branchPeriods };
    },
  } as unknown as Connection;
  return { connection, calls };
}

test('reconoce un período abierto de la sucursal y fecha del documento', async () => {
  const { connection, calls } = connectionWith([{ ID_PERIODO: 21, ESTADO: 'ABIERTO' }]);
  await requireOpenPaymentPeriod(connection, 1, '2026-10-23');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].binds, { branch: 1, day: '2026-10-23' });
  assert.match(calls[0].sql, /ID_SUCURSAL = :branch/);
  assert.match(calls[0].sql, /FECHA_INICIO <= TO_DATE\(:day/);
  assert.match(calls[0].sql, /FECHA_FIN >= TO_DATE\(:day/);
  assert.match(calls[0].sql, /FOR UPDATE/);

  await requireOpenPaymentPeriod(
    connectionWith([{ ID_PERIODO: 21, ESTADO: 'REABIERTO' }]).connection,
    1, '2026-10-23',
  );
});

test('informa los dos períodos abiertos que se superponen para documento #133 el 23/10', async () => {
  const { connection } = connectionWith([
    { ID_PERIODO: 21, ESTADO: 'ABIERTO' },
    { ID_PERIODO: 4, ESTADO: 'ABIERTO' },
  ]);
  await assert.rejects(requireOpenPaymentPeriod(connection, 1, '2026-10-23'), {
    status: 409,
    message: 'Hay 2 períodos superpuestos para la sucursal #1 y la fecha prevista de pago 2026-10-23 (IDs #4, #21). Debe haber exactamente uno.',
  });
});

test('rechaza otra sucursal y distingue un período existente fuera de rango', async () => {
  const otherBranch = connectionWith([]);
  await assert.rejects(requireOpenPaymentPeriod(otherBranch.connection, 2, '2026-10-23'), {
    status: 409, message: 'No existe un período para la sucursal #2.',
  });
  assert.deepEqual(otherBranch.calls.map(call => call.binds), [
    { branch: 2, day: '2026-10-23' }, { branch: 2 },
  ]);

  const outOfRange = connectionWith([], [{ ID_PERIODO: 21, ESTADO: 'ABIERTO' }]);
  await assert.rejects(requireOpenPaymentPeriod(outOfRange.connection, 1, '2027-01-01'), {
    status: 409,
    message: 'Los períodos de la sucursal #1 no cubren la fecha prevista de pago 2027-01-01.',
  });
});

test('distingue estado no permitido y error al consultar', async () => {
  const closed = connectionWith([{ ID_PERIODO: 21, ESTADO: 'CERRADO' }]);
  await assert.rejects(requireOpenPaymentPeriod(closed.connection, 1, '2026-10-23'), {
    status: 409,
    message: 'El período #21 de la sucursal #1 está en estado CERRADO; debe estar ABIERTO o REABIERTO.',
  });

  const broken = { execute: async () => { throw new Error('ORA-03113'); } } as unknown as Connection;
  await assert.rejects(requireOpenPaymentPeriod(broken, 1, '2026-10-23'), {
    status: 503,
    message: 'No se pudo consultar el período de la sucursal. Intenta nuevamente.',
  });
});
