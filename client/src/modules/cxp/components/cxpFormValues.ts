import { CXP_SCHEMAS, cxpNow, cxpToday, getCxpEntity, type CxpRecord, type CxpResource } from '@erp/contracts';

/** Valores escalares del contrato/API, antes de convertirse en controles de texto. */
export type CxpFormScalar = string | number | null | undefined;
export type CxpFormSource = Readonly<Record<string, CxpFormScalar>>;

export const cxpFormText = (value: CxpFormScalar): string => value == null ? '' : String(value);

export function cxpFormNumber(value: CxpFormScalar): number {
  const text = cxpFormText(value).trim();
  return text && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text) ? Number(text) : Number.NaN;
}

/** Misma inicialización para controles de cabecera, líneas y demás entidades CXP. */
export function initialCxpFormValues(resource: CxpResource, record?: CxpRecord | null,
  initialValues: CxpFormSource = {}): Record<string, string> {
  const local = CXP_SCHEMAS.documentos.create.shape.moneda.parse(undefined);
  return Object.fromEntries(getCxpEntity(resource)!.fields.map(field => {
    const fallback = field.type === 'number' ? undefined : field.defaultValue;
    let value = record ? record[field.name] : Object.prototype.hasOwnProperty.call(initialValues, field.name)
      ? initialValues[field.name] : fallback ?? '';
    // Solo el alta local sin tasa suministrada utiliza el 1 del dominio. No sustituir 0 o null.
    if (resource === 'documentos' && !record && field.name === 'tipoCambio' &&
        !Object.prototype.hasOwnProperty.call(initialValues, 'tipoCambio') &&
        (initialValues.moneda === undefined ? local : initialValues.moneda) === local) value = 1;
    if (value === 'SYSDATE') value = cxpToday();
    if (value === 'SYSTIMESTAMP') value = field.readOnly ? '' : `${cxpNow().slice(0, 16)}:00`;
    return [field.name, cxpFormText(value)];
  }));
}

/** Lectura para visibilidad y previsualización: vacío continúa siendo ausencia, nunca cero. */
export function cxpFormRecord(resource: CxpResource, values: CxpFormSource): CxpRecord {
  return Object.fromEntries(getCxpEntity(resource)!.fields.map(field => {
    const text = cxpFormText(values[field.name]);
    return [field.name, text.trim() === '' ? null : field.type === 'number' ? cxpFormNumber(text) : text];
  }));
}
