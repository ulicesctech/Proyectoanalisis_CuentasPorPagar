import oracledb,{type Connection} from 'oracledb';
import {z} from 'zod';
import {cxpDate,cxpToday,cxpMoneySum,type CxpAdminResource,type CxpPeriodoConsulta,type CxpConciliacionConsulta} from '@erp/contracts';
import {adminDetailBase} from './consulta.service';
import {adminVersion} from './politica';
import {CxpError} from '../errors';
const obj={outFormat:oracledb.OUT_FORMAT_OBJECT};
export async function periodoConsulta(c:Connection,raw:unknown):Promise<CxpPeriodoConsulta>{
  const input=z.object({idSucursal:z.coerce.number().int().positive(),fecha:cxpDate(false)}).parse(raw);
  const data=await c.execute<{ID_PERIODO:number;ESTADO:string;DESDE:string;HASTA:string}>(`SELECT ID_PERIODO,ESTADO,TO_CHAR(FECHA_INICIO,'YYYY-MM-DD') DESDE,TO_CHAR(FECHA_FIN,'YYYY-MM-DD') HASTA FROM CXP_PERIODO WHERE ID_SUCURSAL=:branch AND FECHA_INICIO<=TO_DATE(:dia,'YYYY-MM-DD') AND FECHA_FIN>=TO_DATE(:dia,'YYYY-MM-DD') ORDER BY ID_PERIODO`,{branch:input.idSucursal,dia:input.fecha},obj);
  const rows=data.rows??[],disponible=rows.length===1&&['ABIERTO','REABIERTO'].includes(rows[0].ESTADO);
  return{...input,disponible,motivo:disponible?'La fecha tiene un único período abierto o reabierto.':rows.length>1?`Hay ${rows.length} períodos superpuestos; debe existir exactamente uno, incluso si alguno está cerrado.`:rows.length===1?'El período que cubre la fecha no está abierto ni reabierto.':'No hay un período que cubra esta fecha y sucursal.',periodos:rows.map(row=>({idPeriodo:row.ID_PERIODO,estado:row.ESTADO,fechaInicio:row.DESDE,fechaFin:row.HASTA}))};
}
export const conciliacionConsultaSchema=z.object({idProveedor:z.coerce.number().int().positive(),desde:cxpDate(false),hasta:cxpDate(false),moneda:z.string().trim().length(3).transform(s=>s.toUpperCase()),saldoProveedor:z.coerce.number().finite().optional()});
export async function conciliacionConsulta(c:Connection,raw:unknown):Promise<CxpConciliacionConsulta>{
  const input=conciliacionConsultaSchema.parse(raw);if(input.hasta<input.desde)throw new CxpError('La fecha final debe ser igual o posterior a la inicial',400);
  const data=await c.execute<{ID_DOCUMENTO:number;SERIE:string;NUMERO_DOCUMENTO:string;ESTADO:string;MONEDA:string;SALDO_PENDIENTE:number;NATURALEZA:string;FECHA_DOCUMENTO:string}>(`SELECT ID_DOCUMENTO,SERIE,NUMERO_DOCUMENTO,ESTADO,MONEDA,SALDO_PENDIENTE,NATURALEZA,TO_CHAR(FECHA_DOCUMENTO,'YYYY-MM-DD') FECHA_DOCUMENTO FROM CXP_DOCUMENTO WHERE ID_PROVEEDOR=:provider AND MONEDA=:currency AND FECHA_DOCUMENTO BETWEEN TO_DATE(:desde,'YYYY-MM-DD') AND TO_DATE(:hasta,'YYYY-MM-DD') AND ESTADO NOT IN ('ANULADA','RECHAZADA','DUPLICADO') ORDER BY ID_DOCUMENTO FETCH FIRST 101 ROWS ONLY`,{provider:input.idProveedor,currency:input.moneda,desde:input.desde,hasta:input.hasta},obj);
  const rows=data.rows??[],saldoEmpresa=cxpMoneySum(...rows.slice(0,100).map(row=>Number(row.SALDO_PENDIENTE)*(row.NATURALEZA==='C'?-1:1)));
  return{moneda:input.moneda,base:'Saldo actual de los documentos seleccionados por fecha de emisión; no reconstruye un saldo contable histórico al cierre.',saldoEmpresa,saldoProveedor:input.saldoProveedor??null,diferencia:input.saldoProveedor==null?null:cxpMoneySum(saldoEmpresa,-input.saldoProveedor),
    fuentes:rows.slice(0,100).map(row=>({titulo:row.FECHA_DOCUMENTO,referencia:`${row.SERIE??''} · ${row.NUMERO_DOCUMENTO}`,ruta:`/cxp/documentos/${row.ID_DOCUMENTO}`,estado:row.ESTADO,moneda:row.MONEDA,monto:Number(row.SALDO_PENDIENTE)*(row.NATURALEZA==='C'?-1:1)})),
    avisos:['Los documentos de crédito restan saldo. No se suman pagos por separado: ya están reflejados en el saldo pendiente de sus documentos.','Los importes externos deben proceder del estado de cuenta; esta consulta no importa ni verifica un extracto bancario.',...(rows.length>100?['Hay más de 100 documentos. Reduce el intervalo antes de preparar una conciliación.']:[])]};
}
export async function adminDetalle(c:Connection,resource:CxpAdminResource,id:number){
  const detail=await adminDetailBase(c,resource,id),record=detail.item.registro;detail.version=adminVersion(record);
  if(resource==='parametros'){
    if(record.grupoParametro==='CXP_FACTURA_ESPECIAL'&&String(record.codigo).startsWith('CORRELATIVO_'))detail.avisos.push('Número administrado por la operación de registro o emisión bajo FOR UPDATE. No es un saldo editable ni se reinicia.');
    if(record.grupoParametro==='CXP_FE_APROBADOR_ROL'&&record.codigo==='ROL_APROBADOR')detail.hechos.push({nombre:'Tipo del valor',valor:'Rol activo en VALOR_NUMERO; no es un ID de SEG_USUARIOS ni de USUARIO.'});
  }
  if(resource==='reglas-aprobacion'){
    const count=await c.execute<{TOTAL:number}>('SELECT COUNT(*) TOTAL FROM CXP_APROBACION WHERE ID_REGLA=:id',{id},obj);detail.hechos.push({nombre:'Solicitudes o decisiones vinculadas',valor:String(count.rows?.[0]?.TOTAL??0)});
  }
  if(resource==='periodos'){
    const overlap=await c.execute<{ID_PERIODO:number;ESTADO:string}>(`SELECT ID_PERIODO,ESTADO FROM CXP_PERIODO WHERE ID_SUCURSAL=:branch AND ID_PERIODO<>:id AND FECHA_INICIO<=TO_DATE(:hasta,'YYYY-MM-DD') AND FECHA_FIN>=TO_DATE(:desde,'YYYY-MM-DD')`,{branch:record.idSucursal,id,desde:String(record.fechaInicio).slice(0,10),hasta:String(record.fechaFin).slice(0,10)},obj);
    if(overlap.rows?.length)detail.avisos.push(`Se superpone con ${overlap.rows.map(row=>`período #${row.ID_PERIODO} (${row.ESTADO})`).join(', ')}. Cambiar solo el estado no elimina la superposición.`);
    detail.avisos.push('Abrir y cerrar controla la programación de pagos. No ejecuta un cierre contable ni calcula movimientos. Los acumulados se consultan, no se editan.');
  }
  if(resource==='compromisos'){
    const fund=record.tipoCompromiso==='FONDO_CAJA_CHICA';
    detail.hechos.push({nombre:'Importe comprometido',valor:`${record.montoTotal} ${record.moneda}`},{nombre:fund?'Disponible del fondo':'Saldo capital persistido',valor:`${record.saldoCapital} ${record.moneda}`});
    if(fund)detail.hechos.push({nombre:'Importe utilizado del fondo',valor:`${cxpMoneySum(Number(record.montoTotal),-Number(record.saldoCapital))} ${record.moneda}`});
    else detail.avisos.push('No hay motor de consumo, cuotas o liberación para este tipo de compromiso. El saldo capital no se presenta como disponibilidad calculada.');
    const docs=await c.execute<{ID_DOCUMENTO:number;NUMERO_DOCUMENTO:string;MONEDA:string;TOTAL_NETO:number;ESTADO:string}>(`SELECT ID_DOCUMENTO,NUMERO_DOCUMENTO,MONEDA,TOTAL_NETO,ESTADO FROM CXP_DOCUMENTO WHERE ID_COMPROMISO=:id ORDER BY ID_DOCUMENTO DESC FETCH FIRST 100 ROWS ONLY`,{id},obj);
    detail.relacionados.push(...(docs.rows??[]).map(row=>({titulo:'Documento del compromiso',referencia:row.NUMERO_DOCUMENTO,ruta:`/cxp/documentos/${row.ID_DOCUMENTO}`,moneda:row.MONEDA,monto:Number(row.TOTAL_NETO),estado:row.ESTADO})));
    detail.avisos.push('No se eliminan compromisos utilizados ni se liberan importes por edición genérica. Los fondos se actualizan mediante gastos y reposiciones controladas.');
  }
  if(resource==='cuentas-bancarias'){
    const origin=record.tipoTitular==='EMPRESA';
    const compatible=origin
      ?await c.execute<{ID:number;ESTADO:string;MONEDA:string;PAGOS:string}>(`SELECT M.CUENTA_ID ID,M.ESTADO,MO.CODIGO MONEDA,M.PERMITE_PAGOS PAGOS FROM MB_CUENTA_BANCARIA M JOIN MB_BANCO B ON B.BANCO_ID=M.BANCO_ID JOIN MONEDA MO ON MO.ID_MONEDA=M.MONEDA_ID WHERE M.EMPRESA_ID=:owner AND M.NUMERO_CUENTA=:account AND (:bank IS NULL OR UPPER(TRIM(B.CODIGO_BANCO))=UPPER(TRIM(:bank)) OR UPPER(TRIM(B.NOMBRE)) LIKE '%'||UPPER(TRIM(:name))||'%')`,{owner:record.idEmpresa,account:record.numeroCuenta,bank:record.codigoBanco,name:record.bancoNombre},obj)
      :await c.execute<{ID:number;ESTADO:string;MONEDA:string;PAGOS:string}>(`SELECT M.CTA_PROVEEDOR_ID ID,M.ESTADO,MO.CODIGO MONEDA,'S' PAGOS FROM MB_CUENTA_BANCARIA_PROVEEDOR M JOIN MB_BANCO B ON B.BANCO_ID=M.BANCO_ID JOIN MONEDA MO ON MO.ID_MONEDA=M.MONEDA_ID WHERE M.PROVEEDOR_ID=:owner AND M.NUMERO_CUENTA=:account AND (:bank IS NULL OR UPPER(TRIM(B.CODIGO_BANCO))=UPPER(TRIM(:bank)) OR UPPER(TRIM(B.NOMBRE)) LIKE '%'||UPPER(TRIM(:name))||'%')`,{owner:record.idProveedor,account:record.numeroCuenta,bank:record.codigoBanco,name:record.bancoNombre},obj);
    const rows=compatible.rows??[];detail.hechos.push({nombre:'Coincidencias por titular, banco y número en Bancos',valor:String(rows.length)});
    if(rows.length!==1)detail.avisos.push(rows.length?'Bancos tiene varias cuentas compatibles. Debe resolverse la ambigüedad antes de pagar.':'No hay una cuenta compatible en Bancos. Registrar o aprobar la cuenta CXP no la crea allí.');
    for(const row of rows){
      detail.hechos.push({nombre:`Bancos #${row.ID}`,valor:`${row.ESTADO} · ${row.MONEDA} · Permite pagos: ${row.PAGOS}`});
      if(row.MONEDA!==record.moneda)detail.avisos.push('La moneda de Bancos no coincide con CXP. No se convierte automáticamente.');
      if(!origin){const verification=await c.execute<{DECISION:string;EVIDENCIA_DOCUMENTO_ID:number;VERIFICADO_POR:number;SOLICITADO_POR:number;VIGENCIA:string|null;DOCUMENTOS:number}>(`SELECT V.DECISION,V.EVIDENCIA_DOCUMENTO_ID,V.VERIFICADO_POR,M.SOLICITADO_POR,TO_CHAR(M.FECHA_VIGENCIA,'YYYY-MM-DD') VIGENCIA,(SELECT COUNT(*) FROM MB_DOCUMENTO_BANCARIO D WHERE D.DOCUMENTO_ID IN (M.CARTA_SOLICITUD_DOC_ID,M.CONSTANCIA_BANCO_DOC_ID,V.EVIDENCIA_DOCUMENTO_ID)) DOCUMENTOS FROM MB_CUENTA_BANCARIA_PROVEEDOR M LEFT JOIN MB_VERIFICACION_CTA_PROVEEDOR V ON V.VERIFICACION_ID=(SELECT MAX(V2.VERIFICACION_ID) FROM MB_VERIFICACION_CTA_PROVEEDOR V2 WHERE V2.CTA_PROVEEDOR_ID=M.CTA_PROVEEDOR_ID) WHERE M.CTA_PROVEEDOR_ID=:id`,{id:row.ID},obj);
        const v=verification.rows?.[0];detail.hechos.push({nombre:'Última verificación en Bancos',valor:v?.DECISION?`${v.DECISION} · vigencia ${v.VIGENCIA??'sin límite informado'} · documentos registrados ${v.DOCUMENTOS}`:'Sin decisión de verificación'});
        if(row.ESTADO!=='VERIFICADA'||v?.DECISION!=='VERIFICAR'||!v?.EVIDENCIA_DOCUMENTO_ID)detail.avisos.push('Falta la verificación vigente y su evidencia en Bancos.');
        if(v?.VIGENCIA&&v.VIGENCIA<cxpToday())detail.avisos.push('La verificación bancaria está vencida.');
        if(v?.VERIFICADO_POR===v?.SOLICITADO_POR)detail.avisos.push('El solicitante y verificador bancario coinciden; revisa la segregación.');
      }
    }
    detail.avisos.push('Este diagnóstico consulta registros; no ejecuta una verificación bancaria ni comprueba bytes de evidencias. La API de administración de Bancos no está montada en el servidor actual. Continúa el proceso de pago solo cuando Bancos y CXP cumplan sus controles.');
  }
  if(resource==='conciliaciones-pago')detail.hechos.push({nombre:'Diferencia calculada de la referencia',valor:String(cxpMoneySum(Number(record.montoBanco),-Number(record.montoSistema)))});
  return detail;
}
