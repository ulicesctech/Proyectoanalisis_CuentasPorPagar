import type { Connection } from 'oracledb';
import type { CxpRecord, CxpValidationIssue } from '@erp/contracts';
import { getConnection } from '../../../../config/database';
import { findActiveDocumentoCreditCondition } from '../../repositories/documentos/documentoDueDate.repository';
import { CxpError } from '../errors';

type SuppliedTerms = {
  fechaVencimiento?: unknown;
  diasCredito?: unknown;
};

export type DocumentoDueDate = {
  idCondicionCredito: number;
  diasCredito: number;
  fechaVencimiento: string;
  tipo: 'CONTADO' | 'CREDITO';
};

function calendarDate(value: unknown, field: string): string {
  const text = typeof value === 'string' ? value.slice(0, 10) : '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) throw new CxpError('No se pudo calcular el vencimiento', 422, [
    { campo: field, mensaje: 'Ingresa una fecha de documento válida' },
  ]);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== text) throw new CxpError('No se pudo calcular el vencimiento', 422, [
    { campo: field, mensaje: 'Ingresa una fecha de calendario válida' },
  ]);
  return text;
}

function validConditionId(value: unknown): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new CxpError('Selecciona una condición de pago', 422, [
    { campo: 'idCondicionCredito', mensaje: 'Selecciona una condición de pago activa' },
  ]);
  return id;
}

function validCreditDays(value: unknown): number {
  const days = Number(value);
  if (!Number.isSafeInteger(days) || days < 0 || days > 9999) throw new CxpError('La condición de pago no es válida', 422, [
    { campo: 'idCondicionCredito', mensaje: 'La condición debe tener entre 0 y 9999 días de crédito' },
  ]);
  return days;
}

export function addCalendarDays(fechaDocumento: string, diasCredito: number): string {
  const base = calendarDate(fechaDocumento, 'fechaDocumento');
  const days = validCreditDays(diasCredito);
  const [year, month, day] = base.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function assertSuppliedTermsMatch(calculated: DocumentoDueDate, supplied: SuppliedTerms): void {
  const issues: CxpValidationIssue[] = [];
  if (supplied.fechaVencimiento != null && String(supplied.fechaVencimiento).slice(0, 10) !== calculated.fechaVencimiento) {
    issues.push({ campo: 'fechaVencimiento', mensaje: `Debe coincidir con el vencimiento calculado: ${calculated.fechaVencimiento}` });
  }
  if (supplied.diasCredito != null && Number(supplied.diasCredito) !== calculated.diasCredito) {
    issues.push({ campo: 'diasCredito', mensaje: `Debe coincidir con la condición seleccionada: ${calculated.diasCredito} días` });
  }
  if (issues.length) throw new CxpError('El vencimiento no coincide con la condición de pago', 422, issues);
}

export async function calculateDocumentoDueDate(
  connection: Connection,
  fechaDocumento: unknown,
  idCondicionCredito: unknown,
): Promise<DocumentoDueDate> {
  const date = calendarDate(fechaDocumento, 'fechaDocumento');
  const id = validConditionId(idCondicionCredito);
  const condition = await findActiveDocumentoCreditCondition(connection, id);
  if (!condition) throw new CxpError('La condición de pago no está disponible', 422, [
    { campo: 'idCondicionCredito', mensaje: 'Selecciona una condición de pago activa' },
  ]);
  const days = validCreditDays(condition.diasCredito);
  return {
    idCondicionCredito: condition.idCondicionCredito,
    diasCredito: days,
    fechaVencimiento: addCalendarDays(date, days),
    tipo: days === 0 ? 'CONTADO' : 'CREDITO',
  };
}

export async function snapshotDocumentoDueDate(
  connection: Connection,
  input: CxpRecord,
  supplied: SuppliedTerms = {},
): Promise<CxpRecord> {
  const calculated = await calculateDocumentoDueDate(connection, input.fechaDocumento, input.idCondicionCredito);
  assertSuppliedTermsMatch(calculated, supplied);
  return {
    ...input,
    idCondicionCredito: calculated.idCondicionCredito,
    diasCredito: calculated.diasCredito,
    fechaVencimiento: calculated.fechaVencimiento,
  };
}

export function recalculateDocumentoDueDateFromSnapshot(input: CxpRecord): CxpRecord {
  const days = validCreditDays(input.diasCredito);
  return { ...input, fechaVencimiento: addCalendarDays(calendarDate(input.fechaDocumento, 'fechaDocumento'), days) };
}

export async function previewDocumentoDueDate(raw: unknown): Promise<DocumentoDueDate> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new CxpError('Datos de vencimiento inválidos');
  const input = raw as Record<string, unknown>;
  const connection = await getConnection();
  try { return await calculateDocumentoDueDate(connection, input.fechaDocumento, input.idCondicionCredito); }
  finally { await connection.close(); }
}
