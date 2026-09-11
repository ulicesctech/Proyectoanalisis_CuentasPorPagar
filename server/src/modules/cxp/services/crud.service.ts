import type { Connection } from 'oracledb';
import {
  CXP_SCHEMAS, getCxpEntity, buildPaginationMeta, prepareCxpRecord, validateCxpRecord,
  type CxpListQuery, type CxpRecord, type CxpResource,
} from '@erp/contracts';
import { createCxpRepository, withCxpTransaction, type CxpRepository } from '../repositories/crud.repository';
import { CXP_TABLES } from '../repositories/definitions';
import { listCxpOptions } from '../repositories/catalogos.repository';
import { applyCxpMovement } from './application.service';
import { CxpError } from './errors';

const deletable: Partial<Record<CxpResource, string[]>> = {
  periodos: ['ABIERTO', 'REABIERTO'],
  compromisos: ['BORRADOR', 'PENDIENTE_APROBACION'],
  documentos: ['RECIBIDO', 'PENDIENTE_CLASIFICACION', 'BORRADOR', 'RECHAZADA'],
  'documentos-tributos': ['CALCULADO'],
  'lotes-pago': ['BORRADOR', 'RECHAZADO'],
  pagos: ['BORRADOR', 'PROGRAMADO', 'PENDIENTE_APROBACION', 'RECHAZADO'],
  aplicaciones: ['PENDIENTE', 'CANCELADA'],
  aprobaciones: ['PENDIENTE', 'CANCELADA'],
  'conciliaciones-proveedor': ['BORRADOR', 'EN_REVISION'],
  'conciliaciones-pago': ['PENDIENTE', 'EN_REVISION', 'RECHAZADO'],
  eventos: ['ABIERTO', 'CANCELADO'],
};

function validId(id: number): number {
  if (!Number.isSafeInteger(id) || id <= 0) throw new CxpError('El identificador debe ser un entero positivo');
  return id;
}

function checked(resource: CxpResource, input: CxpRecord): CxpRecord {
  let prepared: CxpRecord;
  try { prepared = prepareCxpRecord(resource, input); }
  catch (error) { throw new CxpError(error instanceof Error ? error.message : 'Importes inválidos'); }
  const issues = validateCxpRecord(resource, prepared);
  for (const field of getCxpEntity(resource)!.fields) {
    if (field.lookup && field.type === 'number' && prepared[field.name] != null && (!Number.isSafeInteger(prepared[field.name]) || Number(prepared[field.name]) <= 0)) {
      issues.push({ campo: field.name, mensaje: 'Selecciona un registro válido' });
    }
  }
  if (issues.length) throw new CxpError('Revisa los campos indicados', 400, issues);
  return prepared;
}

async function requiredRow(connection: Connection, resource: CxpResource, id: number) {
  const row = await createCxpRepository(resource).bind(connection).findById(id);
  if (!row) throw new CxpError('El registro relacionado ya no existe', 400);
  return row;
}

async function validateRelations(connection: Connection, resource: CxpResource, input: CxpRecord): Promise<void> {
  if (resource === 'pagos' || resource === 'lotes-pago') {
    const origin = await requiredRow(connection, 'cuentas-bancarias', Number(input.idCuentaOrigen));
    if (origin.tipoTitular !== 'EMPRESA') throw new CxpError('La cuenta de origen debe pertenecer a una empresa');
    if (origin.moneda !== input.moneda) throw new CxpError('La moneda debe coincidir con la cuenta de origen');
    if (resource === 'pagos') {
      const destination = await requiredRow(connection, 'cuentas-bancarias', Number(input.idCuentaDestino));
      if (destination.tipoTitular !== 'PROVEEDOR' || destination.idProveedor !== input.idProveedor) throw new CxpError('La cuenta de destino debe pertenecer al proveedor seleccionado');
      if (destination.moneda !== input.moneda) throw new CxpError('La cuenta de destino debe utilizar la moneda del pago');
      if (input.idLote) {
        const batch = await requiredRow(connection, 'lotes-pago', Number(input.idLote));
        if (batch.idCuentaOrigen !== input.idCuentaOrigen || batch.moneda !== input.moneda || batch.idSucursal !== input.idSucursal) throw new CxpError('El pago debe coincidir con la cuenta, moneda y sucursal del lote');
      }
    }
  }
  if (resource === 'documentos-tributos' && input.idDetalle) {
    const detail = await requiredRow(connection, 'documentos-detalle', Number(input.idDetalle));
    if (detail.idDocumento !== input.idDocumento) throw new CxpError('El detalle debe pertenecer al documento seleccionado');
  }
  if (resource === 'conciliaciones-proveedor-detalle' && (input.idDocumento || input.idPago)) {
    const parent = await requiredRow(connection, 'conciliaciones-proveedor', Number(input.idConciliacionProv));
    const related = await requiredRow(connection, input.idDocumento ? 'documentos' : 'pagos', Number(input.idDocumento || input.idPago));
    if (parent.idProveedor !== related.idProveedor) throw new CxpError('El documento o pago debe pertenecer al proveedor de la conciliación');
  }
  if (resource === 'conciliaciones-pago') {
    const payment = await requiredRow(connection, 'pagos', Number(input.idPago));
    if (payment.idCuentaOrigen !== input.idCuentaBancaria) throw new CxpError('La cuenta debe coincidir con la cuenta de origen del pago');
  }
}

