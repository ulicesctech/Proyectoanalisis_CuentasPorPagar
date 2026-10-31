import { useEffect, useRef, useState } from 'react';
import {
  calcularDocumentoComponentes, componenteLineaDatos, componenteTributoDatos, cxpMoneySum, getCxpEntity,
  type CxpConceptoLinea, type CxpConceptoTributo, type CxpDocumentoComponentesContexto, type CxpRecord, type CxpTributosOpciones,
} from '@erp/contracts';
import { Select, TextInput } from '../../../../shared/ui-kit';
import { CxpButton as Button } from '../../components/CxpButton';
import { useCxpFormGuard, useCxpPendingChanges } from '../../components/CxpFormGuard';
import { draftFingerprint } from '../../components/draftFingerprint';
import { SearchableSelect } from '../../components/SearchableSelect';
import { Modal } from '../../../../shared/components';
import { apiClient, ApiError } from '../../api';
import { useAuth } from '../../auth/session';
import { componentData, componentErrors, componentFormValues, serializeComponents, taxFormData } from '../documentoComponentesForm';
import { cxpFormNumber } from '../../components/cxpFormValues';
import { formatDocumentoMoney } from '../documentoView';

type LineDraft = { row: CxpConceptoLinea; values: Record<string, string> };
type TaxDraft = { row: CxpConceptoTributo; values: Record<string, string> };
const lineExtra = ['codigoArticulo', 'unidadMedida', 'idDetalleOc', 'idDetalleRecepcion', 'cuentaContable', 'centroCosto', 'idDepartamento', 'proyecto',
  'cantidadOrdenada', 'cantidadRecibida', 'cantidadFacturada', 'precioOrdenado', 'precioFacturado'];
const newKey = () => crypto.randomUUID();
const labels: Record<string, string> = { subtotal: 'Subtotal antes de descuentos', descuentoTotal: 'Descuentos', impuestoTotal: 'Impuestos', retencionTotal: 'Retenciones', totalNeto: 'Neto' };

