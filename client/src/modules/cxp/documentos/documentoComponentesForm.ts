import { componenteLineaDatos, componenteTributoDatos, cxpMoneyPercent, getCxpEntity, validateCxpRecord,
  type CxpConceptoLinea, type CxpConceptoTributo, type CxpRecord } from '@erp/contracts';
import { cxpFormNumber, initialCxpFormValues } from '../components/cxpFormValues';

export function componentFormValues(resource: 'documentos-detalle' | 'documentos-tributos', datos?: CxpRecord) {
  return initialCxpFormValues(resource, datos ?? null, resource === 'documentos-detalle'
    ? { descuento: 0 } : { tipoTributo: 'IMPUESTO', incluidoPrecio: 'N', montoRecuperable: 0, montoNoRecuperable: 0 });
}
export function componentData(resource: 'documentos-detalle' | 'documentos-tributos', values: Record<string, string>) {
  const schema = resource === 'documentos-detalle' ? componenteLineaDatos : componenteTributoDatos;
  const fields = getCxpEntity(resource)!.fields;
  return Object.fromEntries(Object.keys(schema.shape).map(name => {
    const text = values[name]?.trim() ?? '';
    return [name, text === '' ? schema.shape[name].isOptional() ? undefined : fields.find(field => field.name === name)?.type === 'number' ? Number.NaN : ''
      : fields.find(field => field.name === name)?.type === 'number' ? cxpFormNumber(text) : text];
  }));
}
export function taxFormData(values: Record<string, string>, tax: Omit<CxpConceptoTributo, 'datos'>, reference: number) {
  const datos = componentData('documentos-tributos', values);
  if (tax.calculo === 'PORCENTAJE') datos.porcentaje = cxpFormNumber(values.porcentaje);
  if (tax.base === 'DERIVADA') datos.baseImponible = reference;
  if (tax.calculo === 'PORCENTAJE' && Number.isFinite(datos.baseImponible) && Number.isFinite(datos.porcentaje)) datos.monto = cxpMoneyPercent(Number(datos.baseImponible), Number(datos.porcentaje));
  if (tax.calculo === 'FIJO') datos.porcentaje = 0;
  if (datos.tipoTributo === 'IMPUESTO') {
    if (tax.tratamiento === 'RECUPERABLE') { datos.montoRecuperable = datos.monto; datos.montoNoRecuperable = 0; }
    if (tax.tratamiento === 'NO_RECUPERABLE') { datos.montoNoRecuperable = datos.monto; datos.montoRecuperable = 0; }
  }
  return datos;
}
export function componentErrors(schema: typeof componenteLineaDatos | typeof componenteTributoDatos, datos: CxpRecord) {
  const result = schema.safeParse(datos);
  const errors: Record<string, string> = result.success ? {} : Object.fromEntries(result.error.issues.map(issue => [String(issue.path[0]),
    issue.code === 'invalid_type' ? 'Ingresa un valor válido; este campo no puede quedar vacío.' : issue.message]));
  for (const issue of validateCxpRecord(schema === componenteLineaDatos ? 'documentos-detalle' : 'documentos-tributos', datos)) errors[issue.campo] ??= issue.mensaje;
  return errors;
}
export function serializeComponents(lines: CxpConceptoLinea[], taxes: CxpConceptoTributo[]) {
  const pick = (datos: CxpRecord, schema: typeof componenteLineaDatos | typeof componenteTributoDatos) => Object.fromEntries(Object.keys(schema.shape).map(name => [name, datos[name]]));
  return { lineas: lines.map(line => ({ ...line, datos: componenteLineaDatos.parse(pick(line.datos as CxpRecord, componenteLineaDatos)) })),
    tributos: taxes.map(({ clave, idTributo, linea, calculo, base, tratamiento, baseRevisadaPara, datos }) => ({ clave, idTributo, linea, calculo, base, tratamiento, baseRevisadaPara,
      datos: componenteTributoDatos.parse(pick(datos as CxpRecord, componenteTributoDatos)) })) };
}
