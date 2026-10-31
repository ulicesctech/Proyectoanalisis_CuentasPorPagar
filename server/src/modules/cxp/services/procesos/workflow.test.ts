import assert from 'node:assert/strict';
import test from 'node:test';

import type { ActorProceso, CxpRecord, ProcesoPago } from '@erp/contracts';
import { assertApprovalSegregation, assertDistinctOperator, createPaymentWorkflow, eligible } from './workflow';
import type { ProcesoStore, ProcesoTx } from './ports';

const actor = (id: number, roles: number[]): ActorProceso => ({
  id, nombre: `Usuario ${id}`, roles, permisos: ['CREAR', 'APROBAR', 'TESORERIA', 'ANULAR'],
});

function storeFor(tx: ProcesoTx): ProcesoStore {
  return {
    transaction: async <T>(fn: (value: ProcesoTx) => Promise<T>) => fn(tx),
    list: async () => ({ data: [], page: 1, hasMore: false }),
    options: async () => ({ documentos: [], origenes: [], destinos: [], formasPago: [], bancosConfigurados: false }),
  } as ProcesoStore;
}

function reviewProcess(): ProcesoPago {
  return {
    id: 50, codigo: 'CP-00000050', clave: 'k', version: 'v1', estado: 'EN_REVISION',
    creador: 1, solicitante: 1, proveedor: 2, sucursal: 3, moneda: 'GTQ', tipoCambio: 1, total: 100,
    formaPago: 1, formaPagoNombre: 'TRANSFERENCIA', documentos: [{ id: 7, numero: 'F-7', importe: 100 }],
    aprobaciones: [
      { id: 1, regla: 9, nombre: 'Doble firma', nivel: 1, rol: 4, decision: 'PENDIENTE' },
      { id: 2, regla: 9, nombre: 'Doble firma', nivel: 1, rol: 4, decision: 'PENDIENTE' },
    ],
    historial: [], pago: 50, aplicaciones: [], reimpresiones: 0,
  };
}

test('crear contraseña deriva sucursal, moneda y saldo del servidor y reserva dentro de la transacción', async () => {
  const doc: CxpRecord = { idDocumento: 91, idProveedor: 8, idSucursal: 3, moneda: 'USD', tipoCambio: 7.5,
    naturaleza: 'D', estado: 'APROBADA', posibleDuplicado: 'N', saldoPendiente: 123.45, tipoDocumento: 'FACTURA', numeroDocumento: 'F-91' };
  const trace: string[] = [];
  let saved: ProcesoPago;
  let reserveFails = false;
  const tx = {
    actorExists: async()=>{}, byKey: async()=>null, providerName: async()=> 'Proveedor servidor',
    row: async(resource: string,id: number)=>resource==='documentos' ? doc : {tipoTitular:id===1?'EMPRESA':'PROVEEDOR',idProveedor:8,estado:'ACTIVA',estadoAprobacion:'APROBADA',moneda:'USD'},
    openPeriod: async(branch: number)=> {assert.equal(branch,3);trace.push('periodo');},
    paymentMethod: async()=>({id:1,nombre:'Transferencia',tipo:'TRANSFERENCIA'}),
    insert: async(p: ProcesoPago)=> {saved=p;trace.push('insert');return 10;},
    reserve: async(p: ProcesoPago)=>{assert.equal(p.documentos[0].importe,123.45);trace.push('reserve');if(reserveFails)throw new Error('Reserva concurrente');},
    save:async()=>{trace.push('save');}, get:async()=>saved,
  } as unknown as ProcesoTx;
  const store=storeFor(tx);
  store.transaction=async fn=>{trace.push('begin');try{const p=await fn(tx);trace.push('commit');return p;}catch(e){trace.push('rollback');throw e;}};
  const workflow=createPaymentWorkflow(store,()=>new Date('2026-10-30T12:00:00Z'));
  const input={idProveedor:8,documentos:[91],idCuentaOrigen:1,idCuentaDestino:2,idFormaPago:1,fecha:'2026-10-30',clave:'d2fcde64-787b-44a1-9836-bc4e5340b07a'};
  const p=await workflow.create(input,actor(7,[1]));
  assert.equal(p.sucursal,3);assert.equal(p.moneda,'USD');assert.equal(p.tipoCambio,7.5);assert.equal(p.total,123.45);
  assert.deepEqual(trace,['begin','periodo','insert','reserve','save','commit']);
  trace.length=0;reserveFails=true;
  await assert.rejects(workflow.create(input,actor(7,[1])),/Reserva concurrente/);
  assert.deepEqual(trace,['begin','periodo','insert','reserve','rollback']);
  trace.length=0;doc.estado='RECIBIDO';
  await assert.rejects(workflow.create(input,actor(7,[1])),{status:409});
  assert.deepEqual(trace,['begin','rollback']);
});

