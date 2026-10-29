import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Navigate } from 'react-router-dom';
import { ArrowRight, Check, FileText, X } from 'lucide-react';
import {
  CXP_SCHEMAS, CXP_DOCUMENTO_MONEDA_LOCAL, getCxpEntity, prepareCxpRecord, validateCxpRecord,
  type CxpDocumento, type CxpRecord,
} from '@erp/contracts';
import { apiClient, ApiError } from '../api';
import { getOperadorId } from '../operador/operador';
import { Button, Select, TextArea, TextInput } from '../../../shared/ui-kit';
import { DocumentoCatalogPicker } from './components/DocumentoCatalogPicker';
import { documentoRegistroPayload } from './documentoRegistroPayload';
import { CxpActorReadOnly } from '../components/CxpActorReadOnly';
import { useAuth } from '../auth/session';
import { DocumentoMonedaControl, useDocumentoMonedas } from './components/DocumentoMonedaControl';
import { cambioDocumento, documentoAmountHelp, documentoClearlyInvalid, documentoFormErrors, documentoInput, documentoPreview } from './documentoCaptura';
import { DocumentoTotales } from './components/DocumentoTotales';
import { initialDocumentoRegistroValues } from './documentoEstado';
import { formatDocumentoDate, formatDocumentoMoney, readableState } from './documentoView';
import '../procesos/procesos.css';

const fields = getCxpEntity('documentos')!.fields;
const choices = (name: string) => fields.find(field => field.name === name)?.options?.map(value => ({ value, label: readableState(value) })) ?? [];
const steps = ['Identificación', 'Fechas e importes', 'Revisión'];
const amountFields = ['subtotal', 'descuentoTotal', 'impuestoTotal', 'retencionTotal', 'recargoTotal', 'gastoAdicionalTotal', 'diferenciaRedondeo'] as const;

const initialValues = initialDocumentoRegistroValues();
type Values = typeof initialValues;
type Field = keyof Values;
type Errors = Partial<Record<Field, string>>;
type DueDatePreview = {
  idCondicionCredito: number;
  diasCredito: number;
  fechaVencimiento: string;
  tipo: 'CONTADO' | 'CREDITO';
};

function makePayload(values: Values): CxpRecord {
  const { fechaVencimiento: _calculated, ...input } = documentoInput(values, Number(values.creadoPor));
  return { ...input, noOrdenCompra: values.tipoRegistro === 'CON_OC' ? input.noOrdenCompra : undefined, estado: 'RECIBIDO' };
}

const identificationFields: Field[] = ['idProveedor', 'idSucursal', 'tipoDocumento', 'naturaleza', 'origenIngreso', 'tipoRegistro',
  'noOrdenCompra', 'serie', 'numeroDocumento', 'uuidFiscal', 'nitEmisor', 'hashOrigen', 'creadoPor'];
const fieldsForStep = (step: number): Field[] => step === 0 ? identificationFields
  : (Object.keys(initialValues) as Field[]).filter(name => !identificationFields.includes(name));

export function CxpDocumentoRegistroPage() {
  return <Navigate to="/cxp/documentos" replace state={{ openRegistro: true }} />;
}

