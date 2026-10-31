import assert from 'node:assert/strict';
import test from 'node:test';
import type {Connection} from 'oracledb';
import {proveedorIdentidadWithConnection} from './proveedor-identidad.service';

test('NIT compartido informa el conteo exacto aunque se limite la lista; no presupone unicidad',async()=>{
  const queries:Array<{sql:string;binds:unknown}>=[];
  const c={execute:async(sql:string,binds:unknown)=>{queries.push({sql,binds});return sql.includes('COUNT(*)')?{rows:[{TOTAL:23}]}:{rows:Array.from({length:21},(_,index)=>({ID:index+1,NIT:'ABC%_1',NOMBRE:`Proveedor ${index}`,ACTIVO:1}))};}} as unknown as Connection;
  const result=await proveedorIdentidadWithConnection(c,{nit:' abc%_1 '});
  assert.equal(result.coincidenciasExactas,23);assert.equal(result.proveedores.length,20);assert.equal(result.limitado,true);
  assert.match(queries[1].sql,/INSTR\(UPPER\(TRIM\(PRO_NIT\)\),:nit\)>0/);assert.deepEqual(queries[1].binds,{nit:'ABC%_1'});
});
test('la consulta por ID conserva proveedores sin NIT y no inventa dirección o CUI',async()=>{
  const c={execute:async()=>({rows:[{ID:7,NIT:null,NOMBRE:'Sin NIT',ACTIVO:1}]})} as unknown as Connection;
  assert.deepEqual((await proveedorIdentidadWithConnection(c,{id:'7'})).proveedores,[{idProveedor:7,nit:null,nombre:'Sin NIT',activo:true}]);
});
test('valida los límites e IDs antes de consultar',async()=>{
  const c={execute:async()=>{throw Error('No debe consultar');}} as unknown as Connection;
  assert.deepEqual((await proveedorIdentidadWithConnection(c,{nit:'A'})).proveedores,[]);
  await assert.rejects(proveedorIdentidadWithConnection(c,{id:'1 OR 1=1'}),/Proveedor inválido/);
  await assert.rejects(proveedorIdentidadWithConnection(c,{nit:'X'.repeat(21)}),/20 caracteres/);
});