export function DocumentoComponentesPanel({ id, onSaved, onDirtyChange }: { id: number; onSaved?: () => void; onDirtyChange?: (value: boolean) => void }) {
  const { session } = useAuth();
  const [context, setContext] = useState<CxpDocumentoComponentesContexto | null>(null);
  const [lineas, setLines] = useState<CxpConceptoLinea[]>([]), [tributos, setTaxes] = useState<CxpConceptoTributo[]>([]);
  const [removed, setRemoved] = useState<number[]>([]);
  const baseline = useRef(''), draftBaseline = useRef(''), savingRef = useRef(false);
  const { confirm, discard } = useCxpFormGuard();
  const [error, setError] = useState(''), [saving, setSaving] = useState(false), [reload, setReload] = useState(0);
  const [lineDraft, setLineDraft] = useState<LineDraft | null>(null), [taxDraft, setTaxDraft] = useState<TaxDraft | null>(null);
  const [taxOptions,setTaxOptions] = useState<CxpTributosOpciones>({identificaciones:[],reglas:[]});
  const [taxOptionsError,setTaxOptionsError] = useState(''), [taxOptionsLoading,setTaxOptionsLoading] = useState(false), [taxSearch,setTaxSearch] = useState(''), [taxAttempt,setTaxAttempt] = useState(0);
  const [touched, setTouched] = useState<Record<string, boolean>>({}), [submitted, setSubmitted] = useState(false);
  const dirty = !!context && draftFingerprint({lineas,tributos}) !== baseline.current;
  const draftDirty = !!(lineDraft ?? taxDraft) && draftFingerprint(lineDraft ?? taxDraft) !== draftBaseline.current;
  const clearPending = useCxpPendingChanges(dirty || draftDirty, saving);
  const accept = (value: CxpDocumentoComponentesContexto) => { baseline.current = draftFingerprint({lineas:value.lineas,tributos:value.tributos}); setContext(value); setLines(value.lineas); setTaxes(value.tributos); setRemoved([]); clearPending(); };
  useEffect(() => {
    onDirtyChange?.(dirty || draftDirty);
    return () => onDirtyChange?.(false);
  }, [dirty, draftDirty, onDirtyChange]);
  useEffect(() => {
    let active = true;
    setContext(null); setError('');
    apiClient.get<CxpDocumentoComponentesContexto>(`/cxp/documentos/${id}/componentes`)
      .then(value => { if (active) accept(value); }).catch(reason => { if (active) setError(reason.message || 'No se pudo cargar la captura.'); });
    return () => { active = false; };
  }, [id, reload]);
  useEffect(()=>{
    if(!context)return;let active=true;setTaxOptionsLoading(true);setTaxOptionsError('');
    apiClient.get<CxpTributosOpciones>(`/cxp/documentos/${id}/opciones-tributos`).then(next=>{if(active)setTaxOptions(next);}).catch(()=>{if(active)setTaxOptionsError('No se pudieron consultar las opciones. Puedes conservar o capturar el tributo del comprobante.');}).finally(()=>{if(active)setTaxOptionsLoading(false);});
    return()=>{active=false;};
  },[id,context?.version,taxAttempt]);
  let computed: ReturnType<typeof calcularDocumentoComponentes> | null = null;
  try { if (context) computed = calcularDocumentoComponentes(context.documento, lineas, tributos); }
  catch { /* Un desbordamiento se muestra y bloquea el guardado. */ }
  const canEdit = !!context?.editable && !!session?.actor?.permisos.includes('CREAR');
  const editable = canEdit && !saving;
  const currency = String(context?.documento.moneda ?? '');
  const money = (value: unknown) => formatDocumentoMoney(value, currency);
  const lineNumber = (row?: CxpConceptoLinea) => !row ? 'sin referencia' : row.numeroLinea ?? Math.max(0, ...(context?.lineas ?? []).map(line => line.numeroLinea ?? 0)) + lineas.filter(line => !line.idDetalle).findIndex(line => line.clave === row.clave) + 1;
  const resetModal = () => { setTouched({}); setSubmitted(false); };
  const openLine = (row?: CxpConceptoLinea) => {
    const next = { row: row ?? { clave: newKey(), datos: {} as CxpConceptoLinea['datos'] }, values: componentFormValues('documentos-detalle', row?.datos as CxpRecord | undefined) };
    draftBaseline.current = draftFingerprint(next); resetModal(); setLineDraft(next);
  };
  const reference = (line: string | null) => line === null
    ? cxpMoneySum(...(computed?.lineas ?? []).map(row => Number(row.datos.subtotal)))
    : Number(computed?.lineas.find(row => row.clave === line)?.datos.subtotal ?? 0);
  const openTax = (row?: CxpConceptoTributo, line: string | null = null) => {
    const next: TaxDraft = { row: row ?? { clave: newKey(), linea: line, calculo: 'PORCENTAJE', base: 'DERIVADA',
      tratamiento: 'NO_RECUPERABLE', baseRevisadaPara: reference(line), datos: {} as CxpConceptoTributo['datos'] },
      values: componentFormValues('documentos-tributos', row?.datos as CxpRecord | undefined) };
    draftBaseline.current = draftFingerprint(next); resetModal(); setTaxDraft(next);
  };
  const deleteTax = async (row: CxpConceptoTributo) => {
    if (!await confirm({title:'Quitar tributo',description:`Quitar el tributo ${row.datos.nombreTributo}. La eliminación se registrará al guardar los conceptos.`,stay:'Conservar',discard:'Quitar tributo'})) return;
    setTaxes(current => current.filter(item => item.clave !== row.clave));
    if (row.idTributo) setRemoved(current => [...current, row.idTributo!]);
  };
  const deleteLine = async (row: CxpConceptoLinea) => {
    const linked = tributos.filter(tax => tax.linea === row.clave);
    if (!await confirm({title:'Quitar línea',description:`Quitar «${row.datos.descripcion}» y sus ${linked.length} tributos vinculados. Los tributos generales se conservan. Se aplicará al guardar.`,stay:'Conservar',discard:'Quitar línea'})) return;
    setLines(current => current.filter(item => item.clave !== row.clave)); setTaxes(current => current.filter(tax => tax.linea !== row.clave));
    setRemoved(current => [...current, ...linked.flatMap(tax => tax.idTributo ? [tax.idTributo] : [])]);
  };
  const draft = lineDraft ?? taxDraft;
  const taxCatalog = [...new Map([...(context?.catalogo??[]).map(row=>({...row,origen:'DOCUMENTO'})),...taxOptions.identificaciones]
    .map(row=>[`${row.tipo}:${row.codigo}:${row.nombre}`,row] as const)).values()];
  const reusable = taxCatalog.map((row,index)=>({value:String(index),label:`${row.nombre} · ${row.codigo} · ${row.tipo} · ${row.origen==='DOCUMENTO'?'Este documento':row.origen==='HISTORICO'?'Identificación histórica':'Configuración'}`}));
  const ruleBase = taxDraft?.row.base==='MANUAL'?cxpFormNumber(taxDraft.values.baseImponible):reference(taxDraft?.row.linea??null);
  const simpleRules = taxOptions.reglas.filter(rule=>rule.sobreExcedente==='N'&&!(rule.porcentaje>0&&rule.montoFijo>0)&&Number.isFinite(ruleBase)&&ruleBase>=rule.baseDesde&&(rule.baseHasta==null||ruleBase<=rule.baseHasta));
  const applyRule = async(index:number)=>{
    const rule=simpleRules[index],key=taxDraft?.row.clave;if(!rule||!key)return;
    if(!await confirm({title:'Usar valores de la regla',description:`${rule.codigoRegla} v${rule.versionRegla}: ${rule.porcentaje}% y monto fijo ${rule.montoFijo}. Solo se copiarán a este borrador; revisa su base y conciliación con el comprobante. No se actualizarán documentos históricos.`,stay:'Conservar captura',discard:'Usar regla'}))return;
    setTaxDraft(current=>current?.row.clave===key?{...current,values:{...current.values,tipoTributo:rule.tipoTributo,codigoTributo:rule.codigoTributo,nombreTributo:rule.nombreTributo,porcentaje:String(rule.porcentaje),monto:String(rule.montoFijo)},row:{...current.row,calculo:rule.montoFijo>0?'FIJO':'PORCENTAJE',baseRevisadaPara:reference(current.row.linea),tratamiento:rule.tipoTributo==='IMPUESTO'?(current.values.tipoTributo==='IMPUESTO'?current.row.tratamiento:'NO_RECUPERABLE'):'CONSERVAR'}}:current);
  };
  const resource = lineDraft ? 'documentos-detalle' : 'documentos-tributos';
  const schema = lineDraft ? componenteLineaDatos : componenteTributoDatos;
  let draftData: CxpRecord = {}, draftErrors: Record<string, string> = {}, linePreview: CxpRecord = {};
  try {
    if (lineDraft) {
      draftData = componentData('documentos-detalle', lineDraft.values);
      draftErrors = componentErrors(componenteLineaDatos, draftData);
      if (!Object.keys(draftErrors).length && context) {
        const trial = calcularDocumentoComponentes(context.documento, [{ ...lineDraft.row, datos: componenteLineaDatos.parse(draftData) }], []);
        linePreview = trial.lineas[0].datos;
        for (const issue of trial.issues) draftErrors[issue.campo.split('.').pop()!] = issue.mensaje;
      }
    } else if (taxDraft) {
      draftData = taxFormData(taxDraft.values, taxDraft.row, reference(taxDraft.row.linea));
      draftErrors = componentErrors(componenteTributoDatos, draftData);
      if (!Object.keys(draftErrors).length && context) {
        const current = { ...taxDraft.row, datos: draftData } as CxpConceptoTributo;
        const result = calcularDocumentoComponentes(context.documento, lineas, [current]);
        for (const issue of result.issues) draftErrors[issue.campo.split('.').pop()!] = issue.mensaje;
      }
    }
  } catch { draftErrors[lineDraft ? 'precioUnitario' : taxDraft?.row.calculo === 'PORCENTAJE' ? 'porcentaje' : 'monto'] = 'El cálculo supera la precisión admitida.'; }
  const changeField = (name: string, value: string) => {
    if (lineDraft) setLineDraft(current => current && ({ ...current, values: { ...current.values, [name]: value } }));
    if (taxDraft) setTaxDraft(current => current && ({ ...current, values: { ...current.values, [name]: value },
      row: { ...current.row, ...(name === 'tipoTributo' ? { tratamiento: value === 'IMPUESTO' ? current.values.tipoTributo === 'IMPUESTO' ? current.row.tratamiento : 'NO_RECUPERABLE' as const : 'CONSERVAR' as const } : {}),
        ...(['baseImponible', 'monto', 'montoRecuperable', 'montoNoRecuperable'].includes(name) ? { baseRevisadaPara: reference(current.row.linea) } : {}) } }));
    if (Number.isFinite(cxpFormNumber(value)) && (cxpFormNumber(value) < 0 || name === 'cantidad' && cxpFormNumber(value) === 0)) setTouched(current => ({ ...current, [name]: true }));
  };
  const field = (name: string, customLabel?: string, readOnly = false, customValue?: unknown) => {
    const meta = getCxpEntity(resource)!.fields.find(item => item.name === name);
    const message = (submitted || touched[name]) ? draftErrors[name] : undefined;
    return <TextInput key={name} id={`concepto-${name}`} label={customLabel ?? meta?.label ?? name}
      value={customValue === undefined ? draft?.values[name] ?? '' : String(customValue)} isReadOnly={readOnly || saving}
      inputMode={meta?.type === 'number' ? 'decimal' : undefined} maxLength={meta?.maxLength}
      error={message ? <span id={`concepto-${name}-error`} role="status">{message}</span> : undefined}
      aria-invalid={!!message || undefined} aria-describedby={message ? `concepto-${name}-error` : undefined}
      onBlur={() => setTouched(current => ({ ...current, [name]: true }))} onChange={event => changeField(name, event.target.value)} />;
  };
  const submitDraft = (event: React.FormEvent) => {
    event.preventDefault(); setSubmitted(true);
    if (Object.keys(draftErrors).length) {
      const first = Object.keys(draftErrors)[0]; window.setTimeout(() => window.document.getElementById(`concepto-${first}`)?.focus(), 0); return;
    }
    const datos = schema.parse(draftData);
    if (lineDraft) { const row = { ...lineDraft.row, datos } as CxpConceptoLinea;
      setLines(current => current.some(item => item.clave === row.clave) ? current.map(item => item.clave === row.clave ? row : item) : [...current, row]); setLineDraft(null); }
    if (taxDraft) { const row = { ...taxDraft.row, datos } as CxpConceptoTributo;
      setTaxes(current => current.some(item => item.clave === row.clave) ? current.map(item => item.clave === row.clave ? row : item) : [...current, row]); setTaxDraft(null); }
  };
  const save = async (adoptarTotales = false) => {
    if (!context || !computed || !editable || savingRef.current || (!adoptarTotales && !dirty)) return;
    if (computed.issues.length) { setError('Revisa los tributos señalados antes de guardar.'); return; }
    if (adoptarTotales && !await confirm({title:'Adoptar totales calculados',description:'Se sustituirán los totales declarados de la cabecera por el cálculo de conceptos. Confirma que coinciden con el comprobante. Los valores anteriores quedarán en el historial.',stay:'Revisar conceptos',discard:'Guardar y adoptar'})) return;
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true); setError('');
    try {
      const data = serializeComponents(computed.lineas as CxpConceptoLinea[], computed.tributos as CxpConceptoTributo[]);
      const result = await apiClient.patch<CxpDocumentoComponentesContexto>(`/cxp/documentos/${id}/componentes`, {
        ...data, version: context.version, adoptarTotales, confirmarEliminaciones: [...new Set(removed)] });
      accept(result); onSaved?.();
    } catch (reason) { setError(reason instanceof ApiError ? `${reason.message}${Array.isArray(reason.details) ? ' ' + reason.details.map(item => item.mensaje).join(' ') : ''}` : 'No se pudo guardar la captura.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  if (!context) return <section aria-label="Captura de conceptos" className="rounded-xl border bg-white p-5">
    {error ? <p role="alert">{error} <Button onClick={() => setReload(value => value + 1)}>Reintentar</Button></p> : 'Cargando líneas y tributos…'}</section>;
  return <section aria-label="Captura de conceptos" className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-slate-900">Conceptos del documento</h2>
      <p className="text-sm text-slate-600">Importes en {currency}. Los tributos alimentan impuestos y retenciones; los cambios se guardan juntos.</p></div>
      {editable && <Button onClick={() => openLine()}>Agregar línea</Button>}</div>
    {!canEdit && <p className="rounded bg-slate-50 p-3 text-sm">Consulta de conceptos. El estado, las aplicaciones, el tipo de documento o tu permiso impiden editar esta captura.</p>}
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {!!context.advertencias?.length && <div className="rounded bg-amber-50 p-3 text-sm">{context.advertencias.map((message, index) => <p key={index}>{message}</p>)}</div>}
    {!computed && <p role="alert">Los importes superan la precisión admitida; no se puede guardar.</p>}
    <div className="overflow-x-auto"><table className="w-full text-left text-sm" aria-label="Conceptos del documento"><thead className="bg-slate-50 text-xs text-slate-600"><tr>
      {['#', 'Descripción', 'Cantidad', `Precio ${currency}`, 'Descuento (importe)', 'Base', 'Impuestos', 'Retenciones', 'Total línea', 'Acciones'].map(label => <th className="p-2" key={label}>{label}</th>)}</tr></thead>
      <tbody>{(computed?.lineas ?? []).map((row, index) => <tr key={row.clave} className="border-t border-slate-100">
        <td className="p-2">{lineNumber(row as CxpConceptoLinea)}</td><td className="p-2">{row.datos.descripcion}</td>
        <td className="p-2">{row.datos.cantidad}</td>{['precioUnitario', 'descuento', 'subtotal', 'impuesto', 'retencion', 'totalLinea'].map(name => <td className="p-2 whitespace-nowrap" key={name}>{money(row.datos[name])}</td>)}
        <td className="p-2">{editable && <div className="flex gap-2"><Button variant="secondary" onClick={() => openLine(lineas.find(item => item.clave === row.clave))}>Editar</Button>
          <Button variant="secondary" onClick={() => openTax(undefined, row.clave)}>Agregar tributo</Button><Button variant="danger" onClick={() => deleteLine(row as CxpConceptoLinea)}>Quitar</Button></div>}</td>
      </tr>)}</tbody></table>{!lineas.length && <p className="p-3 text-sm text-slate-500">Agrega los conceptos del comprobante.</p>}</div>
    <div className="flex items-center justify-between"><h3 className="font-bold">Tributos</h3>{editable && <Button variant="secondary" onClick={() => openTax()}>Agregar tributo general</Button>}</div>
    <p className="text-xs text-slate-600">Los tributos generales se suman una sola vez al documento, sin distribuirlos entre líneas. El desglose recuperable no agrega cargos.</p>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm" aria-label="Tributos de conceptos"><thead className="bg-slate-50 text-xs"><tr>
      {['Tipo y código', 'Nombre', 'Aplicación', 'Base', '%', 'Monto', 'Tratamiento', 'Acciones'].map(label => <th className="p-2" key={label}>{label}</th>)}</tr></thead>
      <tbody>{(computed?.tributos ?? []).map(row => <tr className="border-t" key={row.clave}><td className="p-2">{row.datos.tipoTributo} · {row.datos.codigoTributo}</td><td className="p-2">{row.datos.nombreTributo}</td>
        <td className="p-2">{row.linea === null ? 'Documento completo' : `Línea ${lineNumber(lineas.find(line => line.clave === row.linea)!)} · ${lineas.find(line => line.clave === row.linea)?.datos.descripcion}`}</td>
        <td className="p-2">{money(row.datos.baseImponible)}</td><td className="p-2">{row.calculo === 'FIJO' ? 'Importe fijo' : row.datos.porcentaje}</td><td className="p-2">{money(row.datos.monto)}</td>
        <td className="p-2">{row.datos.tipoTributo === 'IMPUESTO' ? row.tratamiento : 'No aplica'}{row.datos.incluidoPrecio === 'S' ? ' · Incluido en precio' : ''}</td>
        <td className="p-2">{editable && <div className="flex gap-2"><Button variant="secondary" onClick={() => openTax(tributos.find(item => item.clave === row.clave))}>Editar tributo</Button><Button variant="danger" onClick={() => deleteTax(row as CxpConceptoTributo)}>Quitar</Button></div>}</td></tr>)}</tbody></table></div>
    {!!computed?.issues.length && <div role="alert" className="rounded bg-amber-50 p-3 text-sm text-amber-900">{computed.issues.map((issue, index) => <p key={index}>{issue.mensaje}</p>)}</div>}
    {!!computed?.impedimentos.length && <div role="alert" className="rounded bg-amber-50 p-3 text-sm">{computed.impedimentos.map((issue, index) => <p key={index}>{issue.mensaje}</p>)}</div>}
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4"><h3 className="font-bold">Conciliación del comprobante</h3>
      <p className="mt-1 text-xs">La declaración original no cambia al editar conceptos.</p>
      <table className="mt-3 w-full text-sm" aria-label="Declarado y calculado"><thead><tr>{['Importe', 'Declarado', 'Calculado', 'Diferencia'].map(label => <th className="p-2 text-left" key={label}>{label}</th>)}</tr></thead>
        <tbody>{computed?.diferencias.map(row => <tr key={row.campo} className={row.diferencia !== 0 ? 'text-red-700' : ''}><td className="p-2">{labels[row.campo]}</td><td>{money(row.declarado)}</td><td>{money(row.calculado)}</td><td>{money(row.diferencia)}</td></tr>)}</tbody></table>
      <p className="mt-3 text-xs text-slate-600">Guardar conceptos conserva la cabecera declarada. Adoptar totales también actualiza sus importes y registra los valores anteriores. Recargar recupera lo guardado y descarta los cambios locales confirmados.</p>
      {canEdit && <div className="mt-3 flex flex-wrap gap-2"><Button disabled={!dirty || saving || !!computed?.issues.length || !computed} onClick={() => void save(false)}>{saving ? 'Guardando conceptos…' : 'Guardar conceptos'}</Button>
        <Button variant="secondary" disabled={saving || !!computed?.issues.length || !computed || (!dirty && !computed.diferencias.some(row => row.diferencia !== 0))} onClick={() => void save(true)}>Guardar y adoptar totales calculados</Button>
        <Button variant="secondary" disabled={saving} onClick={() => void discard(() => setReload(value => value + 1), dirty)}>Recargar conceptos</Button></div>}
      <p role="status" className={`mt-2 text-xs ${dirty || draftDirty ? 'text-amber-800' : 'text-emerald-700'}`}>{saving ? 'Guardando conceptos…' : dirty || draftDirty ? 'Hay cambios pendientes sin guardar.' : 'Todos los conceptos están guardados.'}</p></div>
    <Modal isOpen={!!draft} onClose={() => void discard(() => { setLineDraft(null); setTaxDraft(null); }, draftDirty)} title={lineDraft ? 'Concepto del documento' : 'Tributo del documento'} size="lg">
      {draft && <form noValidate onSubmit={submitDraft} className="space-y-4">
        {lineDraft && <><div className="grid gap-4 sm:grid-cols-2">{field('descripcion', 'Descripción del concepto')}{field('cantidad', 'Cantidad')}{field('precioUnitario', `Precio unitario (${currency})`)}{field('descuento', 'Descuento (importe)')}</div>
          <p className="text-xs text-slate-600">Descuento monetario; se resta una sola vez. Base = cantidad × precio − descuento. Impuestos y retenciones se capturan como tributos.</p>
          <p aria-live="polite" className="rounded bg-blue-50 p-3 text-sm">Base después del descuento: <strong>{money(linePreview.subtotal)}</strong></p>
          <details><summary className="cursor-pointer text-sm font-semibold">Datos adicionales</summary><div className="mt-3 grid gap-4 sm:grid-cols-2">{lineExtra.map(name => field(name))}</div></details></>}
        {taxDraft && <><div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><SearchableSelect id="concepto-tributo-opcion" label="Identificar tributo por nombre o código" value="" options={reusable.filter(row=>row.label.toLowerCase().includes(taxSearch.toLowerCase()))}
            search={taxSearch} onSearchChange={setTaxSearch} loading={taxOptionsLoading} loadError={taxOptionsError} onRetry={()=>setTaxAttempt(n=>n+1)}
            placeholder="Seleccionar identificación existente…" onChange={value=>{const row=taxCatalog[Number(value)];if(row)setTaxDraft(current=>current&&({...current,values:{...current.values,tipoTributo:row.tipo,codigoTributo:row.codigo,nombreTributo:row.nombre}}));}} />
            <p className="mt-2 text-xs text-slate-600">El código identifica el tributo; no es el código de una regla ni una referencia del DTE. Elegir nombre y código conserva los importes y no asigna una tasa.</p>
          </div>
          {!!simpleRules.length&&<Select id="concepto-regla" label="Copiar valores de una regla vigente compatible" value="" options={simpleRules.map((rule,index)=>({value:String(index),label:`${rule.codigoRegla} v${rule.versionRegla} · ${rule.nombreTributo} · ${rule.porcentaje}% · Fijo ${rule.montoFijo}`}))} onChange={event=>void applyRule(Number(event.target.value))} />}
          <Select id="concepto-tipoTributo" label="Tipo" value={taxDraft.values.tipoTributo} options={['IMPUESTO', 'RETENCION', 'PERCEPCION'].map(value => ({ value, label: value }))} onChange={event => changeField('tipoTributo', event.target.value)} />
          <Select id="concepto-calculo" label="Cálculo" value={taxDraft.row.calculo} options={[{ value: 'PORCENTAJE', label: 'Porcentual' }, { value: 'FIJO', label: 'Importe fijo' }, ...(taxDraft.row.idTributo ? [{ value: 'CONSERVAR', label: 'Conservar cálculo histórico' }] : [])]}
            onChange={event => setTaxDraft(current => current && ({ ...current, row: { ...current.row, calculo: event.target.value, baseRevisadaPara: reference(current.row.linea) } }))} />
          {field('codigoTributo', 'Código del tributo')}{field('nombreTributo', 'Nombre del tributo')}
          {!simpleRules.length&&<p className="text-xs text-slate-600 sm:col-span-2">No hay una regla simple compatible para precargar importes. Usa los valores del comprobante. Las identificaciones históricas no determinan vigencia, base ni porcentaje.</p>}
          <Select id="concepto-aplicacion" label="Aplicación" value={taxDraft.row.linea ?? ''} placeholder="" options={[{ value: '', label: 'Documento completo' }, ...lineas.map(row => ({ value: row.clave, label: `Línea ${lineNumber(row)} · ${row.datos.descripcion}` }))]}
            onChange={event => setTaxDraft(current => current && ({ ...current, row: { ...current.row, linea: event.target.value || null, baseRevisadaPara: null } }))} />
          <Select id="concepto-baseOrigen" label="Origen de base" value={taxDraft.row.base} options={[{ value: 'DERIVADA', label: 'Base calculada del concepto' }, { value: 'MANUAL', label: 'Base manual, con revisión' }]}
            onChange={event => setTaxDraft(current => current && ({ ...current, row: { ...current.row, base: event.target.value } }))} />
          {field('baseImponible', 'Base imponible', taxDraft.row.base === 'DERIVADA', taxDraft.row.base === 'DERIVADA' ? reference(taxDraft.row.linea) : undefined)}
          {field('porcentaje', 'Porcentaje', taxDraft.row.calculo !== 'PORCENTAJE', taxDraft.row.calculo === 'FIJO' ? 0 : undefined)}
          {field('monto', `Monto (${currency})`, taxDraft.row.calculo === 'PORCENTAJE', taxDraft.row.calculo === 'PORCENTAJE' ? Number.isFinite(draftData.monto) ? draftData.monto : '—' : undefined)}
          {taxDraft.values.tipoTributo === 'IMPUESTO' && <><Select id="concepto-incluidoPrecio" label="Incluido en precio" value={taxDraft.values.incluidoPrecio} options={[{ value: 'N', label: 'No' }, { value: 'S', label: 'Sí (requiere conciliación RF04)' }]} onChange={event => changeField('incluidoPrecio', event.target.value)} />
            <Select id="concepto-tratamiento" label="Tratamiento recuperable" value={taxDraft.row.tratamiento} options={[{ value: 'RECUPERABLE', label: 'Recuperable' }, { value: 'NO_RECUPERABLE', label: 'No recuperable' }, { value: 'PARCIAL', label: 'Recuperación parcial' }, ...(taxDraft.row.idTributo ? [{ value: 'CONSERVAR', label: 'Conservar desglose histórico' }] : [])]}
              onChange={event => setTaxDraft(current => current && ({ ...current, row: { ...current.row, tratamiento: event.target.value } }))} />
            {(taxDraft.row.tratamiento === 'PARCIAL' || taxDraft.row.tratamiento === 'CONSERVAR') && <>{field('montoRecuperable', 'Monto recuperable')}{field('montoNoRecuperable', 'Monto no recuperable')}</>}</>}
        </div><p className="text-xs text-slate-600">Cálculo porcentual: base × porcentaje / 100, con redondeo decimal a centavos. No se precargan tasas fiscales oficiales.</p>
          {(taxDraft.row.base === 'MANUAL' || taxDraft.row.calculo !== 'PORCENTAJE') && <div className="rounded bg-amber-50 p-3 text-sm">
            <p>{draftErrors.baseRevisadaPara || 'Base manual o importe conservado: confirma su revisión para el concepto actual.'}</p>
            <Button id="concepto-baseRevisadaPara" variant="secondary" onClick={() => setTaxDraft(current => current && ({ ...current, row: { ...current.row, baseRevisadaPara: reference(current.row.linea) } }))}>Confirmar revisión de base e importe</Button></div>}
          <details><summary className="cursor-pointer text-sm font-semibold">Datos adicionales</summary><div className="mt-3 grid gap-4 sm:grid-cols-2">{field('numeroConstancia')}{field('periodoFiscal')}</div></details></>}
        {submitted && Object.keys(draftErrors).length > 0 && <p role="alert" className="text-sm text-red-700">Revisa los campos indicados antes de agregar el concepto.</p>}
        <div className="flex justify-end gap-2 border-t pt-4"><Button variant="secondary" onClick={() => void discard(() => { setLineDraft(null); setTaxDraft(null); }, draftDirty)}>Cancelar</Button>
          <Button type="submit">{lineDraft ? 'Aplicar línea' : 'Aplicar tributo'}</Button></div>
      </form>}
    </Modal>
  </section>;
}
