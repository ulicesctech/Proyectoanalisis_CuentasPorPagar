import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { BandejaProceso, EtapaProceso } from '@erp/contracts';
import { etapaActual, flowGuide, progresoFlujo } from '../src/modules/cxp/procesos/flujoPago';
import { ProcesoPagoFlow } from '../src/modules/cxp/procesos/ProcesoPagoFlow';

const lanes: BandejaProceso[] = ['contrasenas', 'autorizaciones', 'pagos', 'cheques'];
const render = (estado: EtapaProceso, bandeja: BandejaProceso = 'cheques') =>
  renderToStaticMarkup(createElement(ProcesoPagoFlow, {
    proceso: { estado, codigo: 'CP-PRUEBA' }, bandeja,
  }));

test('la guía tiene ocho pasos y convierte índices a números visibles una sola vez', () => {
  assert.equal(flowGuide.length, 8);
  assert.equal(flowGuide[5].label, 'Ejecución');
  assert.equal(flowGuide[6].label, 'Aplicación');
  assert.equal(flowGuide[7].label, 'Finalizado');
  assert.deepEqual(progresoFlujo({ estado: 'COBRADO' }, 'cheques').map(step => step.numero), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('todos los estados usan el avance del pago, independientemente de la bandeja abierta', () => {
  const expected: Record<EtapaProceso, number> = {
    EMITIDA: 2, EN_REVISION: 3, APROBADA: 4, PROGRAMADA: 5,
    CHEQUE_EMITIDO: 5, ENTREGADO: 6, COBRADO: 7, RECHAZADA: 3, ANULADA: 2,
  };
  for (const [estado, index] of Object.entries(expected)) {
    for (const bandeja of lanes) assert.equal(etapaActual({ estado: estado as EtapaProceso }, bandeja), index);
  }
});

test('generar y ejecutar no completan Finalizado antes de la confirmación', () => {
  for (const estado of ['CHEQUE_EMITIDO', 'ENTREGADO'] as const) {
    const steps = progresoFlujo({ estado }, 'cheques');
    assert.equal(steps[7].estado, 'pendiente');
    assert.equal(steps[7].actual, false);
    assert.doesNotMatch(render(estado), /8\. Finalizado: completado/);
  }
  const executed = progresoFlujo({ estado: 'ENTREGADO' }, 'cheques');
  assert.equal(executed[6].actual, true);
  assert.equal(executed[6].numero, 7);
});

test('la respuesta de confirmar completa el último paso inmediatamente', () => {
  const before = render('ENTREGADO');
  assert.match(before, /7\. Aplicación: actual/);
  const confirmationResponse = { estado: 'COBRADO' as const, codigo: 'CP-PRUEBA' };
  const after = renderToStaticMarkup(createElement(ProcesoPagoFlow, {
    proceso: confirmationResponse, bandeja: 'cheques',
  }));
  assert.match(after, /aria-current="step" aria-label="8\. Finalizado: completado"/);
  assert.equal((after.match(/data-step-state="completado"/g) ?? []).length, 8);
});

test('recargar y reabrir desde el JSON persistido conserva el último paso completado', () => {
  const response = { estado: 'COBRADO' as const, codigo: 'CP-PRUEBA' };
  const reloaded = JSON.parse(JSON.stringify(response));
  const reopened = renderToStaticMarkup(createElement(ProcesoPagoFlow, {
    proceso: reloaded, bandeja: 'contrasenas',
  }));
  assert.equal(reopened, render('COBRADO'));
  assert.ok(progresoFlujo(reloaded, 'contrasenas').every(step => step.estado === 'completado'));
});

test('sin pago seleccionado se indica la bandeja y no se inventan etapas completadas', () => {
  const steps = progresoFlujo(null, 'cheques');
  assert.equal(steps[5].actual, true);
  assert.equal(steps.filter(step => step.estado === 'completado').length, 0);
  for (const estado of ['RECHAZADA', 'ANULADA'] as const) {
    assert.equal(progresoFlujo({ estado }, 'cheques')[7].estado, 'pendiente');
  }
});
