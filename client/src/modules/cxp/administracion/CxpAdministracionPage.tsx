import {useEffect,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {Eye,RefreshCw,Search,ChevronLeft,ChevronRight} from 'lucide-react';
import {getCxpEntity,type CxpAdminResource,type CxpAdminRow,type CxpAdminLista,type CxpAdminDetalle,type CxpAdminPermisos,type CxpRecord} from '@erp/contracts';
import {DataTable,TextInput,Select} from '../../../shared/ui-kit';
import {apiClient,buildQueryString} from '../api';
import {CxpLayout} from '../CxpLayout';
import {CxpPageHeader} from '../components/CxpPageHeader';
import {CxpButton} from '../components/CxpButton';
import {CxpManagementDialog} from '../components/CxpManagementUI';
import {RelationSelect} from '../components/RelationSelect';
import {adminPath,adminViews} from './vistas';
import {OperacionDialog,AccionAdministrativaDialog} from './OperacionDialog';
import {PeriodoConsultaPanel,FacturaConfiguracionPanel,ConciliacionPrepararPanel} from './Herramientas';
import {useCxpFormGuard} from '../components/CxpFormGuard';
import {useAuth} from '../auth/session';

const text=(value:unknown)=>value==null||value===''?'—':String(value).replace(/_/g,' ');
export function CxpAdministracionPage({resource}:{resource:CxpAdminResource}){
  const view=adminViews[resource],entity=getCxpEntity(resource)!;
  const {session}=useAuth(),{discard}=useCxpFormGuard();
  const [params,setParams]=useSearchParams();
  const [filters,setFilters]=useState<Record<string,string>>(()=>Object.fromEntries(view.filters.map(key=>[key,params.get(key)??''])));
  const [search,setSearch]=useState(''),[term,setTerm]=useState(''),[page,setPage]=useState(1),[reload,setReload]=useState(0);
  const [result,setResult]=useState<CxpAdminLista|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [selected,setSelected]=useState<number|null>(params.get('registro')?Number(params.get('registro')):null);
  const [detail,setDetail]=useState<CxpAdminDetalle|null>(null),[detailError,setDetailError]=useState(''),[detailLoading,setDetailLoading]=useState(false);
  const [permissions,setPermissions]=useState<CxpAdminPermisos|null>(null),[permissionError,setPermissionError]=useState(''),[notice,setNotice]=useState('');
  const [editor,setEditor]=useState<{resource:CxpAdminResource;record?:CxpRecord;version?:string;parentId?:number}|null>(null),[action,setAction]=useState('');
  useEffect(()=>{let active=true;setPermissionError('');apiClient.get<CxpAdminPermisos>('/cxp/administracion/permisos').then(next=>{if(active)setPermissions(next);}).catch(e=>{if(active){setPermissions(null);setPermissionError(e.message);}});return()=>{active=false;};},[reload]);
  useEffect(()=>{const timer=window.setTimeout(()=>{setTerm(search.trim());setPage(1);},250);return()=>window.clearTimeout(timer);},[search]);
  useEffect(()=>{
    let active=true;setLoading(true);setError('');
    apiClient.get<CxpAdminLista>(`/cxp/administracion/${resource}${buildQueryString({...filters,search:term,page,limit:20})}`).then(next=>{if(active){setResult(next);if(page>Math.max(1,next.meta.totalPages))setPage(Math.max(1,next.meta.totalPages));}}).catch(e=>{if(active){setResult(null);setError(e.message??'No se pudo consultar la vista.');}}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[resource,JSON.stringify(filters),term,page,reload]);
  useEffect(()=>{
    if(!selected){setDetail(null);return;}let active=true;setDetail(null);setDetailError('');setDetailLoading(true);
    apiClient.get<CxpAdminDetalle>(`/cxp/administracion/${resource}/${selected}`).then(next=>{if(active)setDetail(next);}).catch(e=>{if(active)setDetailError(e.message??'No se pudo abrir el detalle.');}).finally(()=>{if(active)setDetailLoading(false);});return()=>{active=false;};
  },[resource,selected,reload]);
  const filter=(key:string,value:string)=>{setFilters(current=>({...current,[key]:value}));setPage(1);};
  const close=()=>void discard(()=>{setSelected(null);if(params.has('registro')){const next=new URLSearchParams(params);next.delete('registro');setParams(next,{replace:true});}});
  const saved=()=>{setNotice('Operación registrada. Se actualizaron los datos y su versión.');setReload(n=>n+1);};
  const canCreate=resource==='parametros'||resource==='reglas-aprobacion'?permissions?.configuracion:resource==='periodos'?permissions?.periodos:resource==='cuentas-bancarias'?permissions?.registrarCuenta:resource==='compromisos'?permissions?.registrarCompromiso:resource==='conciliaciones-pago'?permissions?.elaborarConciliacion:false;
  const createLabels:Partial<Record<CxpAdminResource,string>>={parametros:'Nuevo parámetro','reglas-aprobacion':'Nueva regla',periodos:'Crear y abrir período','cuentas-bancarias':'Registrar cuenta',compromisos:'Registrar compromiso','conciliaciones-pago':'Registrar referencia de pago'};
  const display=(row:CxpAdminRow,name:string)=>{
    const value=row.registro[name],field=entity.fields.find(f=>f.name===name);
    if(row.etiquetas[name])return row.etiquetas[name];
    if(value!=null&&field?.type==='number'&&!field.integer)return `${new Intl.NumberFormat('es-GT',{maximumFractionDigits:6}).format(Number(value))}${row.registro.moneda?` ${row.registro.moneda}`:''}`;
    return text(value);
  };
  const links=Object.entries(adminViews).filter(([,config])=>config.group===view.group);
  return <CxpLayout resource={resource}><div className="space-y-5">
    <CxpPageHeader title={view.title} description={view.description} group={view.group} actions={<><CxpButton variant="secondary" icon={RefreshCw} disabled={loading} onClick={()=>setReload(n=>n+1)}>Actualizar</CxpButton>{canCreate&&<CxpButton onClick={()=>setEditor({resource})}>{createLabels[resource]}</CxpButton>}</>}/>
    <nav className="flex flex-wrap gap-2" aria-label={`Vistas de ${view.group}`}>{links.map(([key,config])=><Link key={key} to={adminPath(key as CxpAdminResource)} aria-current={key===resource?'page':undefined} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${key===resource?'border-blue-200 bg-blue-50 text-blue-700':'border-slate-200 bg-white text-slate-600'}`}>{config.title}</Link>)}</nav>
    <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600"><summary className="cursor-pointer font-semibold text-slate-900">Cómo utilizar esta vista</summary><p className="mt-2">{view.help}</p></details>
    {resource==='periodos'&&<PeriodoConsultaPanel/>}
    {resource==='parametros'&&<FacturaConfiguracionPanel/>}
    {resource==='conciliaciones-proveedor'&&<ConciliacionPrepararPanel canPrepare={!!permissions?.elaborarConciliacion} onSaved={saved}/>}
    {permissionError&&<p role="alert" className="rounded bg-amber-50 p-3 text-sm text-amber-900">No se pudieron comprobar las acciones de tu rol: {permissionError}. Actualiza para reintentar.</p>}
    {notice&&<p role="status" className="rounded bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <section aria-label={`Filtros de ${view.title}`} className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <TextInput id="admin-buscar" label="Buscar referencia o descripción" icon={Search} value={search} onChange={event=>setSearch(event.target.value)} className="min-w-52 flex-1"/>
      {view.filters.map(name=>{const field=entity.fields.find(f=>f.name===name)!;return <div key={name} className="w-full sm:w-52">{field.lookup?<RelationSelect id={`admin-${name}`} label={field.label} catalog={field.lookup} value={filters[name]??''} onChange={value=>filter(name,value)} allowCreate={false} placeholder="Todos"/>:field.options?<Select id={`admin-${name}`} label={field.label} value={filters[name]??''} placeholder="" options={[{value:'',label:'Todos'},...field.options.map(value=>({value,label:text(value)}))]} onChange={event=>filter(name,event.target.value)}/>:<TextInput id={`admin-${name}`} label={field.label} value={filters[name]??''} onChange={event=>filter(name,event.target.value)}/>}</div>;})}
      <CxpButton variant="ghost" onClick={()=>{setFilters({});setSearch('');setTerm('');setPage(1);}}>Limpiar filtros</CxpButton>
    </section>
    {error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <DataTable data={result?.data??[]} isLoading={loading} emptyText={error?'La información no está disponible.':view.empty} columns={[
      ...view.fields.map(name=>({header:entity.fields.find(field=>field.name===name)?.label??text(name),cell:({row}:{row:CxpAdminRow})=><span className="block max-w-64 break-words text-sm">{display(row,name)}</span>})),
      {header:'Consulta',cell:({row}:{row:CxpAdminRow})=><CxpButton icon={Eye} size="sm" variant="secondary" aria-label={`Ver detalle ${row.registro[entity.idField]}`} onClick={()=>setSelected(Number(row.registro[entity.idField]))}>Ver detalle</CxpButton>},
    ]}/>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600"><span>{result?.meta.total??0} registros · Página {page} de {Math.max(1,result?.meta.totalPages??1)}</span><div className="flex gap-2"><CxpButton variant="secondary" icon={ChevronLeft} disabled={loading||page<=1} onClick={()=>setPage(n=>n-1)}>Anterior</CxpButton><CxpButton variant="secondary" icon={ChevronRight} disabled={loading||page>=Math.max(1,result?.meta.totalPages??1)} onClick={()=>setPage(n=>n+1)}>Siguiente</CxpButton></div></div>
    <CxpManagementDialog isOpen={selected!==null} onClose={close} title={view.title} description="Referencias, resultado y trazabilidad del registro">
      {detailLoading&&<p role="status">Consultando detalle…</p>}{detailError&&<p role="alert" className="text-sm text-red-700">{detailError}</p>}
      {detail&&<div className="space-y-5">
        {permissions?.configuracion&&['parametros','reglas-aprobacion'].includes(resource)&&!(resource==='parametros'&&detail.item.registro.grupoParametro==='CXP_FACTURA_ESPECIAL'&&String(detail.item.registro.codigo).startsWith('CORRELATIVO_'))&&<CxpButton variant="secondary" disabled={resource==='reglas-aprobacion'&&detail.hechos.some(f=>f.nombre==='Solicitudes o decisiones vinculadas'&&Number(f.valor)>0)} onClick={()=>setEditor({resource,record:detail.item.registro,version:detail.version})}>Editar configuración</CxpButton>}
        {permissions?.periodos&&resource==='periodos'&&<div className="flex flex-wrap gap-2">{(detail.item.registro.estado==='CERRADO'?['reabrir']:['ABIERTO','REABIERTO'].includes(String(detail.item.registro.estado))?['iniciar-cierre','cerrar']:['cerrar']).map(name=><CxpButton key={name} variant="secondary" onClick={()=>setAction(name)}>{name==='reabrir'?'Reabrir período':name==='cerrar'?'Cerrar período':'Iniciar cierre'}</CxpButton>)}</div>}
        {permissions?.decidirCuenta&&resource==='cuentas-bancarias'&&detail.item.registro.estado==='ACTIVA'&&['PENDIENTE','REQUIERE_REVALIDACION'].includes(String(detail.item.registro.estadoAprobacion))&&<div className="space-y-2"><div className="flex flex-wrap gap-2"><CxpButton disabled={Number(detail.item.registro.creadoPor)===session?.actor?.id} onClick={()=>setAction('aprobar')}>Aprobar cuenta CXP</CxpButton><CxpButton variant="danger" onClick={()=>setAction('rechazar')}>Rechazar cuenta CXP</CxpButton></div>{Number(detail.item.registro.creadoPor)===session?.actor?.id&&<p className="text-sm text-amber-800">No puedes aprobar una cuenta que registraste.</p>}</div>}
        {detail.conciliacion&&<section className="space-y-3"><h3 className="font-bold text-slate-900">Comparación por referencia · {detail.conciliacion.moneda??'Moneda no documentada'}</h3>
          {detail.conciliacion.impedimentos.length>0&&<div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><p className="font-semibold">Pendiente antes del cierre</p>{detail.conciliacion.impedimentos.map((msg,i)=><p key={i}>{msg}</p>)}</div>}
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Referencia','Fecha empresa','Fecha proveedor','Importe empresa','Importe proveedor','Diferencia','Resultado','Revisión'].map(label=><th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{detail.conciliacion.lineas.map(line=><tr key={Number(line.idDetConciliacion)} className="border-t"><td className="p-2">{line.referenciaProveedor||detail.item.etiquetas.idProveedor||`Detalle #${line.idDetConciliacion}`}</td><td>{text(line.fechaEmpresa)}</td><td>{text(line.fechaProveedor)}</td><td>{line.montoEmpresa}</td><td>{text(line.montoProveedor)}</td><td>{line.diferencia}</td><td>{text(line.resultado)}</td><td>{permissions?.elaborarConciliacion&&detail.item.registro.estado!=='CERRADA'&&<CxpButton variant="secondary" size="sm" onClick={()=>setEditor({resource:'conciliaciones-proveedor-detalle',record:line,version:detail.version,parentId:selected!})}>Registrar comparación</CxpButton>}</td></tr>)}</tbody></table>{!detail.conciliacion.lineas.length&&<p className="p-3 text-sm text-slate-500">Sin detalles; no se puede cerrar.</p>}</div>
          {permissions?.cerrarConciliacion&&detail.item.registro.estado!=='CERRADA'&&<><CxpButton disabled={!!detail.conciliacion.impedimentos.length||!detail.conciliacion.moneda||detail.item.registro.estado!=='CONCILIADA'||Number(detail.item.registro.elaboradaPor)===session?.actor?.id} onClick={()=>setAction('cerrar')}>Cerrar conciliación</CxpButton>{Number(detail.item.registro.elaboradaPor)===session?.actor?.id&&<p className="text-sm text-amber-800">Debe cerrar otra persona de Tesorería distinta de quien elaboró esta conciliación.</p>}</>}
        </section>}
        {detail.avisos.map((message,index)=><p key={index} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{message}</p>)}
        {!!detail.hechos.length&&<dl className="grid gap-4 sm:grid-cols-2">{detail.hechos.map((fact,index)=><div key={index}><dt className="text-xs text-slate-500">{fact.nombre}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-900">{fact.valor}</dd></div>)}</dl>}
        {!!detail.relacionados.length&&<section className="space-y-2"><h3 className="text-sm font-bold text-slate-900">Operaciones relacionadas</h3>{detail.relacionados.map((ref,index)=><div key={index} className="rounded-lg border border-slate-200 p-3 text-sm"><p className="font-semibold">{ref.titulo} · {ref.referencia}</p><p>{text(ref.estado)}{ref.moneda?` · ${ref.moneda}`:''}{ref.monto!=null?` · ${new Intl.NumberFormat('es-GT').format(ref.monto)}`:''}</p>{ref.ruta&&<Link to={ref.ruta} onClick={()=>{if(ref.idPago)sessionStorage.setItem('cxp.openProcessId',String(ref.idPago));}} className="mt-1 inline-block font-semibold text-blue-700 underline">Abrir operación</Link>}</div>)}</section>}
        <details open className="border-t border-slate-200 pt-4"><summary className="cursor-pointer text-sm font-bold">Datos y auditoría</summary><dl className="mt-4 grid gap-4 sm:grid-cols-2">{entity.fields.filter(field=>detail.item.registro[field.name]!=null).map(field=><div key={field.name}><dt className="text-xs text-slate-500">{field.label}</dt><dd className="mt-1 max-h-40 overflow-auto break-words text-sm text-slate-800">{display(detail.item,field.name)}</dd></div>)}</dl></details>
      </div>}
    </CxpManagementDialog>
    {editor&&<OperacionDialog {...editor} onClose={()=>setEditor(null)} onSaved={saved}/>}
    {action&&detail&&selected&&<AccionAdministrativaDialog resource={resource} id={selected} action={action} detail={detail} onClose={()=>setAction('')} onSaved={saved}/>}
  </div></CxpLayout>;
}