function checkChange(resource: CxpResource, current: CxpRecord, input: CxpRecord): void {
  if (['documentos', 'pagos'].includes(resource) && Number(current.montoAplicado) > 0) {
    for (const field of ['idProveedor', 'moneda', 'naturaleza', 'idCuentaOrigen', 'idCuentaDestino']) {
      if (Object.hasOwn(input, field) && input[field] !== current[field]) throw new CxpError('Revierte las aplicaciones antes de cambiar el proveedor, la moneda o las cuentas', 409);
    }
    if (input.estado === 'ANULADA' || input.estado === 'ANULADO') throw new CxpError('Revierte las aplicaciones antes de anular este registro', 409);
  }
  if (resource === 'aplicaciones') {
    if (current.estado === 'REVERTIDA') throw new CxpError('Una aplicación revertida se conserva como historial; registra una nueva aplicación', 409);
    if (current.estado === 'APLICADA') {
      const permitted = ['estado', 'revertidoPor', 'fechaReverso', 'motivoReverso'];
      if (input.estado !== 'REVERTIDA' || Object.keys(input).some(key => !permitted.includes(key) && input[key] !== current[key])) {
        throw new CxpError('Una aplicación confirmada solo puede revertirse indicando responsable, fecha y motivo', 409);
      }
    } else if (input.estado === 'REVERTIDA') throw new CxpError('Solo se puede revertir una aplicación que fue aplicada');
  }
}

export function createCxpService(repository: CxpRepository) {
  const resource = repository.resource;
  const entity = getCxpEntity(resource)!;
  const schema = CXP_SCHEMAS[resource];
  return {
    async list(query: CxpListQuery) {
      const page = query.page === undefined ? 1 : Number(query.page);
      const limit = query.limit === undefined ? 10 : Number(query.limit);
      if (!Number.isSafeInteger(page) || page < 1 || page > 10000000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new CxpError('Paginación inválida');
      if (query.filterField) {
        const field = entity.fields.find(item => item.name === query.filterField);
        if (!field || (!field.lookup && !field.options && !field.identity)) throw new CxpError('Filtro inválido');
        if (field.type === 'number') validId(Number(query.filterValue));
      }
      const result = await repository.findAll({ page, limit, search: query.search?.trim().slice(0, 150), filterField: query.filterField, filterValue: query.filterValue });
      return { data: result.data, meta: buildPaginationMeta(result.total, page, limit) };
    },
    async getOne(id: number) {
      const row = await repository.findById(validId(id));
      if (!row) throw new CxpError(`${entity.singular} no encontrado`, 404);
      return row;
    },
    options(query: { search?: string; selected?: string }) { return listCxpOptions(resource, query); },
    async create(raw: unknown) {
      let input = checked(resource, schema.create.parse(raw) as CxpRecord);
      if (resource === 'aplicaciones' && input.estado === 'REVERTIDA') throw new CxpError('Una aplicación nueva debe registrarse pendiente, aplicada o cancelada');
      return withCxpTransaction(async connection => {
        await validateRelations(connection, resource, input);
        if (resource === 'aplicaciones' && input.estado === 'APLICADA') input = await applyCxpMovement(connection, input);
        const transaction = repository.bind(connection);
        const id = await transaction.create(input);
        return (await transaction.findById(id))!;
      });
    },
    async update(id: number, raw: unknown) {
      validId(id);
      const patch = schema.update.parse(raw) as CxpRecord;
      if (!Object.keys(patch).length) throw new CxpError('No se recibieron campos para actualizar');
      return withCxpTransaction(async connection => {
        const transaction = repository.bind(connection);
        const current = await transaction.findById(id, true);
        if (!current) throw new CxpError(`${entity.singular} no encontrado`, 404);
        checkChange(resource, current, patch);
        let input = checked(resource, { ...current, ...patch });
        await validateRelations(connection, resource, input);
        if (resource === 'aplicaciones' && current.estado !== 'APLICADA' && input.estado === 'APLICADA') input = await applyCxpMovement(connection, input);
        if (resource === 'aplicaciones' && current.estado === 'APLICADA' && input.estado === 'REVERTIDA') {
          await applyCxpMovement(connection, current, true);
          // Se conserva la fotografía del movimiento original, no la de su reversión.
        }
        const changes = Object.fromEntries(Object.entries(input).filter(([key, value]) => key !== entity.idField && value !== current[key]));
        await transaction.update(id, changes);
        return (await transaction.findById(id))!;
      });
    },
    async remove(id: number) {
      validId(id);
      await withCxpTransaction(async connection => {
        const transaction = repository.bind(connection);
        const current = await transaction.findById(id, true);
        if (!current) throw new CxpError(`${entity.singular} no encontrado`, 404);
        if (deletable[resource] && !deletable[resource]!.includes(String(current.estado))) throw new CxpError('El registro ya fue confirmado o cerrado y debe conservarse. Utiliza su anulación o reversión cuando corresponda', 409);
        if (Number(current.montoAplicado) > 0) throw new CxpError('El registro tiene aplicaciones; revierte esas operaciones antes de continuar', 409);
        if (['documentos-detalle', 'documentos-tributos'].includes(resource)) {
          const parent = await requiredRow(connection, 'documentos', Number(current.idDocumento));
          if (!deletable.documentos!.includes(String(parent.estado))) throw new CxpError('No se pueden eliminar componentes de un documento confirmado', 409);
        }
        await transaction.remove(id);
      });
    },
  };
}

export type CxpService = ReturnType<typeof createCxpService>;
