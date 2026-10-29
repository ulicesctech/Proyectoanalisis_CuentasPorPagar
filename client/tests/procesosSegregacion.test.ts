import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProcesoPago } from '@erp/contracts';
import { impedimentoAprobacion, impedimentoCobro, impedimentoEntrega } from '../src/modules/cxp/procesos/segregacion';

function proceso(overrides: Partial<ProcesoPago> = {}): ProcesoPago {
  return {
    id: 50, codigo: 'CP-00000050', clave: 'k', version: 'v1', estado: 'EN_REVISION',
    creador: 1, proveedor: 2, sucursal: 3, moneda: 'GTQ', tipoCambio: 1, total: 100,
    formaPago: 1, formaPagoNombre: 'TRANSFERENCIA', documentos: [],
    aprobaciones: [
      { id: 1, regla: 9, nombre: 'Doble firma', nivel: 1, rol: 4, decision: 'PENDIENTE' },
      { id: 2, regla: 9, nombre: 'Doble firma', nivel: 1, rol: 4, decision: 'PENDIENTE' },
    ],
    historial: [], pago: 50, aplicaciones: [], reimpresiones: 0,
    ...overrides,
  };
}

const evento = (accion: string, usuario: number) => ({ fecha: '2026-10-23T10:00:00', usuario, nombre: '', accion, detalle: '' });

test('Aprobar/Rechazar requieren el rol de la regla, sin un ID predeterminado en código', () => {
  const p = proceso();
  assert.equal(impedimentoAprobacion(p, p.aprobaciones[0], { id: 5, roles: [p.aprobaciones[0].rol] }), null);
  assert.match(impedimentoAprobacion(p, p.aprobaciones[0], { id: 5, roles: [3] }) ?? '', /rol no coincide/);
  assert.ok(impedimentoAprobacion(p, p.aprobaciones[0], { id: 5, roles: [] }));
  assert.ok(impedimentoAprobacion(p, p.aprobaciones[0], null));
});

test('oculta Aprobar/Rechazar si el usuario ya decidió otra posición del proceso', () => {
  const p = proceso();
  p.aprobaciones[0] = { ...p.aprobaciones[0], decision: 'APROBADA', usuario: 5 };
  assert.ok(impedimentoAprobacion(p, p.aprobaciones[1], { id: 5, roles: [p.aprobaciones[1].rol] }));
  assert.equal(impedimentoAprobacion(p, p.aprobaciones[1], { id: 6, roles: [p.aprobaciones[1].rol] }), null);
});

test('oculta Entregar a quien programó y Cobrar a quien programó o ejecutó', () => {
  const p = proceso({ historial: [evento('PROGRAMAR', 10), evento('ENTREGAR', 11)] });
  assert.ok(impedimentoEntrega(p, { id: 10, roles: [3] }));
  assert.equal(impedimentoEntrega(p, { id: 11, roles: [3] }), null);
  assert.ok(impedimentoCobro(p, { id: 10, roles: [3] }));
  assert.ok(impedimentoCobro(p, { id: 11, roles: [3] }));
  assert.equal(impedimentoCobro(p, { id: 12, roles: [3] }), null);
});

test('usa la última programación del historial', () => {
  const p = proceso({ historial: [evento('PROGRAMAR', 10), evento('PROGRAMAR', 12)] });
  assert.equal(impedimentoEntrega(p, { id: 10, roles: [3] }), null);
  assert.ok(impedimentoEntrega(p, { id: 12, roles: [3] }));
});
