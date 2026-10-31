import assert from 'node:assert/strict';
import test from 'node:test';
import {draftFingerprint} from '../src/modules/cxp/components/draftFingerprint';

test('la comparación detecta cambios de conceptos y deja de marcarlos al deshacer, sin depender de referencias',()=>{
  const saved={lineas:[{clave:'1',datos:{cantidad:1,descripcion:'Original'}}],tributos:[]};
  const baseline=draftFingerprint(saved);
  const copy=JSON.parse(JSON.stringify(saved));assert.equal(draftFingerprint(copy),baseline);
  copy.lineas[0].datos.cantidad=2;assert.notEqual(draftFingerprint(copy),baseline);
  copy.lineas[0].datos.cantidad=1;assert.equal(draftFingerprint(copy),baseline);
  assert.equal(draftFingerprint({tributos:[],lineas:[{datos:{descripcion:'Original',cantidad:1},clave:'1'}]}),baseline);
});