test('RF10: APROBAR también exige el rol de la posición creada por la regla', () => {
  const process = reviewProcess();
  assert.throws(() => assertApprovalSegregation(process, process.aprobaciones[0], actor(5, [8])), { status: 403 });
  assert.throws(() => assertApprovalSegregation(process, process.aprobaciones[0], actor(5, [])), { status: 403 });
  assert.doesNotThrow(() => assertApprovalSegregation(process, process.aprobaciones[0], actor(5, [4])));
});

test('RF10: un usuario no ocupa dos posiciones de aprobación del mismo proceso', () => {
  const process = reviewProcess();
  process.aprobaciones[0] = { ...process.aprobaciones[0], decision: 'APROBADA', usuario: 5 };
  assert.throws(() => assertApprovalSegregation(process, process.aprobaciones[1], actor(5, [4])), { status: 403 });
  assert.doesNotThrow(() => assertApprovalSegregation(process, process.aprobaciones[1], actor(6, [4])));
});

test('RF10: las posiciones canceladas no cuentan como decisión del usuario', () => {
  const process = reviewProcess();
  process.aprobaciones[0] = { ...process.aprobaciones[0], decision: 'CANCELADA', usuario: 5 };
  assert.doesNotThrow(() => assertApprovalSegregation(process, process.aprobaciones[1], actor(5, [4])));
});

test('tesorería: quien programa no ejecuta y quien ejecuta no concilia', () => {
  const payment: CxpRecord = { idPago: 50, programadoPor: 10, ejecutadoPor: 11 };
  assert.throws(() => assertDistinctOperator(payment, actor(10, []), ['programadoPor'], 'x'), { status: 403 });
  assert.doesNotThrow(() => assertDistinctOperator(payment, actor(11, []), ['programadoPor'], 'x'));
  assert.throws(() => assertDistinctOperator(payment, actor(11, []), ['programadoPor', 'ejecutadoPor'], 'x'), { status: 403 });
  assert.throws(() => assertDistinctOperator(payment, actor(10, []), ['programadoPor', 'ejecutadoPor'], 'x'), { status: 403 });
  assert.doesNotThrow(() => assertDistinctOperator(payment, actor(12, []), ['programadoPor', 'ejecutadoPor'], 'x'));
});

test('aprobar una segunda posición del mismo proceso no escribe la decisión', async () => {
  const process = reviewProcess();
  process.aprobaciones[0] = { ...process.aprobaciones[0], decision: 'APROBADA', usuario: 5 };
  const updates: unknown[] = [];
  const tx = {
    actorExists: async () => {},
    get: async () => process,
    row: async () => ({}),
    openPeriod: async () => {},
    update: async (...args: unknown[]) => { updates.push(args); },
  } as unknown as ProcesoTx;
  const workflow = createPaymentWorkflow(storeFor(tx), () => new Date('2026-10-23T12:00:00Z'));
  await assert.rejects(workflow.act(50, { accion: 'aprobar', version: 'v1', idAprobacion: 2 }, actor(5, [4])), { status: 403 });
  assert.equal(updates.length, 0);
});

test('la capacidad APROBAR no permite decidir una regla de otro rol ni escribe la decisión', async () => {
  const process = reviewProcess();
  const updates: unknown[] = [];
  const tx = {
    actorExists: async () => {},
    get: async () => process,
    row: async () => ({}),
    openPeriod: async () => {},
    update: async (...args: unknown[]) => { updates.push(args); },
  } as unknown as ProcesoTx;
  const workflow = createPaymentWorkflow(storeFor(tx), () => new Date('2026-10-23T12:00:00Z'));
  const aprobadorDeOtroRol = { ...actor(5, [8]), permisos: ['APROBAR'] as ActorProceso['permisos'] };
  for (const accion of [
    { accion: 'aprobar', version: 'v1', idAprobacion: 1 },
    { accion: 'rechazar', version: 'v1', idAprobacion: 1, motivo: 'Motivo suficiente' },
  ]) {
    await assert.rejects(workflow.act(50, accion, aprobadorDeOtroRol), /rol no coincide/);
  }
  assert.equal(updates.length, 0);
});

