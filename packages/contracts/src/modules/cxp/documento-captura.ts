import { createCxpDocumentoSchema } from './documento';
import { prepareCxpRecord, validateCxpRecord } from './rules';
import type { CxpRecord, CxpValidationIssue } from './types';

/** Referencia local ya definida por el contrato vigente; no es una cotización. */
export const CXP_DOCUMENTO_MONEDA_LOCAL = createCxpDocumentoSchema.shape.moneda.parse(undefined);
export interface CxpDocumentoMonedas {
  monedaLocal: string;
  monedas: Array<{ codigo: string; nombre: string }>;
  /** No existe un catálogo de tasas confirmado en esta instalación. */
  fuenteTasas: null;
}
export const CXP_DOCUMENTO_IMPORTES = ['subtotal', 'descuentoTotal', 'impuestoTotal', 'retencionTotal',
  'recargoTotal', 'gastoAdicionalTotal', 'diferenciaRedondeo'] as const;

export function documentoExchangeIssues(input: CxpRecord, requireForeignRate = false): CxpValidationIssue[] {
  const currency = typeof input.moneda === 'string' ? input.moneda.trim() : input.moneda ?? CXP_DOCUMENTO_MONEDA_LOCAL;
  if (requireForeignRate && currency !== CXP_DOCUMENTO_MONEDA_LOCAL && input.tipoCambio == null) {
    return [{ campo: 'tipoCambio', mensaje: 'Ingresa el tipo de cambio de la moneda extranjera; no hay una tasa configurada.' }];
  }
  if (currency === CXP_DOCUMENTO_MONEDA_LOCAL && input.tipoCambio != null && Number(input.tipoCambio) !== 1) {
    return [{ campo: 'tipoCambio', mensaje: 'La moneda local utiliza tipo de cambio 1.' }];
  }
  return [];
}

/** Esquemas y reglas del documento, sin las comprobaciones RF04 de líneas/adjuntos. */
export function documentoCaptureIssues(input: CxpRecord): CxpValidationIssue[] {
  const issues: CxpValidationIssue[] = [];
  const valid: CxpRecord = {};
  for (const [field, schema] of Object.entries(createCxpDocumentoSchema.shape)) {
    const result = schema.safeParse(input[field]);
    if (result.success) valid[field] = result.data as CxpRecord[string];
    else {
      const first = result.error.issues[0];
      const message = first.code === 'invalid_type'
        ? input[field] == null ? 'Este campo es obligatorio.' : 'Ingresa un valor válido para este campo.'
        : first.message;
      issues.push({ campo: field, mensaje: message });
    }
  }
  let calculated = valid;
  try {
    if (!issues.some(issue => [...CXP_DOCUMENTO_IMPORTES, 'tipoCambio'].includes(issue.campo))) {
      calculated = prepareCxpRecord('documentos', valid);
    }
  }
  catch { issues.push({ campo: 'subtotal', mensaje: 'Los importes calculados superan la precisión admitida.' }); }
  issues.push(...validateCxpRecord('documentos', calculated), ...documentoExchangeIssues(input, true));
  // Los mensajes derivados se sitúan junto al dato editable que interviene.
  return issues.map(issue => {
    if (issue.campo === 'totalBruto') return { campo: 'descuentoTotal', mensaje: 'El total bruto no puede ser negativo. Revisa descuentos y ajustes.' };
    if (issue.campo === 'totalNeto') return { campo: 'retencionTotal', mensaje: 'El total neto no puede ser negativo. Revisa retenciones e importes.' };
    if (['totalLocal', 'saldoPendiente'].includes(issue.campo)) return { ...issue, campo: 'subtotal' };
    return issue;
  });
}
