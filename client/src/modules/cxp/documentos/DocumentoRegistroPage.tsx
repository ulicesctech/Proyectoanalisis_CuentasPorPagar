import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, FileText } from 'lucide-react';
import {
  CXP_SCHEMAS, getCxpEntity, prepareCxpRecord, validateCxpRecord,
  type CxpDocumento, type CxpRecord,
} from '@erp/contracts';
import { apiClient, ApiError } from '../../../shared/api';
import { Button, Select, TextArea, TextInput } from '../../../shared/ui-kit';
import { CxpLayout } from '../CxpLayout';
import { DocumentoCatalogPicker } from './components/DocumentoCatalogPicker';
import { formatDocumentoDate, formatDocumentoMoney, readableState } from './documentoView';

const fields = getCxpEntity('documentos')!.fields;
const choices = (name: string) => fields.find(field => field.name === name)?.options?.map(value => ({ value, label: readableState(value) })) ?? [];
const steps = ['Identificación', 'Fechas e importes', 'Revisión'];
const amountFields = ['subtotal', 'descuentoTotal', 'impuestoTotal', 'retencionTotal', 'recargoTotal', 'gastoAdicionalTotal', 'diferenciaRedondeo'] as const;

const initialValues = {
  idProveedor: '', idSucursal: '', creadoPor: '', tipoDocumento: 'FACTURA', naturaleza: 'D',
  idCondicionCredito: '',
  origenIngreso: 'FACTURACION_ELECTRONICA', tipoRegistro: 'SIN_OC', serie: '', numeroDocumento: '',
  uuidFiscal: '', nitEmisor: '', hashOrigen: '', noOrdenCompra: '', fechaDocumento: '', fechaVencimiento: '',
  moneda: 'GTQ', tipoCambio: '1', subtotal: '', descuentoTotal: '0', impuestoTotal: '0',
  retencionTotal: '0', recargoTotal: '0', gastoAdicionalTotal: '0', diferenciaRedondeo: '0', observaciones: '',
};
type Values = typeof initialValues;
type Field = keyof Values;
type Errors = Partial<Record<Field, string>>;
type DueDatePreview = {
  idCondicionCredito: number;
  diasCredito: number;
  fechaVencimiento: string;
  tipo: 'CONTADO' | 'CREDITO';
};

const optional = (value: string) => value.trim() || undefined;

