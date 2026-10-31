import assert from 'node:assert/strict';
import test from 'node:test';
import type {Connection} from 'oracledb';
import type {ActorProceso,CxpRecord} from '@erp/contracts';
import {adminPermisos,protegerCrudAdministrativo,adminVersion} from './politica';
import {cierreConciliacionIssues,conciliacionSnapshot,cerrarConciliacion} from './conciliacion.service';
import {periodoConsulta} from './diagnosticos.service';
import {adminActionWithConnection,adminUpdateConfigWithConnection} from './operaciones.service';
import {createCxpRepository} from '../../repositories/crud.repository';

const actor=(id:number,permission:ActorProceso['permisos'][number]):ActorProceso=>({id,nombre:'Persona de prueba',roles:[91],permisos:[permission]});
const header:CxpRecord={saldoEmpresa:300,saldoProveedor:300};
const lines:CxpRecord[]=[100,200].map((monto,index)=>({idDetConciliacion:index+1,montoEmpresa:monto,montoProveedor:monto,fechaEmpresa:'2026-10-30',fechaProveedor:'2026-10-30',resultado:'COINCIDE'}));
test('APROBADOR recibe permisos adicionales administrativos sin tesorería ni anulación',()=>{
  const rights=adminPermisos(actor(83,'APROBAR'));assert.equal(rights.configuracion,true);assert.equal(rights.periodos,true);assert.equal(rights.decidirCuenta,true);assert.equal(rights.elaborarConciliacion,false);assert.equal(rights.registrarCuenta,false);
  assert.equal(adminPermisos(actor(83,'TESORERIA')).configuracion,false);assert.equal(adminPermisos(actor(83,'CREAR')).cerrarConciliacion,false);assert.equal(adminPermisos(null).periodos,false);
});
test('el cierre estricto admite detalles coincidentes y saldo total cero con precisión monetaria',()=>{
  assert.deepEqual(cierreConciliacionIssues(header,lines),[]);
  assert.deepEqual(cierreConciliacionIssues({saldoEmpresa:.3,saldoProveedor:.3},[.1,.2].map((amount,index)=>({...lines[index],montoEmpresa:amount,montoProveedor:amount}))),[]);
});
test('rechaza diferencia total, ausencia de detalles y detalle pendiente aunque los importes coincidan',()=>{
  assert.ok(cierreConciliacionIssues({...header,saldoProveedor:299},lines).some(s=>s.includes('total')));
  assert.ok(cierreConciliacionIssues({saldoEmpresa:0,saldoProveedor:0},[]).some(s=>s.includes('no tiene detalles')));
  assert.ok(cierreConciliacionIssues(header,[{...lines[0],resultado:'EN_REVISION'},lines[1]]).some(s=>s.includes('requiere revisión')));
});
test('diferencias individuales compensadas no permiten cerrar ni siquiera con estado COINCIDE',()=>{
  const changed=[{...lines[0],montoProveedor:90},{...lines[1],montoProveedor:210}];
  const issues=cierreConciliacionIssues(header,changed);assert.equal(issues.filter(s=>s.includes('no se compensan')).length,2);
});
test('fechas distintas o faltantes impiden cerrar',()=>{
  assert.ok(cierreConciliacionIssues(header,[{...lines[0],fechaProveedor:null},lines[1]]).some(s=>s.includes('fechas')));
});
test('la consulta de período detecta superposición incluso entre abierto y cerrado, sin escribir',async()=>{
  const c={execute:async(sql:string)=>{assert.doesNotMatch(sql,/FOR UPDATE|UPDATE |INSERT/);return{rows:[{ID_PERIODO:1,ESTADO:'ABIERTO',DESDE:'2026-10-01',HASTA:'2026-10-31'},{ID_PERIODO:2,ESTADO:'CERRADO',DESDE:'2026-10-31',HASTA:'2026-11-30'}]};}} as unknown as Connection;
  const result=await periodoConsulta(c,{idSucursal:1,fecha:'2026-10-31'});assert.equal(result.disponible,false);assert.match(result.motivo,/2 períodos superpuestos/);
});
function fixture(role:string,id:number){
  let writes=0;
  const c={execute:async(sql:string)=>{
    if(/^(UPDATE|INSERT|DELETE)/.test(sql.trim())){writes++;throw Error('No debe escribir');}
    if(sql.includes('FROM USUARIO U'))return{rows:[{ID:id,NOMBRE:'Prueba',ID_ROL:91,ROL_ACTIVO:1,NOMBRE_ROL_NORMALIZADO:role,COINCIDENCIAS_NOMBRE_ROL:1}]};
    if(sql.includes('FROM CXP_CONCILIACION_PROVEEDOR'))return{rows:[{ID_CONCILIACION_PROV:1,ID_PROVEEDOR:1,ESTADO:'CONCILIADA',SALDO_EMPRESA:100,SALDO_PROVEEDOR:100,DIFERENCIA:0,ELABORADA_POR:id}]};
    if(sql.includes('FROM CXP_CONCILIACION_PROV_DET'))return{rows:[{ID_DET_CONCILIACION:1,ID_CONCILIACION_PROV:1,MONTO_EMPRESA:100,MONTO_PROVEEDOR:100,FECHA_EMPRESA:'2026-10-30',FECHA_PROVEEDOR:'2026-10-30',RESULTADO:'COINCIDE'}]};
    if(sql.includes('FROM CXP_EVENTO'))return{rows:[{RESULTADO_JSON:'{"moneda":"GTQ"}'}]};
    if(sql.includes('FROM CXP_CUENTA_BANCARIA'))return{rows:[{ID_CUENTA_BANCARIA:1,CREADO_POR:id,ESTADO:'ACTIVA',ESTADO_APROBACION:'PENDIENTE'}]};
    throw Error(sql);
  }} as unknown as Connection;
  return{c,writes:()=>writes};
}
test('el elaborador no puede cerrar su conciliación ni con una observación',async()=>{
  const {c,writes}=fixture('TESORERIA_CXP',73),snapshot=await conciliacionSnapshot(c,1);
  await assert.rejects(cerrarConciliacion(c,1,{version:snapshot.version,observaciones:'No omite segregación'},actor(73,'TESORERIA')),/Quien elaboró/);assert.equal(writes(),0);
});
test('un creador de cuenta no puede aprobarla y un operador no administra configuración',async()=>{
  const f=fixture('APROBADOR_CXP',72),record=(await createCxpRepository('cuentas-bancarias').bind(f.c).findById(1))!;
  await assert.rejects(adminActionWithConnection(f.c,'cuentas-bancarias',1,'aprobar',{version:adminVersion(record),titularCoincide:true},actor(72,'APROBAR')),/No puedes aprobar/);assert.equal(f.writes(),0);
  const other=fixture('OPERADOR_CXP',71);await assert.rejects(adminUpdateConfigWithConnection(other.c,'parametros',1,{version:'x',cambios:{valorTexto:'otro'}},actor(71,'CREAR')),/rol activo/);assert.equal(other.writes(),0);
});
test('el CRUD HTTP no permite eludir operaciones administrativas mediante estados o saldos',()=>{
  let error:unknown;protegerCrudAdministrativo({method:'PATCH'} as any,{} as any,(reason:unknown)=>{error=reason;});assert.match((error as Error).message,/acciones de la vista administrativa/);
  let allowed=false;protegerCrudAdministrativo({method:'GET'} as any,{} as any,()=>{allowed=true;});assert.equal(allowed,true);
});
