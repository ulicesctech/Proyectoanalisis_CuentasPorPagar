import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Calculator, Check } from 'lucide-react';
import { calcularCxpFacturaEspecialSchema, createCxpFacturaEspecialSchema, cxpToday, type CxpCalculoFacturaEspecial, type CxpFacturaEspecialConfiguracion, type CxpFacturaEspecialDetalle } from '@erp/contracts';
import { Select, TextArea, TextInput } from '../../../../shared/ui-kit';
import { CxpButton as Button } from '../../components/CxpButton';
import { CxpCaptureSteps } from '../../components/CxpSteps';
import { CxpCaptureSectionHeading, captureTitleClass, captureSubtitleClass, captureFooterClass } from '../../components/CxpCaptureSection';
import { useDocumentoMonedas } from '../../documentos/components/DocumentoMonedaControl';
import { RelationSelect } from '../../components/RelationSelect';
import { errorDe, facturasEspecialesApi, formatoMonto, type ResultadoAccion } from '../api';
import { UsuarioOperacionCampo, useUsuarioOperacion } from './UsuarioOperacion';
import { useCxpPendingChanges } from '../../components/CxpFormGuard';
import { CxpNitInput, useCxpProveedorIdentity } from '../../components/CxpProveedorIdentity';

type Valores = Record<string, string>;
const pasos = ['Proveedor y operación', 'Importes y tributos', 'Revisión'];
const camposIdentificacion = ['idProveedor', 'proveedorNombre', 'proveedorNit', 'proveedorCui', 'proveedorDireccion', 'idSucursal', 'referenciaExterna', 'fechaDocumento', 'fechaVencimiento', 'descripcionOperacion'];

const inicial = (factura?: CxpFacturaEspecialDetalle | null): Valores => ({
  idProveedor: factura ? String(factura.idProveedor) : '',
  proveedorNombre: factura?.proveedorNombre ?? '',
  proveedorNit: factura?.proveedorNit ?? '',
  proveedorCui: factura?.proveedorCui ?? '',
  proveedorDireccion: factura?.proveedorDireccion ?? '',
  idSucursal: factura ? String(factura.idSucursal) : '',
  fechaDocumento: factura?.fechaDocumento ?? cxpToday(),
  fechaVencimiento: factura?.fechaVencimiento ?? '',
  referenciaExterna: factura?.referenciaExterna ?? '',
  descripcionOperacion: factura?.descripcionOperacion ?? '',
  moneda: factura?.moneda ?? 'GTQ',
  tipoCambio: factura ? String(factura.tipoCambio) : '1',
  subtotal: factura ? String(factura.subtotal) : '',
  descuentoTotal: factura ? String(factura.descuentoTotal) : '0',
  idDepartamento: factura?.idDepartamento ? String(factura.idDepartamento) : '',
  centroCosto: factura?.centroCosto ?? '',
  cuentaContable: factura?.cuentaContable ?? '',
  observaciones: factura?.observaciones ?? '',
});

const numero = (value: string) => (value.trim() === '' ? Number.NaN : Number(value));
const opcional = (value: string) => (value.trim() === '' ? null : value.trim());

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <section aria-label={titulo} className="space-y-4 border-t border-slate-100 pt-5">
    <CxpCaptureSectionHeading>{titulo}</CxpCaptureSectionHeading>
    {children}
  </section>;
}