export function CxpDocumentoRegistroDialog({ onClose, onSuccess }: {
  onClose: () => void;
  onSuccess: (created: CxpDocumento) => void;
}) {
  const { session } = useAuth();
  const { config: currencyConfig, error: currencyLoadError } = useDocumentoMonedas();
  const dialogRef = useRef<HTMLElement>(null);
  const stepTitleRef = useRef<HTMLHeadingElement>(null);
  const savingRef = useRef(false);
  const [step, setStep] = useState(0);
  // Se precarga con el usuario operativo: el servidor rechaza otro distinto.
  const [values, setValues] = useState<Values>(() => initialDocumentoRegistroValues(getOperadorId()));
  const [catalogLabels, setCatalogLabels] = useState({ idProveedor: '', idSucursal: '', creadoPor: '', idCondicionCredito: '' });
  const [remoteErrors, setRemoteErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const allErrors = documentoFormErrors(values, Number(session?.actor?.id), { wizard: true, monedas: currencyConfig });
  const errors: Errors = { ...Object.fromEntries(Object.entries(allErrors).filter(([name]) => touched[name])),
    ...Object.fromEntries(Object.entries(remoteErrors).filter(([, message]) => !!message)) };
  const touch = (name: Field) => setTouched(current => ({ ...current, [name]: true }));
  const focusErrors = (found: Errors) => window.setTimeout(() => {
    const first = Object.keys(initialValues).find(name => found[name]);
    if (first) document.getElementById(`registro-${first}`)?.focus();
  }, 0);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dueDate, setDueDate] = useState<DueDatePreview | null>(null);
  const [dueDateLoading, setDueDateLoading] = useState(false);

  const close = () => {
    if (savingRef.current) return;
    if (values !== initialValues && !window.confirm('Hay datos sin guardar. ¿Cerrar el registro?')) return;
    onClose();
  };

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => stepTitleRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, input, select, textarea, a[href], [tabindex="0"]',
      ) ?? []).filter(control => !control.matches(':disabled') && control.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) return;
      if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  useEffect(() => { stepTitleRef.current?.focus(); }, [step]);

  useEffect(() => {
    if (!CXP_SCHEMAS.documentos.create.shape.fechaDocumento.safeParse(values.fechaDocumento).success ||
        !Number.isSafeInteger(Number(values.idCondicionCredito)) || Number(values.idCondicionCredito) <= 0) {
      setDueDate(null);
      setDueDateLoading(false);
      setValues(current => current.fechaVencimiento ? { ...current, fechaVencimiento: '' } : current);
      return;
    }
    let active = true;
    setDueDate(null);
    setDueDateLoading(true);
    const timer = window.setTimeout(() => { void apiClient.post<DueDatePreview>('/cxp/documentos/calcular-vencimiento', {
      fechaDocumento: values.fechaDocumento,
      idCondicionCredito: Number(values.idCondicionCredito),
    }).then(result => {
      if (!active) return;
      setDueDate(result);
      setValues(current => ({ ...current, fechaVencimiento: result.fechaVencimiento }));
      setRemoteErrors(current => ({ ...current, idCondicionCredito: undefined, fechaVencimiento: undefined }));
    }).catch(reason => {
      if (!active) return;
      const detail = reason instanceof ApiError && Array.isArray(reason.details)
        ? reason.details.find(item => item && typeof item === 'object' && 'mensaje' in item) as { campo?: Field; mensaje?: string } | undefined
        : undefined;
      const field = detail?.campo === 'fechaDocumento' ? 'fechaDocumento' : 'idCondicionCredito';
      setRemoteErrors(current => ({ ...current, [field]: detail?.mensaje || 'No se pudo calcular el vencimiento.' }));
      setValues(current => current.fechaVencimiento ? { ...current, fechaVencimiento: '' } : current);
    }).finally(() => { if (active) setDueDateLoading(false); }); }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [values.fechaDocumento, values.idCondicionCredito]);

  const preview = documentoPreview(values, Number(session?.actor?.id));

  const change = (name: Field, value: string) => {
    if (name === 'fechaDocumento' || name === 'idCondicionCredito') setDueDate(null);
    setValues(current => cambioDocumento(current, name, value, currencyConfig?.monedaLocal ?? CXP_DOCUMENTO_MONEDA_LOCAL) as Values);
    if (documentoClearlyInvalid(name, value)) touch(name);
    setRemoteErrors({});
    setFormError(null);
  };
  const chooseCatalog = (name: keyof typeof catalogLabels) => (value: string, label = '') => {
    change(name, value);
    touch(name);
    setCatalogLabels(current => ({ ...current, [name]: label }));
  };
  const advance = () => {
    const found: Errors = Object.fromEntries(Object.entries(allErrors)
      .filter(([name]) => fieldsForStep(step).includes(name as Field)));
    setTouched(current => ({ ...current, ...Object.fromEntries(fieldsForStep(step).map(name => [name, true])) }));
    if (step === 1 && !currencyConfig) found.moneda = currencyLoadError || 'Espera a que se cargue el catálogo de monedas.';
    if (step === 1 && !Object.keys(found).length && !dueDate) {
      found.idCondicionCredito = dueDateLoading
        ? 'Espera mientras se calcula el vencimiento.'
        : 'Selecciona una condición activa para calcular el vencimiento.';
    }
    if (Object.keys(found).length) { setRemoteErrors(found); setFormError('Revisa los datos señalados para continuar.'); focusErrors(found); return; }
    setRemoteErrors({}); setFormError(null); setStep(current => current + 1);
  };
  const submit = async () => {
    if (savingRef.current) return;
    const identification: Errors = Object.fromEntries(Object.entries(allErrors)
      .filter(([name]) => fieldsForStep(0).includes(name as Field)));
    const amounts: Errors = Object.fromEntries(Object.entries(allErrors)
      .filter(([name]) => fieldsForStep(1).includes(name as Field)));
    if (!currencyConfig) amounts.moneda = currencyLoadError || 'No se pudo confirmar el catálogo de monedas.';
    if (!Object.keys(amounts).length && !dueDate) {
      amounts.idCondicionCredito = dueDateLoading
        ? 'Espera mientras se calcula el vencimiento.'
        : 'No se pudo confirmar el vencimiento calculado.';
    }
    if (Object.keys(identification).length || Object.keys(amounts).length) {
      setRemoteErrors({ ...identification, ...amounts });
      setTouched(Object.fromEntries(Object.keys(initialValues).map(name => [name, true])));
      setStep(Object.keys(identification).length ? 0 : 1);
      setFormError('Revisa los datos señalados para registrar el DTE.');
      focusErrors({ ...identification, ...amounts });
      return;
    }
    const input = makePayload(values);
    const parsed = CXP_SCHEMAS.documentos.create.safeParse(input);
    if (!parsed.success) {
      const found = Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0]), issue.message])) as Errors;
      setRemoteErrors(found); focusErrors(found);
      setFormError('Revisa los datos del documento.');
      setStep(0);
      return;
    }
    const calculated = prepareCxpRecord('documentos', parsed.data as CxpRecord);
    const issues = validateCxpRecord('documentos', calculated);
    if (issues.length) {
      const found = Object.fromEntries(issues.map(issue => [issue.campo, issue.mensaje])) as Errors;
      setRemoteErrors(found); focusErrors(found);
      setFormError('Revisa los datos del documento.');
      setStep(issues.some(issue => amountFields.includes(issue.campo as typeof amountFields[number])) ? 1 : 0);
      return;
    }
    savingRef.current = true;
    setSaving(true); setFormError(null);
    try {
      const created = await apiClient.post<CxpDocumento>('/cxp/documentos', documentoRegistroPayload(input, parsed.data as CxpRecord));
      onSuccess(created);
    } catch (reason) {
      setFormError(reason instanceof ApiError ? reason.message : 'No se pudo registrar el documento. Inténtalo de nuevo.');
      if (reason instanceof ApiError && Array.isArray(reason.details)) {
        const fieldIssues = reason.details.filter((item): item is { campo: Field; mensaje: string } =>
          item && typeof item === 'object' && typeof item.campo === 'string' && typeof item.mensaje === 'string')
          .map(item => [item.campo, item.mensaje] as const);
        const found = Object.fromEntries(fieldIssues) as Errors;
        setRemoteErrors(found); focusErrors(found);
        setStep(fieldIssues.some(([field]) => identificationFields.includes(field)) ? 0 : 1);
      }
    } finally { savingRef.current = false; setSaving(false); }
  };

  const input = (name: Field, label: string, props: Record<string, unknown> = {}) =>
    <TextInput id={`registro-${name}`} label={label} value={values[name]}
      error={errors[name] ? <span id={`registro-${name}-error`} role="status">{errors[name]}</span> : undefined}
      aria-invalid={!!errors[name] || undefined} aria-describedby={errors[name] ? `registro-${name}-error` : undefined}
      helperText={documentoAmountHelp[name]} onBlur={() => touch(name)}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => change(name, event.target.value)} {...props} />;
  const select = (name: Field, label: string, options: { value: string; label: string }[], required = false) =>
    <Select id={`registro-${name}`} label={label} value={values[name]}
      error={errors[name] ? <span id={`registro-${name}-error`} role="status">{errors[name]}</span> : undefined}
      aria-invalid={!!errors[name] || undefined} aria-describedby={errors[name] ? `registro-${name}-error` : undefined}
      onBlur={() => touch(name)} options={options} placeholder="" required={required}
      onChange={(event: React.ChangeEvent<HTMLSelectElement>) => change(name, event.target.value)} />;

  return createPortal(<div className="cxp-process-page fixed inset-0 z-[9997] flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-[1px]"
    role="presentation">
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="registro-documento-title"
      aria-describedby="registro-documento-description" className="cxp-process-dialog cxp-create-dialog">
      <header className="cxp-dialog-heading">
        <div>
          <h2 id="registro-documento-title" className="text-lg font-semibold text-slate-900">Registrar DTE</h2>
          <p id="registro-documento-description" className="mt-1 text-sm text-slate-500">Guarda el documento recibido y completa su expediente antes de validarlo.</p>
        </div>
        <div className="cxp-dialog-heading-actions">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"><FileText size={14} /> Estado inicial: RECIBIDO</span>
          <Button type="button" icon={X} variant="secondary" disabled={saving} onClick={close}>Cerrar</Button>
        </div>
      </header>
      <form noValidate className="cxp-dialog-body space-y-5" onBlurCapture={event => {
        const name = (event.target as HTMLElement).id?.replace(/^registro-/, '') as Field;
        if (Object.prototype.hasOwnProperty.call(initialValues, name)) touch(name);
      }} onSubmit={event => { event.preventDefault(); if (savingRef.current) return; if (step < 2) advance(); else void submit(); }}>

      <nav className="grid grid-cols-3 gap-2" aria-label="Pasos del registro">
        {steps.map((title, index) => <div key={title} aria-label={title} aria-current={step === index ? 'step' : undefined}
          className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 min-[480px]:justify-start ${step === index ? 'border-blue-300 bg-blue-50 text-blue-800' : index < step ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-500'}`}>
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step === index ? 'bg-blue-600 text-white' : index < step ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{index < step ? <Check size={14} /> : index + 1}</span>
          <span className="hidden text-sm font-semibold sm:inline">{title}</span>
          <span className="hidden text-xs font-semibold min-[480px]:inline sm:hidden">{index === 0 ? 'Datos' : index === 1 ? 'Importes' : 'Revisión'}</span>
        </div>)}
      </nav>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_260px] gap-5 items-start">
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5" aria-label={steps[step]}>
          <div className="mb-5"><h3 ref={stepTitleRef} tabIndex={-1} className="text-lg font-bold text-slate-900 focus:outline-none">{steps[step]}</h3>
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
            <div className="border-t border-slate-100 pt-5"><CxpActorReadOnly id="registro-creadoPor" label="Registrado por" actorId={session?.actor?.id} /></div>
          </div>}

          {step === 1 && <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {input('fechaDocumento', 'Fecha del documento', { type: 'date', required: true })}
              <DocumentoCatalogPicker id="registro-idCondicionCredito" label="Condición de pago" catalog="condiciones-credito"
                value={values.idCondicionCredito} required error={errors.idCondicionCredito} placeholder="Seleccionar condición activa…"
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
              {(['moneda', 'tipoCambio'] as const).map(name => <DocumentoMonedaControl key={name} name={name}
                id={`registro-${name}`} values={values} config={currencyConfig} error={name === 'moneda' ? currencyLoadError || errors.moneda : errors.tipoCambio}
                onChange={(field, value) => change(field as Field, value)} onBlur={() => {
                  touch(name);
                  if (name === 'tipoCambio' && values.tipoCambio) change(name, values.tipoCambio);
                }} />)}
            </div>
            <div className="border-t border-slate-100 pt-5">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Importes del comprobante</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {input('subtotal', 'Subtotal', { inputMode: 'decimal', required: true })}
                {input('descuentoTotal', 'Descuentos', { inputMode: 'decimal' })}
                {input('impuestoTotal', 'Impuestos', { inputMode: 'decimal' })}
                {input('retencionTotal', 'Retenciones', { inputMode: 'decimal' })}
                {input('recargoTotal', 'Recargos', { inputMode: 'decimal' })}
                {input('gastoAdicionalTotal', 'Gastos adicionales', { inputMode: 'decimal' })}
                {input('diferenciaRedondeo', 'Diferencia de redondeo', { inputMode: 'decimal' })}
              </div>
              <DocumentoTotales preview={preview} moneda={values.moneda} local={currencyConfig?.monedaLocal ?? CXP_DOCUMENTO_MONEDA_LOCAL} />
            </div>
            <TextArea id="registro-observaciones" label="Observaciones" value={values.observaciones}
              error={errors.observaciones ? <span id="registro-observaciones-error" role="status">{errors.observaciones}</span> : undefined} rows={3} maxLength={1500}
              aria-describedby={errors.observaciones ? 'registro-observaciones-error' : undefined}
              aria-invalid={!!errors.observaciones || undefined} onBlur={() => touch('observaciones')}
              onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => change('observaciones', event.target.value)} />
          </div>}

          {step === 2 && <div className="space-y-4">
            <DocumentoTotales preview={preview} moneda={values.moneda} local={currencyConfig?.monedaLocal ?? CXP_DOCUMENTO_MONEDA_LOCAL} />
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div><dt className="text-xs font-semibold uppercase text-slate-500">Documento</dt><dd className="font-semibold text-slate-900 mt-1">{values.serie} · {values.numeroDocumento}</dd></div>
              <div><dt className="text-xs font-semibold uppercase text-slate-500">Proveedor</dt><dd className="font-semibold text-slate-900 mt-1">{catalogLabels.idProveedor || `#${values.idProveedor}`}</dd></div>
              <div><dt className="text-xs font-semibold uppercase text-slate-500">Tipo y sucursal</dt><dd className="font-semibold text-slate-900 mt-1">{readableState(values.tipoDocumento)} · {catalogLabels.idSucursal || `#${values.idSucursal}`}</dd></div>
              <div><dt className="text-xs font-semibold uppercase text-slate-500">UUID fiscal</dt><dd className="font-semibold text-slate-900 mt-1 break-all">{values.uuidFiscal || '—'}</dd></div>
              <div><dt className="text-xs font-semibold uppercase text-slate-500">Fecha y vencimiento calculado</dt><dd className="font-semibold text-slate-900 mt-1">{formatDocumentoDate(values.fechaDocumento)} · {formatDocumentoDate(dueDate?.fechaVencimiento)}</dd>
                <p className="text-xs text-slate-500 mt-1">{catalogLabels.idCondicionCredito || (dueDate?.tipo === 'CONTADO' ? 'Contado' : `${dueDate?.diasCredito ?? 0} días de crédito`)}</p></div>
              <div><dt className="text-xs font-semibold uppercase text-slate-500">Registrado por</dt><dd className="font-semibold text-slate-900 mt-1">{session?.actor?.nombre}</dd></div>
            </dl>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <span className="text-sm text-blue-800">Se registrará con estado <strong>RECIBIDO</strong>.</span>
              <strong className="text-xl text-blue-800">{formatDocumentoMoney(preview.totalNeto, values.moneda)}</strong>
            </div>
            <p className="text-sm text-slate-600">Después del registro adjunta el DTE y añade las líneas y los tributos desde el expediente. RF04 exigirá el adjunto antes de enviarlo a aprobación.</p>
          </div>}

          <div className="cxp-dialog-footer flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 mt-6 pt-4">
            <span className="text-xs text-slate-500">Paso {step + 1} de 3</span>
            <div className="flex gap-2">
              {step > 0 && <Button variant="secondary" disabled={saving} onClick={() => { setStep(current => current - 1); setFormError(null); }}>Anterior</Button>}
              {step < 2 ? <Button type="submit" icon={ArrowRight}>Continuar</Button>
                : <Button type="submit" icon={Check} disabled={saving}>{saving ? 'Registrando…' : 'Registrar documento'}</Button>}
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
      </form>
    </section>
  </div>, document.body);
}