test('confirmar el cobro lo rechaza si lo intenta quien ejecutó el pago, antes de tocar Bancos', async () => {
  const process: ProcesoPago = {
    ...reviewProcess(), estado: 'ENTREGADO',
    aprobaciones: [], transferencia: { id: 'T-1' } as ProcesoPago['transferencia'],
  };
  let bankCalls = 0;
  const tx = {
    actorExists: async () => {},
    get: async () => process,
    row: async (resource: string) => resource === 'pagos' ? { idPago: 50, programadoPor: 10, ejecutadoPor: 11 } : {},
    openPeriod: async () => {},
    bankAdvance: async () => { bankCalls += 1; return {}; },
  } as unknown as ProcesoTx;
  const workflow = createPaymentWorkflow(storeFor(tx), () => new Date('2026-10-23T12:00:00Z'));
  await assert.rejects(workflow.act(50, { accion: 'cobrar', version: 'v1' }, actor(11, [])), { status: 403 });
  assert.equal(bankCalls, 0);
});


test('el proceso no reserva facturas especiales aprobadas antes de emitirlas', () => {
  const document: CxpRecord = {
    idDocumento: 1, idProveedor: 2, idSucursal: 3, moneda: 'GTQ',
    naturaleza: 'D', estado: 'APROBADA', posibleDuplicado: 'N',
    saldoPendiente: 100, tipoDocumento: 'FACTURA_ESPECIAL',
  };
  assert.throws(() => eligible([document]), {
    status: 409, message: 'La factura especial debe emitirse antes de iniciar un proceso de pago',
  });
  assert.equal(eligible([{ ...document, estado: 'PENDIENTE_PAGO' }]).idDocumento, 1);
  assert.equal(eligible([{ ...document, tipoDocumento: 'FACTURA' }]).idDocumento, 1);
});

test('el proceso ordinario no reserva gastos de caja chica', () => {
  const document: CxpRecord = {
    idDocumento: 11, idProveedor: 2, idSucursal: 3, moneda: 'GTQ',
    naturaleza: 'D', estado: 'APROBADA', posibleDuplicado: 'N',
    saldoPendiente: 125, tipoDocumento: 'GASTO_CAJA_CHICA',
  };
  assert.throws(() => eligible([document]), { status: 409 });
  assert.equal(eligible([{ ...document, tipoDocumento: 'FACTURA' }]).idDocumento, 11);
});

test('valida el período con la sucursal persistida del documento y la fecha prevista del pago', async () => {
  const document: CxpRecord = {
    idDocumento: 133, idProveedor: 32, idSucursal: 1, moneda: 'GTQ',
    naturaleza: 'D', estado: 'APROBADA', posibleDuplicado: 'N',
    saldoPendiente: 100, tipoDocumento: 'FACTURA',
  };
  const checked: Array<{ branch: number; date: string }> = [];
  const stop = new Error('fin de la prueba tras comprobar el período');
  const tx = {
    actorExists: async () => {},
    byKey: async () => null,
    row: async () => document,
    openPeriod: async (branch: number, date: string) => {
      checked.push({ branch, date });
      throw stop;
    },
  } as unknown as ProcesoTx;
  const store = {
    transaction: async <T>(fn: (value: ProcesoTx) => Promise<T>) => fn(tx),
    list: async () => ({ data: [], page: 1, hasMore: false }),
    options: async () => ({ documentos: [], origenes: [], destinos: [], formasPago: [], bancosConfigurados: false }),
  } as ProcesoStore;
  const workflow = createPaymentWorkflow(store, () => new Date('2026-10-23T12:00:00Z'));

  await assert.rejects(workflow.create({
    idProveedor: 32, documentos: [133], idCuentaOrigen: 1, idCuentaDestino: 2,
    idFormaPago: 1, fecha: '2026-10-23', clave: 'd2fcde64-787b-44a1-9836-bc4e5340b07a',
  }, { id: 1, nombre: 'Operador', roles: [], permisos: ['CREAR'] }), error => error === stop);
  assert.deepEqual(checked, [{ branch: 1, date: '2026-10-23' }]);
});
