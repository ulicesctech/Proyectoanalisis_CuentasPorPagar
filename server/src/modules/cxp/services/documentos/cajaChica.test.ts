import assert from 'node:assert/strict';
import test from 'node:test';
import type { Connection } from 'oracledb';
import { applyCajaChicaFundOnApproval } from './documento.approval';

function fundConnection(balance: number, state = 'ACTIVO') {
  let current = balance;
  const connection = {
    async execute(sql: string, binds: Record<string, any>) {
      if (sql.includes('FROM CXP_COMPROMISO')) return { rows: [{
        ID_COMPROMISO: 1, TIPO_COMPROMISO: 'FONDO_CAJA_CHICA',
        ESTADO: state, MONEDA: 'GTQ', MONTO_TOTAL: 500, SALDO_CAPITAL: current,
      }] };
      if (sql.startsWith('UPDATE CXP_COMPROMISO')) {
        current = binds.v0.val;
        return { rowsAffected: 1 };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    },
  } as unknown as Connection;
  return { connection, balance: () => current };
}

const expense = {
  idCompromiso: 1, tipoDocumento: 'GASTO_CAJA_CHICA',
  moneda: 'GTQ', totalNeto: 125,
};

test('el gasto aprobado descuenta el fondo bajo bloqueo de fila', async () => {
  const fund = fundConnection(500);
  await applyCajaChicaFundOnApproval(fund.connection, expense);
  assert.equal(fund.balance(), 375);
});

test('la aprobación rechaza un gasto que supera el saldo actual', async () => {
  const fund = fundConnection(100);
  await assert.rejects(applyCajaChicaFundOnApproval(fund.connection, expense), { status: 409 });
  assert.equal(fund.balance(), 100);
});

test('un fondo suspendido no admite gastos aprobados', async () => {
  const fund = fundConnection(500, 'SUSPENDIDO');
  await assert.rejects(applyCajaChicaFundOnApproval(fund.connection, expense), { status: 409 });
  assert.equal(fund.balance(), 500);
});
