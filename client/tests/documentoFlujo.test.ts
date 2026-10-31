import assert from 'node:assert/strict';
import test from 'node:test';
import { getCxpEntity } from '@erp/contracts';
import { documentoProgress, documentoStage } from '../src/modules/cxp/documentos/documentoFlujo';

test('el indicador contempla todos los estados publicados del documento', () => {
  const states = getCxpEntity('documentos')!.fields.find(field => field.name === 'estado')!.options!;
  assert.deepEqual(Object.keys(documentoStage).sort(), [...states].sort());
});
test('documentos: pendiente, aprobación, pago parcial y completo mantienen su avance real', () => {
  assert.equal(documentoProgress('RECIBIDO').current, 0);
  assert.equal(documentoProgress('PENDIENTE_APROBACION').steps.filter(step => step.completed).length, 1);
  assert.equal(documentoProgress('APROBADA').current, 2);
  for (const state of ['PARCIALMENTE_PAGADA', 'PARCIALMENTE_APLICADA']) {
    const p = documentoProgress(state); assert.ok(p.partial); assert.ok(p.steps[3].active); assert.ok(!p.steps[3].completed);
  }
  for (const state of ['PAGADA', 'APLICADA', 'CERRADA']) assert.ok(documentoProgress(state).steps.every(step => step.completed));
});
test('rechazo, anulación, bloqueos y vencimiento no infieren avances exitosos', () => {
  for (const state of ['RECHAZADA', 'ANULADA', 'BLOQUEADA', 'VENCIDA', 'DESCONOCIDA']) {
    assert.ok(documentoProgress(state).steps.every(step => !step.completed && !step.active));
  }
});
