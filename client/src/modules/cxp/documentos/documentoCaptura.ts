import { createCxpDocumentoSchema, documentoCaptureIssues, prepareCxpRecord, getCxpEntity, CXP_DOCUMENTO_IMPORTES,
  type CxpDocumentoMonedas, type CxpRecord } from '@erp/contracts';
import { cxpFormNumber, cxpFormText, type CxpFormScalar, type CxpFormSource } from '../components/cxpFormValues';

export const documentoAmountHelp: Record<string, string> = {
  subtotal: 'Importe antes de descuentos e impuestos. No repitas conceptos en otros campos.',
  descuentoTotal: 'Importe monetario que se resta; no es un porcentaje.',
  impuestoTotal: 'Importe que se suma. No dupliques impuestos ya incluidos en el subtotal.',
  retencionTotal: 'Importe monetario que se resta del total bruto; no es un porcentaje.',
  recargoTotal: 'Importe que se suma, si no está incluido en otro concepto.',
  gastoAdicionalTotal: 'Importe que se suma. No repitas gastos ya incluidos en el subtotal o recargos.',
  diferenciaRedondeo: 'Ajuste con signo: suma si es positivo y resta si es negativo. No corrige diferencias arbitrarias.',
};

export const documentoNumber = cxpFormNumber;

export function documentoInput(values: CxpFormSource, actorId: number): CxpRecord {
  const fields = getCxpEntity('documentos')!.fields;
  return { ...Object.fromEntries(Object.entries(values)
    .filter(([name]) => Object.prototype.hasOwnProperty.call(createCxpDocumentoSchema.shape, name))
    .map(([name, value]) => {
      const field = fields.find(field => field.name === name)!;
      const text = cxpFormText(value).trim();
      return [name, field.type === 'number'
        ? text === '' && createCxpDocumentoSchema.shape[name].isOptional() ? undefined : documentoNumber(value)
        : text === '' && !field.required ? undefined : text];
    })),
    // Estos controles de captura exigen un valor explícito: su ausencia no activa defaults del esquema.
    moneda: cxpFormText(values.moneda).trim(), subtotal: documentoNumber(values.subtotal),
    tipoCambio: documentoNumber(values.tipoCambio), creadoPor: actorId };
}
export function documentoFormErrors(values: CxpFormSource, actorId: number,
  options: { wizard?: boolean; monedas?: CxpDocumentoMonedas | null } = {}): Record<string, string> {
  const input = documentoInput(values, actorId);
  const errors: Record<string, string> = {};
  for (const issue of documentoCaptureIssues(input)) errors[issue.campo] ??= issue.mensaje;
  if (options.wizard) {
    const required = ['idProveedor', 'idSucursal', 'tipoDocumento', 'fechaDocumento', 'idCondicionCredito', 'moneda', 'tipoCambio', 'subtotal'];
    if (values.origenIngreso === 'FACTURACION_ELECTRONICA') required.push('serie', 'numeroDocumento', 'uuidFiscal');
    for (const name of required) if (!cxpFormText(values[name]).trim()) errors[name] = 'Este campo es obligatorio.';
  }
  for (const field of getCxpEntity('documentos')!.fields) {
    if (field.lookup && values[field.name] && (!Number.isSafeInteger(Number(values[field.name])) || Number(values[field.name]) <= 0)) {
      errors[field.name] = 'Selecciona un registro válido.';
    }
  }
  if (values.naturaleza === 'D' && values.fechaDocumento && values.fechaVencimiento && cxpFormText(values.fechaVencimiento) < cxpFormText(values.fechaDocumento)) {
    errors.fechaVencimiento = 'El vencimiento no puede ser anterior a la fecha del documento.';
  }
  if (options.monedas && !options.monedas.monedas.some(row => row.codigo === values.moneda)) {
    errors.moneda = 'Selecciona una moneda activa del catálogo.';
  }
  if (options.monedas && values.moneda !== options.monedas.monedaLocal && values.fechaTipoCambio &&
    values.fechaDocumento !== values.fechaTipoCambio) {
    errors.tipoCambio = 'Revisa y confirma la tasa para la nueva fecha del documento.';
  }
  return errors;
}

export function cambioDocumento(values: Record<string, string>, name: string, value: string, local: string) {
  const next = { ...values, [name]: value };
  if (name === 'moneda' && value !== values.moneda) {
    next.tipoCambio = value === local ? '1' : '';
    next.fuenteTipoCambio = value === local ? 'Moneda local' : '';
    next.fechaTipoCambio = '';
  }
  if (name === 'tipoCambio' && values.moneda !== local) {
    next.fuenteTipoCambio = 'Ingreso manual';
    next.fechaTipoCambio = values.fechaDocumento || '';
  }
  if (name === 'fechaDocumento' && value !== values.fechaDocumento && values.moneda !== local &&
      values.tipoCambio && values.fechaDocumento && !values.fechaTipoCambio) {
    // Los registros anteriores pueden no tener fecha de tasa; no atribuirla a la fecha nueva.
    next.fechaTipoCambio = values.fechaDocumento;
  }
  return next;
}

export const documentoClearlyInvalid = (name: string, value: CxpFormScalar) => {
  const number = documentoNumber(value);
  return cxpFormText(value).trim() !== '' && Number.isFinite(number) &&
    (name === 'tipoCambio' ? number <= 0 : CXP_DOCUMENTO_IMPORTES.includes(name as typeof CXP_DOCUMENTO_IMPORTES[number]) && name !== 'diferenciaRedondeo' && number < 0);
};

export function documentoPreview(values: CxpFormSource, actorId: number): CxpRecord {
  const input = documentoInput(values, actorId);
  if (CXP_DOCUMENTO_IMPORTES.some(name => input[name] !== undefined && !createCxpDocumentoSchema.shape[name].safeParse(input[name]).success)) return {};
  const rate = Number(input.tipoCambio);
  const validRate = createCxpDocumentoSchema.shape.tipoCambio.safeParse(input.tipoCambio).success && rate > 0;
  try {
    // El total del comprobante no depende del cambio; el local se oculta hasta tener tasa válida.
    const result = prepareCxpRecord('documentos', { ...input, tipoCambio: validRate ? rate : 1 });
    return { totalBruto: result.totalBruto, totalNeto: result.totalNeto,
      totalLocal: validRate ? result.totalLocal : undefined, saldoPendiente: result.saldoPendiente };
  } catch { return {}; }
}
