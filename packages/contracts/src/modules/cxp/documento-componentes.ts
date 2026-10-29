import { z } from 'zod';
import { createCxpDocumentoDetalleSchema } from './documento-detalle';
import { createCxpDocumentoTributoSchema } from './documento-tributo';
import { cxpMoneyMultiply, cxpMoneyPercent, cxpMoneySum } from './decimal';
import { prepareCxpRecord, validateCxpRecord } from './rules';
import type { CxpRecord, CxpValidationIssue } from './types';

export const componenteLineaDatos = createCxpDocumentoDetalleSchema.omit({ idDocumento: true, numeroLinea: true, impuesto: true, retencion: true });
export const componenteTributoDatos = createCxpDocumentoTributoSchema.omit({ idDocumento: true, idDetalle: true,
  generadoPor: true, estado: true, fechaAplicacion: true });
const key = z.string().min(1).max(80);
export const documentoComponentesSchema = z.strictObject({
  version: z.string().regex(/^[a-f0-9]{64}$/),
  lineas: z.array(z.strictObject({ clave: key, idDetalle: z.number().int().positive().optional(), numeroLinea: z.number().int().positive().optional(), datos: componenteLineaDatos })),
  tributos: z.array(z.strictObject({ clave: key, idTributo: z.number().int().positive().optional(), linea: key.nullable(),
    calculo: z.enum(['PORCENTAJE', 'FIJO', 'CONSERVAR']), base: z.enum(['DERIVADA', 'MANUAL']),
    tratamiento: z.enum(['RECUPERABLE', 'NO_RECUPERABLE', 'PARCIAL', 'CONSERVAR']),
    baseRevisadaPara: z.number().nullable(), datos: componenteTributoDatos })),
  adoptarTotales: z.boolean().default(false),
  confirmarEliminaciones: z.array(z.number().int().positive()).default([]),
});
export type CxpDocumentoComponentes = z.infer<typeof documentoComponentesSchema>;
export type CxpConceptoLinea = CxpDocumentoComponentes['lineas'][number];
export type CxpConceptoTributo = CxpDocumentoComponentes['tributos'][number];
export interface CxpDocumentoComponentesContexto extends CxpDocumentoComponentes {
  documento: CxpRecord;
  editable: boolean;
  catalogo: Array<{ tipo: string; codigo: string; nombre: string }>;
  advertencias: string[];
}