export function FacturaEspecialForm({ factura, onSuccess, onCancel, onStatusChange }: {
  factura?: CxpFacturaEspecialDetalle | null; onSuccess: (resultado: ResultadoAccion) => void; onCancel: () => void;
  onStatusChange?: (status: { dirty: boolean; busy: boolean }) => void;
}) {
  const [usuario] = useUsuarioOperacion();
  const [valores, setValores] = useState<Valores>(() => inicial(factura));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [calculo, setCalculo] = useState<CxpCalculoFacturaEspecial | null>(null);
  const [calculoError, setCalculoError] = useState<string | null>(null);
  const [calculoLoading, setCalculoLoading] = useState(false);
  const [paso, setPaso] = useState(0);
  const title = useRef<HTMLHeadingElement>(null);
  const baseline = useRef(JSON.stringify(valores));
  const clearPending = useCxpPendingChanges(JSON.stringify(valores) !== baseline.current, guardando);
  const [proveedorLabel, setProveedorLabel] = useState(factura?.proveedorNombre ?? '');
  const automaticName = useRef('');
  const [sucursalLabel, setSucursalLabel] = useState('');
  const { config: monedas, error: monedasError } = useDocumentoMonedas();
  const [configuration,setConfiguration] = useState<CxpFacturaEspecialConfiguracion | null>(null);
  const [configurationError,setConfigurationError] = useState('');
  const [configurationLoading,setConfigurationLoading] = useState(true);
  const [configurationAttempt,setConfigurationAttempt] = useState(0);
  useEffect(() => {
    let active=true; setConfiguration(null);setConfigurationError('');
    if (!calcularCxpFacturaEspecialSchema.pick({fechaDocumento:true,moneda:true}).safeParse({fechaDocumento:valores.fechaDocumento,moneda:valores.moneda}).success) {setConfigurationLoading(false);return;}
    setConfigurationLoading(true);
    const timer=window.setTimeout(() => {facturasEspecialesApi.configuracion(valores.fechaDocumento,valores.moneda)
      .then(result=>{if(active)setConfiguration(result);}).catch(reason=>{if(active)setConfigurationError(errorDe(reason).mensaje);})
      .finally(()=>{if(active)setConfigurationLoading(false);});},200);
    return()=>{active=false;window.clearTimeout(timer);};
  },[valores.fechaDocumento,valores.moneda,configurationAttempt]);
  useEffect(() => { title.current?.focus(); }, [paso]);
  useEffect(() => { onStatusChange?.({ dirty: JSON.stringify(valores) !== baseline.current, busy: guardando }); }, [valores, guardando, onStatusChange]);
  const set = (campo: string) => (value: string) => { setValores(actual => ({ ...actual, [campo]: value })); setErrores(({ [campo]: _, ...resto }) => resto); };
  const identity = useCxpProveedorIdentity({idProveedor:valores.idProveedor,nit:valores.proveedorNit,onNit:set('proveedorNit'),onSelect:supplier=>{
    const previousAutomatic = automaticName.current;
    setValores(current=>({...current,idProveedor:supplier?String(supplier.idProveedor):'',...(supplier?{
      proveedorNit:supplier.nit??'',proveedorNombre:!current.proveedorNombre||current.proveedorNombre===previousAutomatic?supplier.nombre:current.proveedorNombre}:{} )}));
    if(supplier)automaticName.current=supplier.nombre;setProveedorLabel(supplier?.nombre??'');setErrores({});
  }});
  const input = (campo: string) => ({
    id: `fe-${campo}`, value: valores[campo], error: errores[campo],
    'aria-invalid': !!errores[campo] || undefined,
    onBlur: () => {
      const result = createCxpFacturaEspecialSchema.safeParse(datos);
      if (!result.success) { const issue = result.error.issues.find(item => item.path[0] === campo); if (issue) setErrores(actual => ({ ...actual, [campo]: issue.message })); }
    },
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(campo)(event.target.value),
  });

  // Vista previa del cálculo con las reglas vigentes en la fecha de la operación.
  useEffect(() => {
    const subtotal = numero(valores.subtotal);
    setCalculo(null); setCalculoError(null);
    const previewInput = calcularCxpFacturaEspecialSchema.safeParse({fechaDocumento:valores.fechaDocumento,moneda:valores.moneda,subtotal,descuentoTotal:numero(valores.descuentoTotal)});
    if (!previewInput.success || subtotal <= 0 || numero(valores.descuentoTotal) > subtotal) { setCalculoLoading(false); return; }
    let activo = true;
    setCalculoLoading(true);
    const timer = window.setTimeout(() => {
      facturasEspecialesApi.calcular(previewInput.data)
        .then(result => { if (activo) { setCalculo(result); setCalculoError(null); } })
        .catch(reason => { if (activo) { setCalculo(null); setCalculoError(errorDe(reason).mensaje); } })
        .finally(() => { if (activo) setCalculoLoading(false); });
    }, 300);
    return () => { activo = false; window.clearTimeout(timer); };
  }, [valores.fechaDocumento, valores.moneda, valores.subtotal, valores.descuentoTotal]);

  const datos = {
      idProveedor: numero(valores.idProveedor), idSucursal: numero(valores.idSucursal), fechaDocumento: valores.fechaDocumento,
      fechaVencimiento: opcional(valores.fechaVencimiento), moneda: valores.moneda.trim(), tipoCambio: numero(valores.tipoCambio),
      subtotal: numero(valores.subtotal), descuentoTotal: numero(valores.descuentoTotal), referenciaExterna: valores.referenciaExterna.trim(),
      proveedorNombre: opcional(valores.proveedorNombre), proveedorNit: opcional(valores.proveedorNit), proveedorCui: opcional(valores.proveedorCui),
      proveedorDireccion: opcional(valores.proveedorDireccion), descripcionOperacion: valores.descripcionOperacion.trim(),
      idDepartamento: valores.idDepartamento ? numero(valores.idDepartamento) : null, centroCosto: opcional(valores.centroCosto),
      cuentaContable: opcional(valores.cuentaContable), observaciones: opcional(valores.observaciones), usuario: Number(usuario),
    };
  const guardar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (guardando) return;
    if (!usuario) { setMensaje('No hay un usuario CXP autenticado para guardar.'); return; }
    setMensaje(null);
    // Mismo esquema que valida el servidor: los errores se muestran junto a cada campo.
    const validacion = createCxpFacturaEspecialSchema.safeParse(datos);
    const issues = validacion.success ? [] : validacion.error.issues.filter(issue => paso === 2 || (paso === 0 ? camposIdentificacion.includes(String(issue.path[0])) : !camposIdentificacion.includes(String(issue.path[0]))));
    if (issues.length) {
      const found = Object.fromEntries(issues.map(issue => [String(issue.path[0] ?? ''), issue.message]));
      setErrores(found);
      setMensaje('Revisa los campos indicados.');
      if (paso === 2) setPaso(camposIdentificacion.includes(String(issues[0].path[0])) ? 0 : 1);
      const field = String(issues[0].path[0]);
      window.setTimeout(() => document.getElementById(`fe-${field === 'idProveedor' ? 'proveedor' : field === 'idSucursal' ? 'sucursal' : field}`)?.focus(), 0);
      return;
    }
    if (paso > 0 && (calculoLoading || !calculo || calculoError)) { setMensaje(calculoError || 'Espera a confirmar el cálculo tributario del servidor.'); return; }
    if (paso < 2) { setErrores({}); setPaso(paso + 1); return; }
    if (!validacion.success) return;
    if (!factura && (!configuration?.puedeRegistrar || configurationLoading)) {setMensaje(configuration?.impedimentos.join(' ') || configurationError || 'Espera a comprobar la configuración. Tus datos se conservarán.');return;}
    setGuardando(true);
    try {
      const result = factura ? await facturasEspecialesApi.update(factura.idDocumento, datos) : await facturasEspecialesApi.create(datos);
      baseline.current = JSON.stringify(valores); clearPending();
      onSuccess(result);
    } catch (reason) {
      const { mensaje: texto, campos } = errorDe(reason);
      setMensaje(texto);
      setErrores(campos);
      if (Object.keys(campos).length) setPaso(Object.keys(campos).some(key => camposIdentificacion.includes(key)) ? 0 : 1);
    } finally { setGuardando(false); }
  };

  return <form onSubmit={guardar} className="space-y-5" noValidate>
    <CxpCaptureSteps steps={pasos} current={paso} label="Pasos de factura especial" />
    <div><h3 ref={title} tabIndex={-1} className={captureTitleClass}>{pasos[paso]}</h3>
      <p className={captureSubtitleClass}>{paso === 0 ? 'Identifica al proveedor y describe la operación recibida.' : paso === 1 ? 'Revisa los importes y los tributos calculados por el servidor.' : 'Confirma los datos antes de guardar la factura en preparación.'}</p></div>
    {mensaje && <p role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{mensaje}</p>}
    <UsuarioOperacionCampo />
    {(configurationLoading || configurationError || configuration?.impedimentos.length || configuration?.advertencias.length) && <aside aria-label="Configuración de factura especial" className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      {configurationLoading && <p role="status">Comprobando serie, numeración y reglas para {valores.fechaDocumento} · {valores.moneda}…</p>}
      {configurationError && <p role="alert">No se pudo comprobar la configuración: {configurationError}</p>}
      {configuration?.impedimentos.map(message=><p key={message} role="alert">{message}</p>)}
      {configuration?.advertencias.map(message=><p key={message}>{message}</p>)}
      <div className="flex flex-wrap items-center gap-3"><a href="/cxp/parametros" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Abrir parámetros en otra pestaña</a>
        <a href="/cxp/reglas-tributarias" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Abrir reglas tributarias</a>
        <Button size="sm" variant="secondary" disabled={configurationLoading} onClick={()=>setConfigurationAttempt(n=>n+1)}>Volver a comprobar</Button></div>
      <p className="text-xs">Puedes corregir la configuración y volver a comprobar sin cerrar este formulario ni perder la captura.</p>
    </aside>}
    <fieldset hidden={paso !== 0} disabled={guardando || paso !== 0} className="space-y-5 min-w-0">
    <Seccion titulo="Proveedor">
      <RelationSelect id="fe-proveedor" catalog="proveedores" label="Proveedor" required value={valores.idProveedor} onChange={id=>void identity.choose(id)} onLabelChange={setProveedorLabel} error={errores.idProveedor} />
      {(identity.loading||identity.error||identity.message)&&<p role={identity.error?'alert':'status'} className="text-xs text-slate-600">{identity.loading?'Consultando proveedor…':identity.error||identity.message}{identity.error&&<button type="button" className="ml-2 underline" onClick={identity.retry}>Reintentar</button>}</p>}
      <div className="grid sm:grid-cols-2 gap-4">
        <TextInput {...input('proveedorNombre')} label="Nombre en la factura" placeholder="Se toma del proveedor si se deja vacío" maxLength={200} helperText="Si lo modificas, se conserva al cambiar de proveedor; revisa que corresponda al comprobante." />
        <TextInput {...input('proveedorDireccion')} label="Dirección" placeholder="Ej: Aldea El Progreso, Chimaltenango" maxLength={300} />
        <CxpNitInput id="fe-proveedorNit" label="NIT" value={valores.proveedorNit} error={errores.proveedorNit} disabled={guardando}
          onChange={identity.editNit} onPick={supplier=>void identity.pick(supplier,true)} helperText="Identifica al proveedor. El nombre y dirección de la factura son datos de esta operación." />
        <TextInput {...input('proveedorCui')} label="CUI / DPI" placeholder="Obligatorio si el proveedor no tiene NIT" maxLength={20} />
      </div>
    </Seccion>
    <Seccion titulo="Operación">
      <div className="grid sm:grid-cols-2 gap-4">
        <RelationSelect id="fe-sucursal" catalog="sucursales" label="Sucursal" required value={valores.idSucursal} onChange={set('idSucursal')} onLabelChange={setSucursalLabel} error={errores.idSucursal} />
        <TextInput {...input('referenciaExterna')} label="Referencia de la operación" required placeholder="Ej: boleta o recibo del proveedor" maxLength={120}
          helperText="Evita registrar dos veces la misma operación del proveedor." />
        <TextInput {...input('fechaDocumento')} label="Fecha de la operación" required type="date" max={cxpToday()}
          helperText="Determina las reglas tributarias vigentes que se aplican." />
        <TextInput {...input('fechaVencimiento')} label="Fecha de vencimiento" type="date" min={valores.fechaDocumento} />
      </div>
      <TextArea {...input('descripcionOperacion')} label="Descripción de la operación" required rows={3} maxLength={1000}
        placeholder="Bienes o servicios adquiridos, cantidad y condiciones" />
    </Seccion>
    </fieldset>
    <fieldset hidden={paso !== 1} disabled={guardando || paso !== 1} className="space-y-5 min-w-0">
    <Seccion titulo="Montos y tributos">
      <div className="grid sm:grid-cols-4 gap-4">
        <TextInput {...input('subtotal')} label="Monto de la operación" required type="number" min="0" step="0.01" placeholder="Ej: 1500.00" />
        <TextInput {...input('descuentoTotal')} label="Descuento" type="number" min="0" step="0.01" />
        <Select id="fe-moneda" label="Moneda" required value={valores.moneda} error={monedasError || errores.moneda} isReadOnly={!monedas}
          options={[...(monedas?.monedas ?? []).map(row => ({ value: row.codigo, label: `${row.nombre} (${row.codigo})` })),
            ...(!monedas?.monedas.some(row => row.codigo === valores.moneda) ? [{value:valores.moneda,label:valores.moneda}] : [])]}
          onChange={event => { set('moneda')(event.target.value); set('tipoCambio')(event.target.value === monedas?.monedaLocal ? '1' : ''); }} />
        <TextInput {...input('tipoCambio')} label="Tipo de cambio" required type="number" min="0" step="0.00000001" isReadOnly={valores.moneda === monedas?.monedaLocal}
          helperText={valores.moneda === monedas?.monedaLocal ? 'Moneda local: tipo de cambio 1.' : `Unidades de ${monedas?.monedaLocal ?? 'moneda local'} por unidad del documento. Ingresa la tasa de la operación.`} />
      </div>
      <div className="border border-slate-200 rounded-lg bg-slate-50 p-4">
        <p className="text-xs font-semibold text-slate-700 flex items-center gap-2 mb-3"><Calculator size={14} /> Cálculo con las reglas vigentes</p>
        {calculoLoading ? <p role="status" className="text-sm text-slate-500">Calculando con las reglas vigentes…</p> : calculoError ? <p role="alert" className="text-sm text-red-700">{calculoError}</p>
          : !calculo ? <p className="text-sm text-slate-500">Ingresa la fecha y el monto para ver los tributos.</p>
          : <div className="space-y-3 text-sm">
            {calculo.tributos.length === 0 && <p className="text-amber-800">No hay reglas tributarias vigentes para esta fecha, moneda y monto. Puedes guardar en preparación; configura las reglas antes de enviar a revisión.</p>}
            {calculo.tributos.map(tributo => <div key={tributo.idReglaTributaria} className="flex justify-between gap-3">
              <span className="text-slate-600">{tributo.nombreTributo} · {tributo.porcentaje}% <span className="text-xs text-slate-400">({tributo.codigoRegla} v{tributo.versionRegla})</span></span>
              <span className={`font-semibold ${tributo.tipoTributo === 'RETENCION' ? 'text-red-700' : 'text-slate-900'}`}>{tributo.tipoTributo === 'RETENCION' ? '−' : '+'} {formatoMonto(tributo.monto, valores.moneda)}</span>
            </div>)}
            <div className="border-t border-slate-200 pt-2 flex justify-between"><span className="font-semibold text-slate-900">Total a pagar al proveedor</span>
              <span className="font-bold text-slate-900">{formatoMonto(calculo.totalNeto, valores.moneda)}</span></div>
          </div>}
      </div>
    </Seccion>
    <Seccion titulo="Información contable (opcional)">
      <div className="grid sm:grid-cols-3 gap-4">
        <RelationSelect id="fe-departamento" catalog="departamentos" label="Departamento" value={valores.idDepartamento} onChange={set('idDepartamento')} />
        <TextInput {...input('centroCosto')} label="Centro de costo" maxLength={50} />
        <TextInput {...input('cuentaContable')} label="Cuenta contable" maxLength={50} />
      </div>
      <TextArea {...input('observaciones')} label="Observaciones" rows={2} maxLength={1500} />
    </Seccion>
    </fieldset>
    {paso === 2 && <section aria-label="Revisión de factura especial" className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
      <dl className="grid sm:grid-cols-2 gap-4">
        <div><dt className="text-xs text-slate-500">Proveedor</dt><dd className="font-semibold">{valores.proveedorNombre || proveedorLabel}</dd></div>
        <div><dt className="text-xs text-slate-500">Sucursal</dt><dd>{sucursalLabel}</dd></div>
        <div><dt className="text-xs text-slate-500">Referencia y fecha</dt><dd>{valores.referenciaExterna} · {valores.fechaDocumento}</dd></div>
        <div><dt className="text-xs text-slate-500">Vencimiento</dt><dd>{valores.fechaVencimiento || 'Sin fecha de vencimiento indicada'}</dd></div>
        <div><dt className="text-xs text-slate-500">NIT o CUI</dt><dd>{valores.proveedorNit || valores.proveedorCui || 'El servidor tomará el NIT del proveedor; si no tiene, solicitará NIT o CUI.'}</dd></div>
        <div><dt className="text-xs text-slate-500">Moneda y tipo de cambio</dt><dd>{valores.moneda} · {valores.tipoCambio}</dd></div>
      </dl>
      <p>{valores.descripcionOperacion}</p>
      {calculo?.tributos.map(t => <p key={t.idReglaTributaria}>{t.nombreTributo} · {t.codigoRegla} v{t.versionRegla}: {formatoMonto(t.monto, valores.moneda)}</p>)}
      <p className="text-lg font-bold">Total al proveedor: {formatoMonto(calculo?.totalNeto, valores.moneda)}</p>
      <p>Se guardará en <strong>PREPARACIÓN</strong>. Después podrás enviarla a revisión; la aprobación por rol y la emisión requieren sus propias autorizaciones.</p>
    </section>}
    <div className={captureFooterClass}>
      <span className="text-xs text-slate-500">Paso {paso + 1} de 3</span>
      <div className="flex flex-wrap gap-2">
      <Button type="button" variant="secondary" onClick={onCancel} disabled={guardando}>Cancelar</Button>
      {paso > 0 && <Button variant="secondary" disabled={guardando} onClick={() => { setPaso(paso - 1); setMensaje(null); }}>Anterior</Button>}
      <Button type="submit" icon={paso < 2 ? ArrowRight : Check} disabled={guardando || (paso > 0 && calculoLoading) || (paso===2 && !factura && (!configuration?.puedeRegistrar || configurationLoading))}>{paso < 2 ? 'Continuar' : guardando ? 'Guardando…' : factura ? 'Guardar cambios' : 'Registrar factura especial'}</Button>
      </div>
    </div>
  </form>;
}
