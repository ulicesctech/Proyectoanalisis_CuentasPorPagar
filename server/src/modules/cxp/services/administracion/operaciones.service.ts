import oracledb,{type Connection} from 'oracledb';
import {z} from 'zod';
import {CXP_SCHEMAS,cxpDate,cxpNumber,cxpToday,cxpNow,cxpMoneySum,validateCxpRecord,type ActorProceso,type CxpAdminResource,type CxpRecord} from '@erp/contracts';
import {createCxpRepository,withCxpTransaction} from '../../repositories/crud.repository';
import {createCxpService} from '../crud.service';
import {CxpError} from '../errors';
import {checkAdminVersion,exigirAdmin} from './politica';
import {resolveActorFields} from '../actorFields';

const obj={outFormat:oracledb.OUT_FORMAT_OBJECT};
const repo=(c:Connection,r:CxpAdminResource)=>createCxpRepository(r).bind(c);
const service=(c:Connection,r:CxpAdminResource)=>createCxpService(createCxpRepository(r),async work=>work(c));
export async function adminAudit(c:Connection,actor:ActorProceso,type:string,record:CxpRecord,resource:CxpAdminResource,detail:string,metadata?:unknown){
  // CK_CXP_EVT_ENTIDAD no admite parámetros/reglas: no se falsea una entidad ni se altera el DDL.
  if(resource==='parametros'||resource==='reglas-aprobacion')return;
  const related:CxpRecord=resource==='periodos'?{idPeriodo:record.idPeriodo}:resource==='cuentas-bancarias'?{idCuentaBancaria:record.idCuentaBancaria}:resource==='compromisos'?{idCompromiso:record.idCompromiso}:resource==='conciliaciones-proveedor'?{idConciliacionProv:record.idConciliacionProv}:resource==='conciliaciones-pago'?{idPago:record.idPago}:{};
  await createCxpRepository('eventos').bind(c).create({tipoEvento:type,asunto:detail.slice(0,200),detalle:detail,usuarioEvento:actor.id,...related,resultadoJson:JSON.stringify(metadata??{resource,registro:record})});
}
async function lock(c:Connection,r:CxpAdminResource,id:number,version:unknown){
  if(!Number.isSafeInteger(id)||id<1)throw new CxpError('Identificador inválido',400);
  const current=await repo(c,r).findById(id,true);if(!current)throw new CxpError('Registro no encontrado',404);checkAdminVersion(current,version);return current;
}
async function validateConfig(c:Connection,r:CxpAdminResource,record:CxpRecord){
  if(r==='reglas-aprobacion'){
    const role=await c.execute('SELECT 1 FROM ROL WHERE ROL_ID_ROL=:id AND ROL_ACTIVO=1',{id:record.idRolAprobador});if(!role.rows?.length)throw new CxpError('Selecciona un rol activo existente',400);return;
  }
  if(r!=='parametros')return;
  const number=record.valorNumero,text=record.valorTexto;
  if((number==null)===(text==null))throw new CxpError('El parámetro debe contener un solo tipo de valor: texto o número',400);
  if(record.grupoParametro==='CXP_FACTURA_ESPECIAL'&&String(record.codigo).startsWith('CORRELATIVO_'))throw new CxpError('Los correlativos avanzan únicamente al registrar o emitir; no se editan ni reinician.',409);
  if(record.grupoParametro==='CXP_FACTURA_ESPECIAL'&&record.codigo==='SERIE'&&(!text||String(text).trim().length>40||number!=null))throw new CxpError('La serie debe ser un texto de 1 a 40 caracteres',400);
  if(record.grupoParametro==='CXP_FE_APROBADOR_ROL'&&record.codigo==='ROL_APROBADOR'){
    if(!Number.isSafeInteger(number)||Number(number)<1||text!=null)throw new CxpError('Selecciona el rol aprobador por nombre',400);
    const role=await c.execute('SELECT 1 FROM ROL WHERE ROL_ID_ROL=:id AND ROL_ACTIVO=1',{id:number});if(!role.rows?.length)throw new CxpError('El rol debe existir y estar activo',400);
  }
}
export async function adminCreateWithConnection(c:Connection,r:CxpAdminResource,raw:unknown,actor:ActorProceso):Promise<CxpRecord>{
  if(r==='parametros'||r==='reglas-aprobacion'){
    await exigirAdmin(c,actor,'configuracion');const input=CXP_SCHEMAS[r].create.parse(resolveActorFields(r,actor.id,raw as CxpRecord)) as CxpRecord;
    await validateConfig(c,r,input);const result=await service(c,r).create(input,actor.id);await adminAudit(c,actor,'ADMIN_CONFIGURACION_CREADA',result,r,`Configuración creada: ${r}`);return result;
  }
  if(r==='periodos'){
    await exigirAdmin(c,actor,'periodos');
    const input=z.strictObject({idSucursal:z.number().int().positive(),fechaInicio:cxpDate(false),fechaFin:cxpDate(false),observaciones:z.string().trim().max(1000).optional()}).parse(raw);
    if(input.fechaFin<input.fechaInicio)throw new CxpError('La fecha final no puede ser anterior a la inicial',400);
    await c.execute('LOCK TABLE CXP_PERIODO IN SHARE ROW EXCLUSIVE MODE NOWAIT');
    const overlap=await c.execute<{ID_PERIODO:number}>(`SELECT ID_PERIODO FROM CXP_PERIODO WHERE ID_SUCURSAL=:branch AND FECHA_INICIO<=TO_DATE(:hasta,'YYYY-MM-DD') AND FECHA_FIN>=TO_DATE(:desde,'YYYY-MM-DD')`,{branch:input.idSucursal,desde:input.fechaInicio,hasta:input.fechaFin},obj);
    if(overlap.rows?.length)throw new CxpError(`El rango se superpone con ${overlap.rows.length} período(s) de la sucursal. Consulta sus fechas; no se cambiarán automáticamente.`,409);
    const result=await service(c,r).create({...input,observaciones:input.observaciones||null,anio:Number(input.fechaInicio.slice(0,4)),mes:Number(input.fechaInicio.slice(5,7)),estado:'ABIERTO',saldoInicial:0,movimientosDebe:0,movimientosHaber:0,saldoFinal:0},actor.id);
    await adminAudit(c,actor,'ADMIN_PERIODO_ABIERTO',result,r,'Período creado y abierto');return result;
  }
  if(r==='cuentas-bancarias'){
    await exigirAdmin(c,actor,'registrarCuenta');
    const schema=CXP_SCHEMAS['cuentas-bancarias'].create.omit({creadoPor:true,modificadoPor:true,estado:true,estadoAprobacion:true,titularCoincide:true,motivoBloqueo:true,fechaVerificacion:true,verificadoPor:true});
    const input=schema.parse(raw);const result=await service(c,r).create({...input,estado:'ACTIVA',estadoAprobacion:'PENDIENTE',titularCoincide:'N'},actor.id);
    await adminAudit(c,actor,'ADMIN_CUENTA_REGISTRADA',result,r,'Cuenta CXP registrada pendiente de aprobación; no verifica Bancos');return result;
  }
  if(r==='compromisos'){
    await exigirAdmin(c,actor,'registrarCompromiso');
    const input=CXP_SCHEMAS.compromisos.create.omit({creadoPor:true,modificadoPor:true,saldoCapital:true,estado:true}).parse(raw);
    const result=await service(c,r).create({...input,saldoCapital:input.tipoCompromiso==='FONDO_CAJA_CHICA'?input.montoTotal:0,estado:'ACTIVO'},actor.id);
    await adminAudit(c,actor,'ADMIN_COMPROMISO_REGISTRADO',result,r,'Compromiso registrado con el estado inicial activo del servicio existente');return result;
  }
  if(r==='conciliaciones-pago'){
    await exigirAdmin(c,actor,'elaborarConciliacion');
    const input=z.strictObject({idPago:z.number().int().positive(),referenciaMovimiento:z.string().trim().min(1).max(120),fechaMovimiento:cxpDate(false),montoBanco:cxpNumber({precision:18,scale:2}),observaciones:z.string().trim().max(1000).optional()}).parse(raw);
    const payment=await createCxpRepository('pagos').bind(c).findById(input.idPago,true);if(!payment)throw new CxpError('El pago no existe',400);
    const candidate=CXP_SCHEMAS['conciliaciones-pago'].create.parse({...input,observaciones:input.observaciones||null,idCuentaBancaria:payment.idCuentaOrigen,montoSistema:Number(payment.montoTransferido),diferenciaMonto:cxpMoneySum(input.montoBanco,-Number(payment.montoTransferido)),tipoCoincidencia:'MANUAL',estado:'PENDIENTE'}) as CxpRecord;
    const issues=validateCxpRecord(r,candidate);if(issues.length)throw new CxpError('Revisa la referencia de pago',400,issues);
    const id=await repo(c,r).create(candidate),record=(await repo(c,r).findById(id))!;
    await adminAudit(c,actor,'ADMIN_REFERENCIA_PAGO_PREPARADA',record,r,'Referencia preparada para revisión; no confirma Bancos ni aplica el pago',{moneda:payment.moneda,elaboradaPor:actor.id,registro:record});return record;
  }
  throw new CxpError('Esta entidad se genera desde su operación de origen',409);
}
export async function adminUpdateConfigWithConnection(c:Connection,r:CxpAdminResource,id:number,raw:unknown,actor:ActorProceso){
  if(r!=='parametros'&&r!=='reglas-aprobacion')throw new CxpError('La entidad no admite este editor',400);
  await exigirAdmin(c,actor,'configuracion');
  const body=z.strictObject({version:z.string(),cambios:z.record(z.string(),z.unknown())}).parse(raw),current=await lock(c,r,id,body.version);
  if(r==='parametros'&&['grupoParametro','codigo'].some(key=>Object.hasOwn(body.cambios,key)&&body.cambios[key]!==current[key]))throw new CxpError('El grupo y código identifican la configuración y no se renombran.',409);
  if(r==='reglas-aprobacion'){
    const used=await c.execute('SELECT 1 FROM CXP_APROBACION WHERE ID_REGLA=:id FETCH FIRST 1 ROW ONLY',{id});if(used.rows?.length)throw new CxpError('La regla ya tiene decisiones o solicitudes vinculadas y se conserva como historial. No se modifica en esta pantalla.',409);
  }
  const patch=CXP_SCHEMAS[r].update.parse(body.cambios) as CxpRecord;await validateConfig(c,r,{...current,...patch});
  const result=await service(c,r).update(id,patch,actor.id);await adminAudit(c,actor,'ADMIN_CONFIGURACION_ACTUALIZADA',result,r,'Configuración actualizada por usuario autorizado',{antes:current,despues:result});return result;
}
export async function adminActionWithConnection(c:Connection,r:CxpAdminResource,id:number,action:string,raw:unknown,actor:ActorProceso){
  const body=z.strictObject({version:z.string(),motivo:z.string().trim().max(1000).optional(),titularCoincide:z.boolean().optional()}).parse(raw);
  if(r==='periodos'){
    await exigirAdmin(c,actor,'periodos');const current=await lock(c,r,id,body.version);let patch:CxpRecord;
    if(action==='iniciar-cierre'&&['ABIERTO','REABIERTO'].includes(String(current.estado)))patch={estado:'EN_CIERRE'};
    else if(action==='cerrar'&&['ABIERTO','REABIERTO','EN_CIERRE'].includes(String(current.estado)))patch={estado:'CERRADO',fechaCierre:cxpNow()};
    else if(action==='reabrir'&&current.estado==='CERRADO'&&body.motivo)patch={estado:'REABIERTO',fechaReapertura:cxpNow(),motivoReapertura:body.motivo};
    else throw new CxpError('La acción no corresponde al estado actual; reabrir requiere un motivo.',409);
    const result=await service(c,r).update(id,patch,actor.id);await adminAudit(c,actor,'ADMIN_PERIODO_CAMBIO',result,r,`Período: ${current.estado} → ${result.estado}`,{antes:current,despues:result,motivo:body.motivo});return result;
  }
  if(r==='cuentas-bancarias'){
    await exigirAdmin(c,actor,'decidirCuenta');const current=await lock(c,r,id,body.version);
    if(action==='aprobar'&&Number(current.creadoPor)===actor.id)throw new CxpError('No puedes aprobar una cuenta que registraste.',403);
    if(!['PENDIENTE','REQUIERE_REVALIDACION'].includes(String(current.estadoAprobacion))||current.estado!=='ACTIVA')throw new CxpError('La cuenta no está activa y pendiente de decisión.',409);
    if(!['aprobar','rechazar'].includes(action)||action==='aprobar'&&!body.titularCoincide||action==='rechazar'&&!body.motivo)throw new CxpError('Confirma la coincidencia del titular al aprobar o indica un motivo al rechazar.',400);
    const result=await service(c,r).update(id,action==='aprobar'?{estadoAprobacion:'APROBADA',titularCoincide:'S',fechaVerificacion:cxpNow()}:{estadoAprobacion:'RECHAZADA'},actor.id);
    await adminAudit(c,actor,'ADMIN_CUENTA_DECISION',result,r,`Decisión CXP: ${result.estadoAprobacion}. ${body.motivo??'Titular revisado'}. No modifica la verificación de Bancos.`,{antes:current,despues:result});return result;
  }
  throw new CxpError('No existe una operación definida para esa acción.',409);
}
export async function runAdminWrite<T>(work:(c:Connection)=>Promise<T>){try{return await withCxpTransaction(work);}catch(error){if((error as {errorNum?:number}).errorNum===54)throw new CxpError('Otro usuario está modificando esta configuración. Reintenta después de consultar su versión.',409);if((error as {errorNum?:number}).errorNum===1)throw new CxpError('Ya existe un registro con esa identificación o alcance. Consulta el existente antes de crear otro.',409);throw error;}}
