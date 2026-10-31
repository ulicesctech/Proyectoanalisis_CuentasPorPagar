import oracledb,{type Connection} from 'oracledb';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {cxpDate,cxpNumber,cxpMoneySum,cxpNow,type ActorProceso,type CxpRecord} from '@erp/contracts';
import {createCxpRepository,mapRow,options,selection} from '../../repositories/crud.repository';
import {CxpError} from '../errors';
import {exigirAdmin} from './politica';
import {adminAudit} from './operaciones.service';
import {conciliacionConsulta,conciliacionConsultaSchema} from './diagnosticos.service';

const obj={outFormat:oracledb.OUT_FORMAT_OBJECT},money=cxpNumber({precision:18,scale:2});
const headerRepo=(c:Connection)=>createCxpRepository('conciliaciones-proveedor').bind(c);
const linesRepo=(c:Connection)=>createCxpRepository('conciliaciones-proveedor-detalle').bind(c);
export function cierreConciliacionIssues(header:CxpRecord,lines:CxpRecord[]):string[]{
  const issues:string[]=[];
  if(!lines.length)issues.push('La conciliación no tiene detalles.');
  if(cxpMoneySum(Number(header.saldoEmpresa),-Number(header.saldoProveedor))!==0)issues.push('La diferencia total entre saldo de empresa y proveedor debe ser cero.');
  for(const line of lines){
    const prefix=`Detalle #${line.idDetConciliacion}`;
    if(line.resultado!=='COINCIDE')issues.push(`${prefix}: ${String(line.resultado).replace(/_/g,' ')}; requiere revisión.`);
    if(line.montoEmpresa==null||line.montoProveedor==null||cxpMoneySum(Number(line.montoEmpresa),-Number(line.montoProveedor))!==0)issues.push(`${prefix}: los importes individuales no coinciden; no se compensan diferencias entre detalles.`);
    if(!line.fechaEmpresa||!line.fechaProveedor||String(line.fechaEmpresa).slice(0,10)!==String(line.fechaProveedor).slice(0,10))issues.push(`${prefix}: falta una fecha o sus fechas no coinciden.`);
  }
  if(lines.length&&cxpMoneySum(...lines.map(line=>Number(line.montoEmpresa??0)))!==Number(header.saldoEmpresa))issues.push('El saldo de empresa no concuerda con la suma de detalles.');
  if(lines.length&&cxpMoneySum(...lines.map(line=>Number(line.montoProveedor??0)))!==Number(header.saldoProveedor))issues.push('El saldo declarado por el proveedor no concuerda con la suma de detalles.');
  return issues;
}
export async function conciliacionSnapshot(c:Connection,id:number,lock=false){
  if(!Number.isSafeInteger(id)||id<1)throw new CxpError('Conciliación inválida',400);
  const header=await headerRepo(c).findById(id,lock);if(!header)throw new CxpError('Conciliación no encontrada',404);
  const result=await c.execute<Record<string,string|number|null>>(`SELECT ${selection('conciliaciones-proveedor-detalle')} FROM CXP_CONCILIACION_PROV_DET WHERE ID_CONCILIACION_PROV=:id ORDER BY ID_DET_CONCILIACION ${lock?'FOR UPDATE':''}`,{id},options('conciliaciones-proveedor-detalle'));
  const lines=(result.rows??[]).map(row=>mapRow('conciliaciones-proveedor-detalle',row));
  const event=await c.execute<{RESULTADO_JSON:string}>(`SELECT RESULTADO_JSON FROM CXP_EVENTO WHERE ID_EVENTO=(SELECT MIN(ID_EVENTO) FROM CXP_EVENTO WHERE ID_CONCILIACION_PROV=:id AND TIPO_EVENTO='ADMIN_CONCILIACION_PREPARADA')`,{id},{...obj,fetchInfo:{RESULTADO_JSON:{type:oracledb.STRING}}});
  let moneda:string|null=null;try{moneda=JSON.parse(event.rows?.[0]?.RESULTADO_JSON??'{}').moneda??null;}catch{/* No se inventa el alcance de registros anteriores. */}
  const version=createHash('sha256').update(JSON.stringify({header,lines,moneda})).digest('hex');return{header,lines,moneda,version,impedimentos:cierreConciliacionIssues(header,lines)};
}
function currentVersion(snapshot:Awaited<ReturnType<typeof conciliacionSnapshot>>,version:string){if(snapshot.version!==version)throw new CxpError('La conciliación o sus detalles cambiaron. Recarga antes de confirmar; se conserva la captura.',409);if(snapshot.header.estado==='CERRADA')throw new CxpError('La conciliación ya está cerrada y se conserva como historial.',409);}
export async function prepararConciliacion(c:Connection,raw:unknown,actor:ActorProceso){
  await exigirAdmin(c,actor,'elaborarConciliacion');
  const input=conciliacionConsultaSchema.extend({saldoProveedor:money,observaciones:z.string().trim().max(1000).optional()}).strict().parse(raw);
  const preview=await conciliacionConsulta(c,input);if(!preview.fuentes.length)throw new CxpError('No hay documentos para preparar los detalles de esta conciliación.',409);
  if(preview.fuentes.length===100)throw new CxpError('Reduce el intervalo para preparar menos de 100 detalles.',409);
  // La cabecera no tiene MONEDA: se conserva el alcance en la trazabilidad existente, sin DDL.
  const data={idProveedor:input.idProveedor,periodoDesde:input.desde,periodoHasta:input.hasta,saldoEmpresa:preview.saldoEmpresa,saldoProveedor:input.saldoProveedor,diferencia:cxpMoneySum(preview.saldoEmpresa,-input.saldoProveedor),estado:'BORRADOR',elaboradaPor:actor.id,observaciones:input.observaciones||null};
  const id=await headerRepo(c).create(data);
  for(const source of preview.fuentes){
    const docId=Number(source.ruta?.split('/').pop());
    await linesRepo(c).create({idConciliacionProv:id,idDocumento:docId,tipoRegistro:'DOCUMENTO',fechaEmpresa:source.titulo,montoEmpresa:source.monto??0,montoProveedor:null,diferencia:source.monto??0,resultado:'EN_REVISION'});
  }
  const record=(await headerRepo(c).findById(id))!;
  await adminAudit(c,actor,'ADMIN_CONCILIACION_PREPARADA',record,'conciliaciones-proveedor','Conciliación preparada con instantánea de saldos; no aplica ni ejecuta pagos',{moneda:input.moneda,base:preview.base,elaboradaPor:actor.id});
  return{idConciliacionProv:id};
}
export async function compararConciliacion(c:Connection,id:number,raw:unknown,actor:ActorProceso){
  await exigirAdmin(c,actor,'elaborarConciliacion');
  const body=z.strictObject({version:z.string(),idDetalle:z.number().int().positive(),montoProveedor:money.nullable(),fechaProveedor:cxpDate(false).nullable(),referenciaProveedor:z.string().trim().max(120).optional(),observaciones:z.string().trim().max(1000).optional()}).parse(raw);
  const snapshot=await conciliacionSnapshot(c,id,true);currentVersion(snapshot,body.version);const line=snapshot.lines.find(row=>Number(row.idDetConciliacion)===body.idDetalle);if(!line)throw new CxpError('El detalle no pertenece a esta conciliación',400);
  const difference=body.montoProveedor==null?Number(line.montoEmpresa):cxpMoneySum(Number(line.montoEmpresa),-body.montoProveedor);
  const resultado=body.montoProveedor==null||!body.fechaProveedor?'EN_REVISION':difference!==0?'DIFERENCIA_MONTO':String(line.fechaEmpresa).slice(0,10)!==body.fechaProveedor?'DIFERENCIA_FECHA':'COINCIDE';
  await linesRepo(c).update(body.idDetalle,{montoProveedor:body.montoProveedor,fechaProveedor:body.fechaProveedor,referenciaProveedor:body.referenciaProveedor||null,observaciones:body.observaciones||null,diferencia:difference,resultado});
  const next=await conciliacionSnapshot(c,id);
  const estado=next.impedimentos.length?'EN_REVISION':'CONCILIADA';await headerRepo(c).update(id,{estado,diferencia:cxpMoneySum(Number(snapshot.header.saldoEmpresa),-Number(snapshot.header.saldoProveedor))});
  await adminAudit(c,actor,'ADMIN_CONCILIACION_COMPARADA',{...snapshot.header,idConciliacionProv:id},'conciliaciones-proveedor',`Comparación registrada en detalle #${body.idDetalle}: ${resultado}`,{antes:line,despues:{...body,resultado,diferencia:difference}});
  return{idConciliacionProv:id};
}
export async function cerrarConciliacion(c:Connection,id:number,raw:unknown,actor:ActorProceso){
  await exigirAdmin(c,actor,'cerrarConciliacion');const body=z.strictObject({version:z.string(),observaciones:z.string().trim().max(1000).optional()}).parse(raw);
  const snapshot=await conciliacionSnapshot(c,id,true);currentVersion(snapshot,body.version);
  if(Number(snapshot.header.elaboradaPor)===actor.id)throw new CxpError('Quien elaboró la conciliación no puede cerrarla. Debe hacerlo otra persona de Tesorería.',403);
  const issues=[...snapshot.impedimentos];if(!snapshot.moneda)issues.push('No se conoce el alcance de moneda de esta conciliación histórica; no se infiere ni se mezcla.');
  if(issues.length)throw new CxpError('No se puede cerrar la conciliación. Revisa los detalles indicados.',409,issues.map(mensaje=>({campo:'detalles',mensaje})));
  if(snapshot.header.estado!=='CONCILIADA')throw new CxpError('Registra la revisión de los detalles antes del cierre.',409);
  await headerRepo(c).update(id,{estado:'CERRADA',cerradaPor:actor.id,fechaCierre:cxpNow(),...(body.observaciones?{observaciones:body.observaciones}:{})});
  await adminAudit(c,actor,'ADMIN_CONCILIACION_CERRADA',snapshot.header,'conciliaciones-proveedor','Conciliación cerrada: todos los detalles coinciden y diferencia cero; distinto elaborador',{antes:snapshot.header,cerradaPor:actor.id});
  return{idConciliacionProv:id};
}
