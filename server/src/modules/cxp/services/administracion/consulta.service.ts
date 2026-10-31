import oracledb, {type Connection, type BindParameters} from 'oracledb';
import { CXP_ADMIN_RESOURCES,buildPaginationMeta,getCxpEntity,type CxpAdminResource,type CxpAdminRow,type CxpAdminLista,type CxpAdminDetalle,type CxpRecord } from '@erp/contracts';
import { getConnection } from '../../../../config/database';
import { CXP_TABLES } from '../../repositories/definitions';
import {createCxpRepository,mapRow,options,selection} from '../../repositories/crud.repository';
import {cxpCatalogLabels} from '../../repositories/catalogos.repository';
import {CxpError} from '../errors';

export const adminResource=(name:string):CxpAdminResource=>{if(!(CXP_ADMIN_RESOURCES as readonly string[]).includes(name))throw new CxpError('Vista administrativa no encontrada',404);return name as CxpAdminResource;};
const positive=(raw:string|undefined,fallback:number)=>{const value=raw===undefined?fallback:Number(raw);if(!Number.isSafeInteger(value)||value<1)throw new CxpError('Identificador o página inválidos',400);return value;};
export const adminFilters:Record<CxpAdminResource,string[]>={
  'reglas-aprobacion':['tipoEntidad','activa','moneda','idProveedor','idRolAprobador'],aprobaciones:['estado','idRolAprobador','idDocumento','idPago'],
  eventos:['estado','tipoEvento','prioridad','idDocumento','idPago'],archivos:['categoria','estado','idProveedor','idDocumento','idPago'],
  'conciliaciones-proveedor':['estado','idProveedor'],'conciliaciones-proveedor-detalle':['idConciliacionProv','tipoRegistro','resultado'],
  'conciliaciones-pago':['estado','idCuentaBancaria','tipoCoincidencia','idPago'],parametros:['grupoParametro','activo'],
  periodos:['idSucursal','estado','anio'], 'cuentas-bancarias':['tipoTitular','idProveedor','moneda','estado','estadoAprobacion'],compromisos:['idProveedor','idSucursal','tipoCompromiso','estado','moneda']};

