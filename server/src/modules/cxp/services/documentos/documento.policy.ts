import type { CxpRecord, CxpValidationIssue } from '@erp/contracts';
import { CxpError } from '../errors';

// El CRUD común solo registra y corrige documentos antes de RF04. Las transiciones
// de validación y aprobación deberán vivir en operaciones controladas separadas.
const initialStates = new Set(['RECIBIDO', 'BORRADOR', 'PENDIENTE_CLASIFICACION']);

const debitApplicationStates = new Set([
  'APROBADA', 'CONTABILIZADA', 'PENDIENTE_PAGO', 'PROGRAMADA_PAGO',
  'PARCIALMENTE_PAGADA', 'PARCIALMENTE_APLICADA', 'VENCIDA',
]);

const creditApplicationStates = new Set(['APROBADA', 'CONTABILIZADA', 'PARCIALMENTE_APLICADA']);

const protectedFields = [
  'idProveedor', 'tipoDocumento', 'naturaleza', 'origenIngreso', 'tipoRegistro',
  'idCompromiso', 'idDocumentoRelacionado',
  'serie', 'numeroDocumento', 'uuidFiscal', 'nitEmisor', 'hashOrigen',
  'moneda', 'tipoCambio',
  'idCondicionCredito', 'fechaDocumento', 'fechaVencimiento', 'diasCredito',
  'subtotal', 'descuentoTotal', 'impuestoTotal', 'retencionTotal',
  'recargoTotal', 'gastoAdicionalTotal', 'diferenciaRedondeo',
] as const;

function guatemalaCalendarDate(now: Date): string {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function collectCxpDocumentoCalendarDateIssues(input: CxpRecord, now = new Date()): CxpValidationIssue[] {
  const fechaDocumento = typeof input.fechaDocumento === 'string' ? input.fechaDocumento.slice(0, 10) : '';
  const fechaVencimiento = typeof input.fechaVencimiento === 'string' ? input.fechaVencimiento.slice(0, 10) : '';
  const issues: CxpValidationIssue[] = [];
  if (input.naturaleza === 'D' && fechaDocumento && fechaVencimiento && fechaVencimiento < fechaDocumento) {
    issues.push({ campo: 'fechaVencimiento', mensaje: 'El vencimiento no puede ser anterior a la fecha del documento' });
  }
  if (input.origenIngreso === 'FACTURACION_ELECTRONICA' && input.estado === 'RECIBIDO' &&
      fechaDocumento && fechaDocumento > guatemalaCalendarDate(now)) {
    issues.push({ campo: 'fechaDocumento', mensaje: 'La fecha del DTE recibido no puede ser futura' });
  }
  return issues;
}

export function assertCxpDocumentoCalendarDates(input: CxpRecord, now = new Date()): void {
  const issues = collectCxpDocumentoCalendarDateIssues(input, now);
  if (issues.length) throw new CxpError('Revisa las fechas del documento', 400, issues);
}

export function assertCxpDocumentoCreateState(input: CxpRecord): void {
  if (input.origenIngreso === 'FACTURACION_ELECTRONICA' && input.estado !== 'RECIBIDO') {
    throw new CxpError('Un DTE debe ingresar en estado RECIBIDO', 409);
  }
  if (!initialStates.has(String(input.estado))) {
    throw new CxpError('El documento debe ingresar antes de validarse y aprobarse', 409);
  }
}

export function assertCxpDocumentoCrudChange(current: CxpRecord, patch: CxpRecord): void {
  if (Object.hasOwn(patch, 'estado') && patch.estado !== current.estado) {
    throw new CxpError('La validación y aprobación del documento requieren operaciones controladas', 409);
  }
  if ((!initialStates.has(String(current.estado)) || Number(current.montoAplicado) > 0) && protectedFields.some(field =>
    Object.hasOwn(patch, field) && patch[field] !== current[field]
  )) {
    throw new CxpError('Los datos financieros de un documento validado o aplicado requieren una corrección controlada', 409);
  }
}

export function assertCxpDocumentoComponentsEditable(documento: CxpRecord): void {
  if (!initialStates.has(String(documento.estado))) {
    throw new CxpError('El detalle y los tributos de un documento validado requieren una corrección controlada', 409);
  }
}

export function assertCxpDocumentoForApplication(documento: CxpRecord, role: 'destino' | 'origen'): void {
  const expectedNature = role === 'destino' ? 'D' : 'C';
  const allowedStates = role === 'destino' ? debitApplicationStates : creditApplicationStates;
  if (documento.naturaleza !== expectedNature || !allowedStates.has(String(documento.estado))) {
    throw new CxpError(`El documento de ${role} debe estar aprobado y disponible para esta aplicación`, 409);
  }
  if (role === 'destino' && documento.tipoDocumento === 'FACTURA_ESPECIAL' && documento.estado === 'APROBADA') {
    throw new CxpError('La factura especial debe emitirse antes de recibir pagos', 409);
  }
  const balance = Number(documento.saldoPendiente);
  if (!Number.isFinite(balance) || balance <= 0) {
    throw new CxpError(`El documento de ${role} no tiene saldo disponible`, 409);
  }
}