function guatemalaCalendarDate(now = new Date()): string {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function makePayload(values: Values): CxpRecord {
  return {
    idProveedor: Number(values.idProveedor), idSucursal: Number(values.idSucursal), creadoPor: Number(values.creadoPor),
    idCondicionCredito: Number(values.idCondicionCredito),
    tipoDocumento: values.tipoDocumento, naturaleza: values.naturaleza, origenIngreso: values.origenIngreso,
    tipoRegistro: values.tipoRegistro, serie: optional(values.serie), numeroDocumento: optional(values.numeroDocumento),
    uuidFiscal: optional(values.uuidFiscal), nitEmisor: optional(values.nitEmisor), hashOrigen: optional(values.hashOrigen),
    noOrdenCompra: values.tipoRegistro === 'CON_OC' ? optional(values.noOrdenCompra) : undefined,
    fechaDocumento: optional(values.fechaDocumento),
    moneda: values.moneda.trim().toUpperCase(), tipoCambio: Number(values.tipoCambio),
    ...Object.fromEntries(amountFields.map(name => [name, Number(values[name] || 0)])),
    observaciones: optional(values.observaciones), estado: 'RECIBIDO',
  };
}

function stepErrors(values: Values, step: number): Errors {
  const errors: Errors = {};
  const required = (name: Field) => { if (!values[name].trim()) errors[name] = 'Este dato es necesario para registrar el DTE.'; };
  if (step === 0) {
    for (const name of ['idProveedor', 'idSucursal', 'creadoPor', 'tipoDocumento', 'serie', 'numeroDocumento'] as const) required(name);
    if (values.origenIngreso === 'FACTURACION_ELECTRONICA') required('uuidFiscal');
    if (values.tipoRegistro === 'CON_OC') required('noOrdenCompra');
  }
  if (step === 1) {
    required('fechaDocumento'); required('idCondicionCredito'); required('moneda'); required('subtotal');
    if (values.origenIngreso === 'FACTURACION_ELECTRONICA' && values.fechaDocumento &&
        values.fechaDocumento > guatemalaCalendarDate()) {
      errors.fechaDocumento = 'La fecha del DTE recibido no puede ser futura.';
    }
    if (values.naturaleza === 'D' && values.fechaDocumento && values.fechaVencimiento &&
        values.fechaVencimiento < values.fechaDocumento) {
      errors.fechaVencimiento = 'El vencimiento no puede ser anterior a la fecha del documento.';
    }
    if (values.moneda.trim().length !== 3) errors.moneda = 'Usa un código de tres letras, como GTQ.';
    if (!Number.isFinite(Number(values.tipoCambio)) || Number(values.tipoCambio) <= 0) errors.tipoCambio = 'Ingresa un tipo de cambio mayor a cero.';
    for (const name of amountFields.filter(field => field !== 'diferenciaRedondeo')) {
      if (values[name] !== '' && (!Number.isFinite(Number(values[name])) || Number(values[name]) < 0)) errors[name] = 'Ingresa un importe mayor o igual a cero.';
    }
    if (!Number.isFinite(Number(values.diferenciaRedondeo))) errors.diferenciaRedondeo = 'Ingresa un importe válido.';
    if (values.subtotal === '' || Number(values.subtotal) < 0) errors.subtotal = 'Ingresa el subtotal del DTE.';
    if (!Object.keys(errors).length) {
      try {
        if (Number(prepareCxpRecord('documentos', makePayload(values)).totalNeto) <= 0) errors.subtotal = 'El total neto debe ser mayor a cero. Revisa los importes.';
      } catch { errors.subtotal = 'Revisa los importes del DTE.'; }
    }
  }
  return errors;
}

export function CxpDocumentoRegistroPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>(initialValues);
  const [catalogLabels, setCatalogLabels] = useState({ idProveedor: '', idSucursal: '', creadoPor: '', idCondicionCredito: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dueDate, setDueDate] = useState<DueDatePreview | null>(null);
  const [dueDateLoading, setDueDateLoading] = useState(false);

  useEffect(() => {
    if (!values.fechaDocumento || !values.idCondicionCredito) {
      setDueDate(null);
      setDueDateLoading(false);
      setValues(current => current.fechaVencimiento ? { ...current, fechaVencimiento: '' } : current);
      return;
    }
    let active = true;
    setDueDate(null);
    setDueDateLoading(true);
    apiClient.post<DueDatePreview>('/cxp/documentos/calcular-vencimiento', {
      fechaDocumento: values.fechaDocumento,
      idCondicionCredito: Number(values.idCondicionCredito),
    }).then(result => {
      if (!active) return;
      setDueDate(result);
      setValues(current => ({ ...current, fechaVencimiento: result.fechaVencimiento }));
      setErrors(current => ({ ...current, idCondicionCredito: undefined, fechaVencimiento: undefined }));
    }).catch(reason => {
      if (!active) return;
      const detail = reason instanceof ApiError && Array.isArray(reason.details)
        ? reason.details.find(item => item && typeof item === 'object' && 'mensaje' in item) as { campo?: Field; mensaje?: string } | undefined
        : undefined;
      const field = detail?.campo === 'fechaDocumento' ? 'fechaDocumento' : 'idCondicionCredito';
      setErrors(current => ({ ...current, [field]: detail?.mensaje || 'No se pudo calcular el vencimiento.' }));
      setValues(current => current.fechaVencimiento ? { ...current, fechaVencimiento: '' } : current);
    }).finally(() => { if (active) setDueDateLoading(false); });
    return () => { active = false; };
  }, [values.fechaDocumento, values.idCondicionCredito]);

  let preview: CxpRecord = {};
  try { preview = prepareCxpRecord('documentos', makePayload(values)); } catch { /* Se señalará el importe al continuar. */ }

  const change = (name: Field, value: string) => {
    if (name === 'fechaDocumento' || name === 'idCondicionCredito') setDueDate(null);
    setValues(current => ({ ...current, [name]: value }));
    setErrors(current => ({ ...current, [name]: undefined }));
    setFormError(null);
  };
  const chooseCatalog = (name: keyof typeof catalogLabels) => (value: string, label = '') => {
    change(name, value);
    setCatalogLabels(current => ({ ...current, [name]: label }));
  };
  const advance = () => {
    const found = stepErrors(values, step);
    if (step === 1 && !Object.keys(found).length && !dueDate) {
      found.idCondicionCredito = dueDateLoading
        ? 'Espera mientras se calcula el vencimiento.'
        : 'Selecciona una condición activa para calcular el vencimiento.';
    }
    if (Object.keys(found).length) { setErrors(found); setFormError('Revisa los datos señalados para continuar.'); return; }
    setErrors({}); setFormError(null); setStep(current => current + 1);
  };
  const submit = async () => {
    if (saving) return;
    const identification = stepErrors(values, 0);
    const amounts = stepErrors(values, 1);
    if (!Object.keys(amounts).length && !dueDate) {
      amounts.idCondicionCredito = dueDateLoading
        ? 'Espera mientras se calcula el vencimiento.'
        : 'No se pudo confirmar el vencimiento calculado.';
    }
    if (Object.keys(identification).length || Object.keys(amounts).length) {
      setErrors({ ...identification, ...amounts });
      setStep(Object.keys(identification).length ? 0 : 1);
      setFormError('Revisa los datos señalados para registrar el DTE.');
      return;
    }
    const parsed = CXP_SCHEMAS.documentos.create.safeParse(makePayload(values));
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0]), issue.message])) as Errors);
      setFormError('Revisa los datos del documento.');
      setStep(0);
      return;
    }
    const calculated = prepareCxpRecord('documentos', parsed.data as CxpRecord);
    const issues = validateCxpRecord('documentos', calculated);
    if (issues.length) {
      setErrors(Object.fromEntries(issues.map(issue => [issue.campo, issue.mensaje])) as Errors);
      setFormError('Revisa los datos del documento.');
      setStep(issues.some(issue => amountFields.includes(issue.campo as typeof amountFields[number])) ? 1 : 0);
      return;
    }
    setSaving(true); setFormError(null);
    try {
      const created = await apiClient.post<CxpDocumento>('/cxp/documentos', parsed.data);
      navigate(`/cxp/documentos/${created.idDocumento}`, { state: { created: true } });
    } catch (reason) {
      setFormError(reason instanceof ApiError ? reason.message : 'No se pudo registrar el documento. Inténtalo de nuevo.');
      if (reason instanceof ApiError && Array.isArray(reason.details)) {
        const fieldIssues = reason.details.filter((item): item is { campo: Field; mensaje: string } =>
          item && typeof item === 'object' && typeof item.campo === 'string' && typeof item.mensaje === 'string')
          .map(item => [item.campo, item.mensaje] as const);
        setErrors(Object.fromEntries(fieldIssues) as Errors);
        if (fieldIssues.some(([field]) => ['fechaDocumento', 'idCondicionCredito', 'diasCredito', 'fechaVencimiento'].includes(field))) setStep(1);
      }
    } finally { setSaving(false); }
  };

  const input = (name: Field, label: string, props: Record<string, unknown> = {}) =>
    <TextInput id={`registro-${name}`} label={label} value={values[name]} error={errors[name]}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => change(name, event.target.value)} {...props} />;
  const select = (name: Field, label: string, options: { value: string; label: string }[], required = false) =>
    <Select id={`registro-${name}`} label={label} value={values[name]} error={errors[name]} options={options} placeholder="" required={required}
      onChange={(event: React.ChangeEvent<HTMLSelectElement>) => change(name, event.target.value)} />;

  return <CxpLayout resource="documentos">
    <div className="space-y-5 max-w-6xl">
      <Link to="/cxp/documentos" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-blue-700"><ArrowLeft size={16} /> Volver a documentos</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-1">Cuentas por pagar · Registro</p>
          <h1 className="text-2xl font-bold text-slate-900">Registrar DTE</h1>
          <p className="text-sm text-slate-500 mt-1">Guarda el documento recibido y completa su expediente antes de validarlo.</p></div>
        <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"><FileText size={14} /> Estado inicial: RECIBIDO</span>
      </div>

      <nav className="grid grid-cols-3 gap-2" aria-label="Pasos del registro">
        {steps.map((title, index) => <div key={title} aria-current={step === index ? 'step' : undefined}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 ${step === index ? 'border-blue-300 bg-blue-50 text-blue-800' : index < step ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-500'}`}>
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step === index ? 'bg-blue-600 text-white' : index < step ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{index < step ? <Check size={14} /> : index + 1}</span>
          <span className="text-sm font-semibold">{title}</span>
        </div>)}
      </nav>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_260px] gap-5 items-start">
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5" aria-label={steps[step]}>
          <div className="mb-5"><h2 className="text-lg font-bold text-slate-900">{steps[step]}</h2>
            <p className="text-sm text-slate-500 mt-1">{step === 0 ? 'Identifica el comprobante, su proveedor y quién lo registra.' : step === 1 ? 'Ingresa las fechas y los importes tal como figuran en el DTE.' : 'Confirma los datos antes de crear el documento recibido.'}</p></div>
          {formError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</p>}

          {step === 0 && <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DocumentoCatalogPicker id="registro-idProveedor" label="Proveedor" catalog="proveedores" value={values.idProveedor} required error={errors.idProveedor} onChange={chooseCatalog('idProveedor')} />
              <DocumentoCatalogPicker id="registro-idSucursal" label="Sucursal" catalog="sucursales" value={values.idSucursal} required error={errors.idSucursal} onChange={chooseCatalog('idSucursal')} />
              {select('tipoDocumento', 'Tipo de documento', choices('tipoDocumento'), true)}
              {select('naturaleza', 'Naturaleza', [{ value: 'D', label: 'Débito · obligación' }, { value: 'C', label: 'Crédito · a favor' }], true)}
              {select('origenIngreso', 'Origen de ingreso', [{ value: 'FACTURACION_ELECTRONICA', label: 'Facturación electrónica' }, { value: 'MANUAL', label: 'Registro manual' }], true)}
              {select('tipoRegistro', 'Tipo de registro', choices('tipoRegistro'), true)}
              {values.tipoRegistro === 'CON_OC' && input('noOrdenCompra', 'Número de orden de compra', { required: true, maxLength: 20 })}
            </div>
            <div className="border-t border-slate-100 pt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {input('serie', 'Serie', { required: true, maxLength: 40 })}
              {input('numeroDocumento', 'Número de documento', { required: true, maxLength: 80 })}
              {input('uuidFiscal', 'UUID fiscal', { required: values.origenIngreso === 'FACTURACION_ELECTRONICA', maxLength: 100 })}
              {input('nitEmisor', 'NIT emisor', { maxLength: 20 })}
              {input('hashOrigen', 'Hash de origen', { maxLength: 128, className: 'sm:col-span-2' })}
            </div>
            <div className="border-t border-slate-100 pt-5"><DocumentoCatalogPicker id="registro-creadoPor" label="Registrado por" catalog="usuarios" value={values.creadoPor} required error={errors.creadoPor} onChange={chooseCatalog('creadoPor')} /></div>
          </div>}

          {step === 1 && <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {input('fechaDocumento', 'Fecha del documento', { type: 'date', required: true, max: guatemalaCalendarDate() })}
              <DocumentoCatalogPicker id="registro-idCondicionCredito" label="Condición de pago" catalog="condiciones-credito"
                value={values.idCondicionCredito} required error={errors.idCondicionCredito} placeholder="Buscar condición activa…"
                onChange={chooseCatalog('idCondicionCredito')} />
              <div className="sm:col-span-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Vencimiento calculado</p>
                {dueDateLoading && <p className="text-sm text-blue-700 mt-1">Calculando con la condición seleccionada…</p>}
                {!dueDateLoading && dueDate && <div className="flex flex-wrap items-baseline justify-between gap-2 mt-1">
                  <strong className="text-lg text-blue-900">{formatDocumentoDate(dueDate.fechaVencimiento)}</strong>
                  <span className="text-sm text-blue-800">{dueDate.tipo === 'CONTADO' ? 'Contado' : `${dueDate.diasCredito} días de crédito`}</span>
                </div>}
                {!dueDateLoading && !dueDate && <p className="text-sm text-blue-700 mt-1">Selecciona la fecha y la condición de pago.</p>}
                {errors.fechaVencimiento && <p className="text-xs text-red-600 mt-1">{errors.fechaVencimiento}</p>}
              </div>
              {input('moneda', 'Moneda', { required: true, maxLength: 3 })}
              {input('tipoCambio', 'Tipo de cambio', { type: 'number', min: '0.00000001', step: '0.00000001', required: true })}
            </div>
            <div className="border-t border-slate-100 pt-5">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Importes del comprobante</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {input('subtotal', 'Subtotal', { type: 'number', min: '0', step: '0.01', required: true })}
                {input('descuentoTotal', 'Descuentos', { type: 'number', min: '0', step: '0.01' })}
                {input('impuestoTotal', 'Impuestos', { type: 'number', min: '0', step: '0.01' })}
                {input('retencionTotal', 'Retenciones', { type: 'number', min: '0', step: '0.01' })}
                {input('recargoTotal', 'Recargos', { type: 'number', min: '0', step: '0.01' })}
                {input('gastoAdicionalTotal', 'Gastos adicionales', { type: 'number', min: '0', step: '0.01' })}
                {input('diferenciaRedondeo', 'Diferencia de redondeo', { type: 'number', step: '0.01' })}
              </div>
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex flex-wrap justify-between gap-2">
                <span className="text-sm font-semibold text-blue-800">Total neto previsto</span>
                <strong className="text-lg text-blue-800">{formatDocumentoMoney(preview.totalNeto, values.moneda || 'GTQ')}</strong>
              </div>
            </div>
            <TextArea id="registro-observaciones" label="Observaciones" value={values.observaciones} error={errors.observaciones} rows={3} maxLength={1500}
              onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => change('observaciones', event.target.value)} />
          </div>}

          {step === 2 && <div className="space-y-4">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div><dt className="text-xs font-semibold uppercase text-slate-500">Documento</dt><dd className="font-semibold text-slate-900 mt-1">{values.serie} · {values.numeroDocumento}</dd></div>
              <div><dt className="text-xs font-semibold uppercase text-slate-500">Proveedor</dt><dd className="font-semibold text-slate-900 mt-1">{catalogLabels.idProveedor || `#${values.idProveedor}`}</dd></div>
              <div><dt className="text-xs font-semibold uppercase text-slate-500">Tipo y sucursal</dt><dd className="font-semibold text-slate-900 mt-1">{readableState(values.tipoDocumento)} · {catalogLabels.idSucursal || `#${values.idSucursal}`}</dd></div>
              <div><dt className="text-xs font-semibold uppercase text-slate-500">UUID fiscal</dt><dd className="font-semibold text-slate-900 mt-1 break-all">{values.uuidFiscal || '—'}</dd></div>
              <div><dt className="text-xs font-semibold uppercase text-slate-500">Fecha y vencimiento calculado</dt><dd className="font-semibold text-slate-900 mt-1">{formatDocumentoDate(values.fechaDocumento)} · {formatDocumentoDate(dueDate?.fechaVencimiento)}</dd>
                <p className="text-xs text-slate-500 mt-1">{catalogLabels.idCondicionCredito || (dueDate?.tipo === 'CONTADO' ? 'Contado' : `${dueDate?.diasCredito ?? 0} días de crédito`)}</p></div>
              <div><dt className="text-xs font-semibold uppercase text-slate-500">Registrado por</dt><dd className="font-semibold text-slate-900 mt-1">{catalogLabels.creadoPor || `#${values.creadoPor}`}</dd></div>
            </dl>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <span className="text-sm text-blue-800">Se registrará con estado <strong>RECIBIDO</strong>.</span>
              <strong className="text-xl text-blue-800">{formatDocumentoMoney(preview.totalNeto, values.moneda)}</strong>
            </div>
            <p className="text-sm text-slate-600">Después del registro adjunta el DTE y añade las líneas y los tributos desde el expediente. RF04 exigirá el adjunto antes de enviarlo a aprobación.</p>
          </div>}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 mt-6 pt-4">
            <span className="text-xs text-slate-500">Paso {step + 1} de 3</span>
            <div className="flex gap-2">
              {step > 0 && <Button variant="secondary" disabled={saving} onClick={() => { setStep(current => current - 1); setFormError(null); }}>Anterior</Button>}
              {step < 2 ? <Button icon={ArrowRight} onClick={advance}>Continuar</Button>
                : <Button icon={Check} disabled={saving} onClick={submit}>{saving ? 'Registrando…' : 'Registrar documento'}</Button>}
            </div>
          </div>
        </section>
        <aside className="bg-white border border-slate-200 rounded-xl shadow-sm p-4" aria-label="Después del registro">
          <h2 className="text-sm font-bold text-slate-900">Así continúa el trámite</h2>
          <ol className="mt-4 space-y-4 text-sm text-slate-600">
            <li><strong className="text-blue-700">1. Recibido</strong><p>Registra la cabecera del DTE.</p></li>
            <li><strong className="text-slate-800">2. Completar expediente</strong><p>Adjunta el DTE y agrega líneas y tributos según el comprobante.</p></li>
            <li><strong className="text-slate-800">3. Validar</strong><p>Comprueba datos e importes antes de enviarlo a aprobación.</p></li>
          </ol>
        </aside>
      </div>
    </div>
  </CxpLayout>;
}
