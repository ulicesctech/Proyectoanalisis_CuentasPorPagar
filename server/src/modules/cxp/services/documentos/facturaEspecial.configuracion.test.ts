import assert from 'node:assert/strict';
import test from 'node:test';
import type { Connection } from 'oracledb';
import { facturaEspecialConfiguracionWithConnection } from './facturaEspecial.configuracion';

function database(params: object[], max=0) {
  return {execute:async(sql:string)=> {
    if(sql.includes('FROM CXP_PARAMETRO'))return{rows:params};
    if(sql.includes('MAXIMO'))return{rows:[{MAXIMO:max}]};
    if(sql.includes('FROM CXP_REGLA_TRIBUTARIA'))return{rows:[]};
    throw Error('Consulta inesperada: '+sql);
  }} as unknown as Connection;
}
const parameter=(code:string,text:string|null,value:number|null)=>({GRUPO_PARAMETRO:'CXP_FACTURA_ESPECIAL',CODIGO:code,VALOR_TEXTO:text,VALOR_NUMERO:value,ACTIVO:'S'});
test('serie y correlativo ausentes son impedimentos tempranos; no se intenta escribir', async()=>{
  const result=await facturaEspecialConfiguracionWithConnection(database([]),'2026-10-30','GTQ');
  assert.equal(result.puedeRegistrar,false);assert.ok(result.impedimentos.some(m=>m.includes('SERIE')));assert.ok(result.impedimentos.some(m=>m.includes('CORRELATIVO_FACTURA')));
});
test('sin tributos permite preparación con numeración válida, advirtiendo revisión y emisión',async()=>{
  const result=await facturaEspecialConfiguracionWithConnection(database([parameter('SERIE','FESP',null),parameter('CORRELATIVO_FACTURA',null,5)]),'2026-10-30','GTQ');
  assert.equal(result.puedeRegistrar,true);assert.equal(result.reglasVigentes,0);assert.ok(result.advertencias.some(m=>m.includes('preparación')));
});
test('rechaza correlativo atrasado o parámetros duplicados sin sobrescribirlos',async()=>{
  const params=[parameter('SERIE','FESP',null),parameter('CORRELATIVO_FACTURA',null,2)];
  assert.equal((await facturaEspecialConfiguracionWithConnection(database(params,3),'2026-10-30','GTQ')).puedeRegistrar,false);
  assert.equal((await facturaEspecialConfiguracionWithConnection(database([...params,params[0]]),'2026-10-30','GTQ')).puedeRegistrar,false);
});
