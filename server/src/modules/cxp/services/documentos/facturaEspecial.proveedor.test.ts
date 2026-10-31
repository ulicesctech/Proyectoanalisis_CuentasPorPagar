import assert from 'node:assert/strict';
import test from 'node:test';
import {validarNitProveedorFacturaEspecial as validate} from './facturaEspecial.service';

test('la API rechaza un NIT que no corresponde a una nueva selección de proveedor',()=>{
  assert.throws(()=>validate('123-1',{idProveedor:1,proveedorNit:'456-2'}),/identificación del proveedor/);
  assert.doesNotThrow(()=>validate('123-1',{idProveedor:1,proveedorNit:' 123-1 '}));
  assert.doesNotThrow(()=>validate(null,{idProveedor:1,proveedorNit:'NIT-CAPTURADO'}));
  assert.doesNotThrow(()=>validate('   ',{idProveedor:1,proveedorNit:'NIT-CAPTURADO'}));
});
test('preserva una instantánea histórica sin cambios aunque el maestro sea diferente',()=>{
  const previous={idProveedor:1,proveedorNit:'HISTORICO'};
  assert.doesNotThrow(()=>validate('NUEVO',{idProveedor:1,proveedorNit:'HISTORICO'},previous));
  assert.throws(()=>validate('NUEVO',{idProveedor:2,proveedorNit:'HISTORICO'},previous),/identificación/);
  assert.throws(()=>validate('NUEVO',{idProveedor:1,proveedorNit:'OTRO'},previous),/identificación/);
});
