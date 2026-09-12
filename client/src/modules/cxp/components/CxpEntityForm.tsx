import { useMemo, useState } from 'react';
import {
  CXP_SCHEMAS, getCxpEntity, isCxpFieldVisible, isCxpFutureDateRestricted, prepareCxpRecord, validateCxpRecord,
  type CxpRecord, type CxpResource, type CxpFieldDefinition,
} from '@erp/contracts';
import { apiClient, ApiError } from '../../../shared/api';
import { Button, Select, TextArea, TextInput } from '../../../shared/ui-kit';
import { RelationSelect, clearCxpCatalogCache } from './RelationSelect';

export interface CxpFormProps {
  record?: CxpRecord | null;
  initialValues?: CxpRecord;
  readOnly?: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

const sectionsOrder = ['Datos generales', 'Relaciones', 'Fechas', 'Importes y cantidades', 'Estado y control', 'Información adicional', 'Auditoría'];
const optionLabel = (option: string) => option === 'S' ? 'Sí' : option === 'N' ? 'No' : option.replace(/_/g, ' ');
function localDate(timestamp = false): string {
  const date = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return timestamp ? `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}:00` : day;
}

/**
 * Genera un placeholder tipo "Ej: ..." para que la persona sepa qué formato
 * o tipo de dato se espera en cada campo, sin tener que tocar los 17 metadatos
 * generados (cubre las 17 entidades a partir del nombre/tipo del campo).
 */
function placeholderFor(field: CxpFieldDefinition): string | undefined {
  const name = field.name.toLowerCase();
  if (field.type === 'date') return 'Ej: 2025-01-31';
  if (field.type === 'datetime') return 'Ej: 2025-01-31 08:00';
  if (field.type === 'number') {
    if (field.integer) return 'Ej: 1';
    if (field.scale) return `Ej: ${(1).toFixed(Math.min(field.scale, 2))}`;
    return 'Ej: 0';
  }
  if (name.includes('correo') || name.includes('email')) return 'Ej: nombre@dominio.com';
  if (name.includes('telefono')) return 'Ej: 5555-5555';
  if (name.includes('nit')) return 'Ej: 1234567-8';
  if (name === 'moneda') return 'Ej: GTQ';
  if (name.includes('hash')) return 'Ej: 64 caracteres hexadecimales (SHA-256)';
  if (name.includes('uri') || name.includes('url')) return 'Ej: https://... o la ruta del archivo';
  if (name.includes('codigo')) return 'Ej: COD-001';
  if (name.includes('grupoparametro')) return 'Ej: VENCIMIENTOS';
  if (name.includes('nombre')) return 'Ej: Nombre descriptivo';
  if (name.includes('descripcion')) return 'Ej: Descripción breve';
  if (name.includes('motivo')) return 'Ej: Motivo del cambio';
  if (name.includes('observacion') || name.includes('nota')) return 'Ej: Observaciones adicionales';
  if (name.includes('direccion')) return 'Ej: 5a avenida 10-25, zona 1';
  if (field.type === 'textarea') return 'Ej: Descripción o detalle';
  if (field.type === 'text' && !field.lookup && !field.options) return `Ej: ${field.label}`;
  return undefined;
}

export function CxpEntityForm({ resource, record, initialValues = {}, readOnly = false, onSuccess, onCancel }: CxpFormProps & { resource: CxpResource }) {
  const entity = getCxpEntity(resource)!;
  const editing = !!record;
  const initial = useMemo(() => Object.fromEntries(entity.fields.map(field => {
    // En creación, los campos numéricos no se precargan con su valor por defecto de BD
    // (ej. 0.0) para que se vean vacíos con su placeholder "Ej: ..." en vez de un "0"
    // que parece escrito por el usuario. Selects/textos (moneda, estado) sí se precargan.
    const fallbackDefault = field.type === 'number' ? undefined : field.defaultValue;
    let value = record ? record[field.name] : initialValues[field.name] ?? fallbackDefault ?? '';
    if (value === 'SYSDATE') value = localDate();
    if (value === 'SYSTIMESTAMP') value = field.readOnly ? '' : localDate(true);
    return [field.name, value == null ? '' : String(value)];
  })), []);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [association, setAssociation] = useState(entity.associationFields?.find(field => values[field]) ?? entity.associationFields?.[0] ?? '');
  const [section, setSection] = useState(sectionsOrder.find(name => entity.fields.some(field => field.section === name && !field.identity)) ?? sectionsOrder[0]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const asRecord = (source: Record<string, string>): CxpRecord => Object.fromEntries(entity.fields.map(field => [field.name,
    source[field.name] === '' ? null : field.type === 'number' ? Number(source[field.name]) : source[field.name],
  ]));
  const raw = asRecord(values);
  let preview = raw;
  try { preview = prepareCxpRecord(resource, { ...raw, montoAplicado: record?.montoAplicado ?? 0 }); } catch { /* La validación indica el campo inválido al guardar. */ }
  const visible = entity.fields.filter(field => isCxpFieldVisible(resource, field.name, raw) && (!entity.associationFields?.includes(field.name) || field.name === association));
  const sections = sectionsOrder.filter(name => visible.some(field => field.section === name));

  const change = (name: string, value: string) => {
    setValues(current => {
      const next = { ...current, [name]: value };
      const nextRecord = asRecord(next);
      entity.fields.forEach(field => { if (!isCxpFieldVisible(resource, field.name, nextRecord)) next[field.name] = ''; });
      if (name === 'idDocumento' && resource === 'documentos-tributos') next.idDetalle = '';
      if (name === 'idProveedor' && resource === 'pagos') next.idCuentaDestino = '';
      return next;
    });
    setErrors(current => ({ ...current, [name]: '' }));
  };
  const showErrors = (fieldErrors: Record<string, string>) => {
    setErrors(fieldErrors);
    const first = entity.fields.find(field => fieldErrors[field.name]);
    if (first) {
      if (entity.associationFields?.includes(first.name)) setAssociation(first.name);
      setSection(first.section);
      window.setTimeout(() => document.getElementById(`cxp-${first.name}`)?.focus(), 0);
    }
    setFormError('Revisa los campos indicados antes de guardar.');
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || readOnly) return;
    setErrors({});
    setFormError(null);
    const payload: CxpRecord = {};
    for (const field of entity.fields) {
      if (field.readOnly) continue;
      const text = values[field.name] ?? '';
      if (editing && text === initial[field.name]) continue;
      if (text === '') {
        if (editing && !field.required) payload[field.name] = null;
        else if (field.required && field.defaultValue === undefined) payload[field.name] = field.type === 'number' ? Number.NaN : '';
        continue;
      }
      payload[field.name] = field.type === 'number' ? Number(text) : text;
    }
    if (editing && Object.keys(payload).length === 0) { onCancel(); return; }
    const schema = editing ? CXP_SCHEMAS[resource].update : CXP_SCHEMAS[resource].create;
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      showErrors(Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0] ?? ''), issue.message])));
      return;
    }
    let calculated: CxpRecord;
    try { calculated = prepareCxpRecord(resource, { ...(record ?? {}), ...parsed.data } as CxpRecord); }
    catch (error) { setFormError(error instanceof Error ? error.message : 'Revisa los importes'); return; }
    const issues = validateCxpRecord(resource, calculated);
    if (issues.length) { showErrors(Object.fromEntries(issues.map(issue => [issue.campo, issue.mensaje]))); return; }
    setBusy(true);
    try {
      if (editing) await apiClient.patch(`/cxp/${resource}/${record![entity.idField]}`, parsed.data);
      else await apiClient.post(`/cxp/${resource}`, parsed.data);
      clearCxpCatalogCache();
      onSuccess();
    } catch (error) {
      if (error instanceof ApiError && Array.isArray(error.details) && error.details.length) {
        showErrors(Object.fromEntries(error.details.map((issue: { campo: string; mensaje: string }) => [issue.campo, issue.mensaje])));
      } else setFormError(error instanceof ApiError ? error.message : 'No se pudo guardar. Comprueba la conexión e inténtalo de nuevo.');
    } finally { setBusy(false); }
  }

  const renderField = (field: CxpFieldDefinition) => {
    const locked = readOnly || field.readOnly || busy;
    const value = field.calculated ? String(preview[field.name] ?? '') : values[field.name];
    const props = { id: `cxp-${field.name}`, label: field.label, required: field.required && !field.readOnly,
      error: errors[field.name], value, isReadOnly: locked };
    if (field.lookup) {
      let filterField: string | undefined;
      let filterValue: string | undefined;
      if (field.name === 'idDetalle' && resource === 'documentos-tributos' && values.idDocumento) { filterField = 'idDocumento'; filterValue = values.idDocumento; }
      if (field.name === 'idCuentaOrigen') { filterField = 'tipoTitular'; filterValue = 'EMPRESA'; }
      if (field.name === 'idCuentaDestino' && values.idProveedor) { filterField = 'idProveedor'; filterValue = values.idProveedor; }
      return <RelationSelect key={field.name} {...props} catalog={field.lookup} readOnly={locked}
        filterField={filterField} filterValue={filterValue} onChange={next => change(field.name, next)} />;
    }
    if (field.options) return <Select key={field.name} {...props} placeholder="" options={[{ value: '', label: 'Seleccionar…' }, ...field.options.map(option => ({ value: option, label: optionLabel(option) }))]}
      onChange={(event: React.ChangeEvent<HTMLSelectElement>) => change(field.name, event.target.value)} />;
    if (field.type === 'textarea') return <TextArea key={field.name} {...props} rows={4} maxLength={field.maxLength ?? 30000}
      placeholder={placeholderFor(field)}
      className="sm:col-span-2" onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => change(field.name, event.target.value)} />;
    const futureRestricted = (field.type === 'date' || field.type === 'datetime') && isCxpFutureDateRestricted(field.name);
    return <TextInput key={field.name} {...props} type={field.type === 'datetime' ? 'datetime-local' : field.type}
      maxLength={field.maxLength} step={field.type === 'datetime' ? '0.000001' : field.type === 'number' ? field.integer || field.scale === 0 ? '1' : field.scale ? String(10 ** -field.scale) : 'any' : undefined}
      max={futureRestricted ? localDate(field.type === 'datetime') : undefined}
      placeholder={field.identity || (field.readOnly && !field.calculated) ? 'Se genera al guardar' : placeholderFor(field)}
      helperText={field.calculated ? 'Se calcula automáticamente.' : field.name === 'uriAlmacenamiento' ? 'Ubicación donde ya está almacenado el archivo.' : futureRestricted ? 'No puede ser una fecha futura.' : undefined}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => change(field.name, event.target.value)} />;
  };

  return (
    <form noValidate onSubmit={submit} className="space-y-5">
      <nav className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-4" aria-label="Secciones del formulario">
        {sections.map(name => <button key={name} type="button" onClick={() => setSection(name)}
          className={`px-3 py-2 rounded-lg text-xs font-semibold ${section === name ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          {name}{entity.fields.some(field => field.section === name && errors[field.name]) && <span className="ml-1 text-red-300">●</span>}
        </button>)}
      </nav>
      {formError && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{formError}</p>}
      {entity.associationFields && section === 'Relaciones' && <Select id="cxp-associated-entity" label="Entidad relacionada" required isReadOnly={readOnly || busy}
        value={association} options={entity.associationFields.map(name => ({ value: name, label: entity.fields.find(field => field.name === name)!.label }))}
        onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
          const chosen = event.target.value;
          setAssociation(chosen);
          setValues(current => ({ ...current, ...Object.fromEntries(entity.associationFields!.filter(name => name !== chosen).map(name => [name, ''])) }));
        }} />}
      {resource === 'aplicaciones' && section === 'Estado y control' && values.tipoAplicacion === 'COMPENSACION_CXC' &&
        <p className="text-sm text-slate-600">Confirma la compensación únicamente después de que Cuentas por Cobrar haya registrado su parte.</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">{visible.filter(field => field.section === section).map(renderField)}</div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <span className="text-xs text-slate-500">{readOnly ? 'Consulta del registro' : '* Campos obligatorios'}</span>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>{readOnly ? 'Cerrar' : 'Cancelar'}</Button>
          {!readOnly && <Button type="submit" disabled={busy}>{busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear registro'}</Button>}
        </div>
      </div>
    </form>
  );
}