/** Solo fórmulas y conciliación: no clasifica fiscalmente ni reparte tributos generales. */
export function calcularDocumentoComponentes(documento: CxpRecord, lines: CxpConceptoLinea[], taxes: CxpConceptoTributo[]) {
  const issues: CxpValidationIssue[] = [];
  const fail = (campo: string, mensaje: string) => issues.push({ campo, mensaje });
  const keys = new Set<string>();
  const lineas = lines.map((line, index) => {
    if (keys.has(line.clave)) fail(`lineas.${index}.clave`, 'La clave de línea está repetida.');
    keys.add(line.clave);
    const datos = prepareCxpRecord('documentos-detalle', { ...line.datos, impuesto: 0, retencion: 0 } as CxpRecord);
    for (const issue of validateCxpRecord('documentos-detalle', datos)) fail(`lineas.${index}.datos.${issue.campo}`, issue.mensaje);
    for (const field of ['idDetalleOc', 'idDetalleRecepcion', 'idDepartamento']) {
      if (datos[field] != null && (!Number.isSafeInteger(datos[field]) || Number(datos[field]) <= 0)) fail(`lineas.${index}.datos.${field}`, 'La referencia debe ser un identificador positivo.');
    }
    return { ...line, datos };
  });
  const references = new Map(lineas.map(line => [line.clave, Number(line.datos.subtotal)]));
  const generalBase = cxpMoneySum(...references.values());
  const taxKeys = new Set<string>();
  const tributos = taxes.map((tax, index) => {
    const prefix = `tributos.${index}`;
    if (taxKeys.has(tax.clave)) fail(`${prefix}.clave`, 'La clave de tributo está repetida.');
    taxKeys.add(tax.clave);
    if (tax.linea !== null && !references.has(tax.linea)) fail(`${prefix}.linea`, 'La línea no pertenece al documento.');
    const reference = tax.linea === null ? generalBase : references.get(tax.linea) ?? 0;
    if ((tax.base === 'MANUAL' || tax.calculo !== 'PORCENTAJE') && tax.baseRevisadaPara !== reference) {
      fail(`${prefix}.baseRevisadaPara`, 'Cambió la base del concepto. Revisa la base manual o el importe conservado y confírmalo.');
    }
    const datos: CxpConceptoTributo['datos'] = { ...tax.datos, baseImponible: tax.base === 'DERIVADA' ? reference : tax.datos.baseImponible };
    if (tax.calculo === 'PORCENTAJE') datos.monto = cxpMoneyPercent(Number(datos.baseImponible), Number(datos.porcentaje));
    if (tax.calculo === 'FIJO') datos.porcentaje = 0;
    if (datos.tipoTributo === 'IMPUESTO') {
      if (tax.tratamiento === 'RECUPERABLE') { datos.montoRecuperable = datos.monto; datos.montoNoRecuperable = 0; }
      if (tax.tratamiento === 'NO_RECUPERABLE') { datos.montoRecuperable = 0; datos.montoNoRecuperable = datos.monto; }
      const recovery = cxpMoneySum(Number(datos.montoRecuperable), Number(datos.montoNoRecuperable));
      if ((tax.tratamiento !== 'CONSERVAR' || recovery !== 0) && recovery !== datos.monto) {
        fail(`${prefix}.datos.montoRecuperable`, 'Las partes recuperable y no recuperable deben sumar el monto.');
      }
    } else if (tax.tratamiento !== 'CONSERVAR') fail(`${prefix}.tratamiento`, 'La recuperación solo corresponde a impuestos.');
    for (const issue of validateCxpRecord('documentos-tributos', datos)) fail(`${prefix}.datos.${issue.campo}`, issue.mensaje);
    if (tax.linea !== null) {
      const line = lineas.find(item => item.clave === tax.linea);
      const field = datos.tipoTributo === 'IMPUESTO' ? 'impuesto' : datos.tipoTributo === 'RETENCION' ? 'retencion' : null;
      if (line && field) line.datos[field] = cxpMoneySum(Number(line.datos[field]), Number(datos.monto));
    }
    return { ...tax, datos, referencia: reference };
  });
  for (const line of lineas) {
    line.datos = prepareCxpRecord('documentos-detalle', line.datos);
    for (const issue of validateCxpRecord('documentos-detalle', line.datos)) fail(`lineas.${lineas.indexOf(line)}.datos.${issue.campo}`, issue.mensaje);
  }
  const sum = (type: string) => cxpMoneySum(...tributos.filter(tax => tax.datos.tipoTributo === type).map(tax => Number(tax.datos.monto)));
  const totals: CxpRecord = { ...documento,
    subtotal: cxpMoneySum(...lineas.map(line => cxpMoneyMultiply(Number(line.datos.cantidad), Number(line.datos.precioUnitario)))),
    descuentoTotal: cxpMoneySum(...lineas.map(line => Number(line.datos.descuento))), impuestoTotal: sum('IMPUESTO'), retencionTotal: sum('RETENCION') };
  const totales = prepareCxpRecord('documentos', totals);
  const diferencias = ['subtotal', 'descuentoTotal', 'impuestoTotal', 'retencionTotal', 'totalNeto'].map(campo => ({ campo,
    declarado: Number(documento[campo] ?? 0), calculado: Number(totales[campo]),
    diferencia: cxpMoneySum(Number(totales[campo]), -Number(documento[campo] ?? 0)) }));
  const impedimentos = tributos.flatMap((tax, index) => Number(tax.datos.monto) !== 0 &&
    (tax.datos.incluidoPrecio === 'S' || tax.datos.tipoTributo === 'PERCEPCION')
    ? [{ campo: `tributos.${index}`, mensaje: tax.datos.incluidoPrecio === 'S'
      ? 'RF04 mantiene bloqueados los tributos incluidos en precio: su conciliación no está definida.'
      : 'RF04 mantiene bloqueadas las percepciones no nulas: su tratamiento no está definido.' }] : []);
  return { lineas, tributos, totales, diferencias, issues, impedimentos };
}