export async function adminLabels(c:Connection,resource:CxpAdminResource,records:CxpRecord[]):Promise<CxpAdminRow[]>{
  const fields=getCxpEntity(resource)!.fields.filter(field=>field.lookup);
  const maps=new Map<string,Map<string,string>>();
  for(const field of fields){const ids=records.flatMap(row=>row[field.name]==null?[]:[String(row[field.name])]);maps.set(field.name,await cxpCatalogLabels(c,field.lookup!,ids));}
  const roles=resource==='parametros'?await cxpCatalogLabels(c,'roles',records.filter(row=>row.grupoParametro==='CXP_FE_APROBADOR_ROL'&&row.codigo==='ROL_APROBADOR'&&row.valorNumero!=null).map(row=>Number(row.valorNumero))):new Map<string,string>();
  return records.map(registro=>({registro,etiquetas:{...Object.fromEntries(fields.flatMap(field=>{const label=maps.get(field.name)?.get(String(registro[field.name]));return label?[[field.name,label]]:[];})),...(roles.has(String(registro.valorNumero))&&registro.grupoParametro==='CXP_FE_APROBADOR_ROL'?{valorNumero:roles.get(String(registro.valorNumero))!}:{})}}));
}
export async function adminListWithConnection(c:Connection,resource:CxpAdminResource,query:Record<string,string|undefined>):Promise<CxpAdminLista>{
  const definition=CXP_TABLES[resource],entity=getCxpEntity(resource)!;
  const page=positive(query.page,1),limit=positive(query.limit,20);if(page>100000||limit>100)throw new CxpError('Paginación fuera de rango',400);
  const clauses:string[]=[],binds:BindParameters={};
  for(const [name,value]of Object.entries(query)){
    if(['page','limit','search'].includes(name)||!value)continue;
    if(!adminFilters[resource].includes(name))throw new CxpError('Filtro no permitido',400);
    const field=entity.fields.find(f=>f.name===name)!,column=definition.columns[name];
    if(!field||!column)throw new CxpError('Filtro sin definición',400);
    if(field.options&&!field.options.includes(value))throw new CxpError('Valor de filtro inválido',400);
    binds[`f${name}`]=column.type==='NUMBER'?positive(value,1):value.slice(0,150);clauses.push(`${column.column}=:f${name}`);
  }
  if(query.search?.trim()){
    const columns=entity.fields.filter(field=>field.type==='text'&&!field.readOnly).map(field=>definition.columns[field.name]?.column).filter(Boolean);
    clauses.push(`(${[`TO_CHAR(${definition.idColumn}) LIKE :search`,...columns.map(column=>`UPPER(${column}) LIKE UPPER(:search)`)].join(' OR ')})`);binds.search=`%${query.search.trim().slice(0,120)}%`;
  }
  const where=clauses.length?`WHERE ${clauses.join(' AND ')}`:'';
  const result=await c.execute<Record<string,string|number|null>>(`SELECT ${selection(resource)} FROM ${definition.table} ${where} ORDER BY ${definition.idColumn} DESC OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,{...binds,offset:(page-1)*limit,limit},options(resource));
  const count=await c.execute<{TOTAL:number}>(`SELECT COUNT(*) TOTAL FROM ${definition.table} ${where}`,binds,{outFormat:oracledb.OUT_FORMAT_OBJECT});
  return{data:await adminLabels(c,resource,(result.rows??[]).map(row=>mapRow(resource,row))),meta:buildPaginationMeta(Number(count.rows?.[0]?.TOTAL??0),page,limit)};
}
export async function adminDetailBase(c:Connection,resource:CxpAdminResource,id:number):Promise<CxpAdminDetalle>{
  if(!Number.isSafeInteger(id)||id<1)throw new CxpError('Identificador inválido',400);
  const record=await createCxpRepository(resource).bind(c).findById(id);if(!record)throw new CxpError('Registro no encontrado',404);
  const result:CxpAdminDetalle={item:(await adminLabels(c,resource,[record]))[0],hechos:[],avisos:[],relacionados:[]};
  if(record.idDocumento){const doc=await createCxpRepository('documentos').bind(c).findById(Number(record.idDocumento));if(doc)result.relacionados.push({titulo:'Documento',referencia:[doc.serie,doc.numeroDocumento].filter(Boolean).join(' · '),ruta:`/cxp/documentos/${doc.idDocumento}`,estado:String(doc.estado),moneda:String(doc.moneda),monto:Number(doc.totalNeto)});}
  if(record.idPago){const payment=await createCxpRepository('pagos').bind(c).findById(Number(record.idPago));if(payment)result.relacionados.push({titulo:'Pago',referencia:String(payment.codigoPago),ruta:String(payment.codigoPago).startsWith('CP-')?'/cxp/pagos':`/cxp/pagos/registros?registro=${payment.idPago}`,idPago:String(payment.codigoPago).startsWith('CP-')?Number(payment.idPago):undefined,estado:String(payment.estado),moneda:String(payment.moneda),monto:Number(payment.montoObligacion)});}
  if(resource==='reglas-aprobacion'){
    result.hechos.push({nombre:'Alcance',valor:`${record.tipoEntidad} · nivel ${record.nivel} · ${record.cantidadAprobadores} aprobación(es)`});
    if(!['DOCUMENTO','PAGO','LOTE'].includes(String(record.tipoEntidad)))result.avisos.push('La entidad está contemplada en la tabla, pero el flujo común no aplica aprobaciones de esta entidad. No habilita por sí sola una operación.');
  }
  if(resource==='aprobaciones')result.avisos.push('La decisión debe registrarse desde el documento, factura especial o proceso de pago de origen. Este registro se conserva como historial.');
  if(resource==='eventos')result.avisos.push('El evento registra una operación o incidencia. La autoría y sus referencias se consultan; no se generan decisiones o movimientos desde esta pantalla.');
  if(resource==='archivos')result.avisos.push(record.categoria==='DTE'?'El contenido y sus versiones se administran desde el expediente del documento.':'Esta tabla contiene metadatos y ubicaciones de respaldo; no demuestra por sí sola que el archivo físico esté disponible.');
  return result;
}
export async function withAdminConnection<T>(work:(c:Connection)=>Promise<T>){const c=await getConnection();try{return await work(c);}finally{await c.close();}}
