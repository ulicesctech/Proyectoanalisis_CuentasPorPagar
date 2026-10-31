import {useRef,useState} from 'react';
import type {CxpAdminResource,CxpAdminDetalle,CxpRecord} from '@erp/contracts';
import {CxpEntityForm} from '../components/CxpEntityForm';
import {CxpManagementDialog} from '../components/CxpManagementUI';
import {CxpButton} from '../components/CxpButton';
import {useCxpFormGuard,useCxpPendingChanges} from '../components/CxpFormGuard';
import {TextArea} from '../../../shared/ui-kit';
import {apiClient,ApiError} from '../api';

const fields:Partial<Record<CxpAdminResource,string[]>>={
  parametros:['grupoParametro','codigo','nombre','valorTexto','valorNumero','activo'],
  'reglas-aprobacion':['nombreRegla','tipoEntidad','idProveedor','idDepartamento','centroCosto','proyecto','moneda','montoDesde','montoHasta','requiereSinOc','requiereDiferencia','nivel','idRolAprobador','cantidadAprobadores','permiteDelegacion','vigenteDesde','vigenteHasta','activa'],
  periodos:['idSucursal','fechaInicio','fechaFin','observaciones'],
  'cuentas-bancarias':['tipoTitular','idEmpresa','idProveedor','bancoNombre','codigoBanco','titular','numeroCuenta','tipoCuenta','moneda','pais','codigoSwift','codigoIban','esPrincipal'],
  compromisos:['idProveedor','idSucursal','idDepartamento','tipoCompromiso','numeroReferencia','descripcion','fechaInicio','fechaFin','frecuencia','numeroCuotas','diaVencimiento','moneda','montoTotal','tasaInteres','valorCuota','garantiaDescripcion','cuentaContable','centroCosto','proyecto','responsablePor'],
  'conciliaciones-pago':['idPago','referenciaMovimiento','fechaMovimiento','montoBanco','observaciones'],
  'conciliaciones-proveedor-detalle':['referenciaProveedor','fechaProveedor','montoProveedor','observaciones'],
};
export function OperacionDialog({resource,record,version,parentId,onClose,onSaved}:{resource:CxpAdminResource;record?:CxpRecord;version?:string;parentId?:number;onClose:()=>void;onSaved:()=>void}){
  const [busy,setBusy]=useState(false);const {discard}=useCxpFormGuard();
  const edit=!!record,close=()=>void discard(onClose);
  const label=resource==='periodos'?'Crear y abrir período':resource==='cuentas-bancarias'?'Registrar cuenta':resource==='compromisos'?'Registrar compromiso':resource==='conciliaciones-proveedor-detalle'?'Registrar comparación':resource==='conciliaciones-pago'?'Registrar referencia de pago':resource==='reglas-aprobacion'?(edit?'Guardar regla':'Crear regla'):(edit?'Guardar configuración':'Crear parámetro');
  let names=fields[resource]??[];
  if(edit&&resource==='parametros')names=names.filter(name=>!['grupoParametro','codigo'].includes(name)&&(record.valorTexto!=null?name!=='valorNumero':name!=='valorTexto'));
  return <CxpManagementDialog isOpen onClose={close} busy={busy} title={label} description="Captura los datos de la tarea; la operación valida permisos, estado y autoría en el servidor.">
    {resource==='periodos'&&<p className="mb-4 text-sm text-slate-600">Se abre el rango para la sucursal. Año y mes se toman de la fecha inicial; no se editan acumulados.</p>}
    {resource==='cuentas-bancarias'&&<p className="mb-4 text-sm text-slate-600">La cuenta queda pendiente de aprobación CXP. No registra ni verifica una cuenta en Bancos.</p>}
    {resource==='compromisos'&&<p className="mb-4 text-sm text-slate-600">El servicio existente registra la obligación ACTIVA. El saldo del fondo se inicia con su monto; los demás tipos no tienen consumo automático. No se elige libremente un estado ni un acumulado.</p>}
    {resource==='conciliaciones-proveedor-detalle'&&<p className="mb-4 text-sm text-slate-600">Importe de empresa: {record?.montoEmpresa} · Fecha: {record?.fechaEmpresa}. Captura el dato real del estado de cuenta. El resultado y la diferencia los calcula el servidor.</p>}
    <CxpEntityForm key={`${resource}-${record?Object.values(record)[0]:'nuevo'}`} resource={resource} record={record} compact fieldNames={names} submitLabel={label} onBusyChange={setBusy} onCancel={close} onSuccess={()=>{onClose();onSaved();}}
      operation={async input=>{
        const value=(name:string,fallback:unknown)=>Object.prototype.hasOwnProperty.call(input,name)?input[name]:record?.[name]??fallback;
        if(resource==='conciliaciones-proveedor-detalle')await apiClient.post(`/cxp/administracion/conciliaciones-proveedor/${parentId}/comparar`,{version,idDetalle:record?.idDetConciliacion,montoProveedor:value('montoProveedor',null),fechaProveedor:value('fechaProveedor',null),referenciaProveedor:value('referenciaProveedor',''),observaciones:value('observaciones','')});
        else if(edit)await apiClient.patch(`/cxp/administracion/${resource}/${record![resource==='parametros'?'idParametro':'idRegla']}`,{version,cambios:input});
        else await apiClient.post(`/cxp/administracion/${resource}`,input);
      }}/>
  </CxpManagementDialog>;
}
export function AccionAdministrativaDialog({resource,id,action,detail,onClose,onSaved}:{resource:CxpAdminResource;id:number;action:string;detail:CxpAdminDetalle;onClose:()=>void;onSaved:()=>void}){
  const [motivo,setMotivo]=useState(''),[titular,setTitular]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const busyRef=useRef(false),clear=useCxpPendingChanges(!!motivo||titular,busy),{discard}=useCxpFormGuard();
  const close=()=>void discard(onClose,!!motivo||titular);
  const labels:Record<string,string>={cerrar:resource==='periodos'?'Cerrar período':'Cerrar conciliación',reabrir:'Reabrir período','iniciar-cierre':'Iniciar cierre de período',aprobar:'Aprobar cuenta CXP',rechazar:'Rechazar cuenta CXP'};
  const submit=async()=>{
    if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');
    try{await apiClient.post(`/cxp/administracion/${resource}/${id}/${action}`,resource==='conciliaciones-proveedor'?{version:detail.version,observaciones:motivo}:{version:detail.version,motivo,titularCoincide:titular});clear();onClose();onSaved();}
    catch(reason){setError(reason instanceof ApiError?`${reason.message}${Array.isArray(reason.details)?' '+reason.details.map(d=>d.mensaje).join(' '):''}`:'No se pudo completar la operación.');}
    finally{busyRef.current=false;setBusy(false);}
  };
  return <CxpManagementDialog isOpen title={labels[action]??action} description="Confirma la operación. Se conserva la trazabilidad y se vuelve a validar la versión del registro." onClose={close} busy={busy} size="md">
    {resource==='cuentas-bancarias'&&<p className="mb-4 text-sm text-slate-600">Esta decisión no verifica la cuenta en Bancos ni habilita por sí sola una transferencia.</p>}
    {resource==='conciliaciones-proveedor'&&<p className="mb-4 text-sm text-slate-600">El cierre exige detalles coincidentes y diferencia cero, con otra persona de Tesorería. Una observación no permite omitir esas condiciones.</p>}
    {resource==='cuentas-bancarias'&&action==='aprobar'&&<label className="mb-4 flex gap-2 text-sm"><input type="checkbox" checked={titular} onChange={event=>setTitular(event.target.checked)} disabled={busy}/>Confirmo que el titular corresponde a la empresa o proveedor registrado.</label>}
    <TextArea id="admin-motivo" label={action==='reabrir'||action==='rechazar'?'Motivo obligatorio':'Observación adicional'} value={motivo} onChange={event=>setMotivo(event.target.value)} maxLength={resource==='periodos'?500:1000} isReadOnly={busy}/>
    {error&&<p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="mt-5 flex flex-wrap justify-end gap-2"><CxpButton variant="secondary" disabled={busy} onClick={close}>Cancelar</CxpButton><CxpButton disabled={busy||(action==='reabrir'||action==='rechazar')&&!motivo.trim()||resource==='cuentas-bancarias'&&action==='aprobar'&&!titular} onClick={()=>void submit()}>{busy?'Registrando…':labels[action]??'Confirmar'}</CxpButton></div>
  </CxpManagementDialog>;
}
