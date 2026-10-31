import assert from 'node:assert/strict';
import test from 'node:test';
import type {Connection} from 'oracledb';
import {documentoTributoOpcionesWithConnection} from './documento.tributoOpciones';

test('reutiliza identificación histórica sin copiar importes y consulta reglas del tipo, fecha y moneda del documento',async()=>{
  const c={execute:async(sql:string,binds:Record<string,unknown>)=>{
    assert.match(sql.trim(),/^SELECT/);
    if(sql.includes('FROM CXP_DOCUMENTO_TRIBUTO')){assert.deepEqual(binds,{tipo:'FACTURA'});return{rows:[{TIPO:'RETENCION',CODIGO:'HIST',NOMBRE:'Nombre histórico'}]};}
    if(sql.includes('FROM CXP_REGLA_TRIBUTARIA')){assert.deepEqual(binds,{tipoDocumento:'FACTURA',fecha:'2026-10-30',moneda:'GTQ'});return{rows:[]};}
    if(sql.includes('FROM CXP_DOCUMENTO'))return{rows:[{ID_DOCUMENTO:1,TIPO_DOCUMENTO:'FACTURA',FECHA_DOCUMENTO:'2026-10-30',MONEDA:'GTQ'}]};
    throw Error(sql);
  }} as unknown as Connection;
  const result=await documentoTributoOpcionesWithConnection(c,1);
  assert.deepEqual(result,{identificaciones:[{tipo:'RETENCION',codigo:'HIST',nombre:'Nombre histórico',origen:'HISTORICO'}],reglas:[]});
});
