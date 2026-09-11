import type { Connection } from 'oracledb';
import { cxpMoneySum, prepareCxpRecord, type CxpRecord, type CxpResource } from '@erp/contracts';
import { createCxpRepository } from '../repositories/crud.repository';
import { CxpError } from './errors';

/** Todos los cambios de saldo y la aplicación se confirman en una transacción. */
export async function applyCxpMovement(connection: Connection, application: CxpRecord, reverse = false): Promise<CxpRecord> {
  const amount = Number(application.montoTotalAplicado);
  const references: Array<{ resource: CxpResource; id: number }> = [{ resource: 'documentos', id: Number(application.idDocumentoDestino) }];
  if (application.idDocumentoOrigen) references.push({ resource: 'documentos', id: Number(application.idDocumentoOrigen) });
  if (application.idPago) references.push({ resource: 'pagos', id: Number(application.idPago) });
  // Orden estable: dos aplicaciones concurrentes no bloquean los padres en orden inverso.
  references.sort((a, b) => a.resource.localeCompare(b.resource) || a.id - b.id);
  const rows = new Map<string, CxpRecord>();
  for (const reference of references) {
    const row = await createCxpRepository(reference.resource).bind(connection).findById(reference.id, true);
    if (!row) throw new CxpError('No se encontró uno de los documentos o pagos relacionados', 400);
    rows.set(`${reference.resource}:${reference.id}`, row);
  }
  const destination = rows.get(`documentos:${application.idDocumentoDestino}`)!;
  const source = application.idPago ? rows.get(`pagos:${application.idPago}`)! : application.idDocumentoOrigen ? rows.get(`documentos:${application.idDocumentoOrigen}`)! : null;
  if (!reverse) {
    if (destination.naturaleza !== 'D' || ['ANULADA', 'RECHAZADA', 'BLOQUEADA', 'DUPLICADO'].includes(String(destination.estado))) {
      throw new CxpError('El documento de destino no admite aplicaciones en su estado actual');
    }
    if (amount > Number(destination.saldoPendiente)) throw new CxpError('El monto supera el saldo pendiente del documento');
    if (source) {
      if (destination.idProveedor === null || source.idProveedor !== destination.idProveedor) throw new CxpError('El origen y el destino deben pertenecer al mismo proveedor');
      if (source.moneda !== destination.moneda) throw new CxpError('El origen y el destino deben utilizar la misma moneda');
      const available = Number(application.idPago ? source.montoNoAplicado : source.saldoPendiente);
      if (amount > available) throw new CxpError('El monto supera el saldo disponible del origen');
      if (application.idPago && !['EJECUTADO', 'CONFIRMADO', 'PARCIALMENTE_APLICADO', 'APLICADO', 'CONCILIADO'].includes(String(source.estado))) {
        throw new CxpError('Para aplicar el pago, este debe estar ejecutado o confirmado');
      }
      if (application.idDocumentoOrigen && (source.naturaleza !== 'C' || ['ANULADA', 'RECHAZADA', 'BLOQUEADA'].includes(String(source.estado)))) {
        throw new CxpError('El documento de origen debe ser un crédito disponible');
      }
    }
    if (application.tipoAplicacion === 'COMPENSACION_CXC' && application.estadoCxc !== 'CONFIRMADA') {
      throw new CxpError('CxC debe confirmar la compensación antes de aplicarla en CxP');
    }
  }
  const direction = reverse ? -amount : amount;
  const applied = cxpMoneySum(Number(destination.montoAplicado), direction);
  if (applied < 0) throw new CxpError('El saldo del documento no permite esta reversión', 409);
  const updatedDestination = prepareCxpRecord('documentos', { ...destination, montoAplicado: applied });
  const destinationState = Number(updatedDestination.saldoPendiente) === 0 ? 'PAGADA' : applied > 0 ? 'PARCIALMENTE_PAGADA' : 'PENDIENTE_PAGO';
  await createCxpRepository('documentos').bind(connection).update(Number(destination.idDocumento), {
    montoAplicado: applied, saldoPendiente: updatedDestination.saldoPendiente, estado: destinationState,
  });
  if (source) {
    const appliedSource = cxpMoneySum(Number(source.montoAplicado), direction);
    if (appliedSource < 0) throw new CxpError('El saldo del origen no permite esta reversión', 409);
    if (application.idPago) {
      const remaining = cxpMoneySum(Number(source.montoObligacion), -appliedSource);
      await createCxpRepository('pagos').bind(connection).update(Number(source.idPago), {
        montoAplicado: appliedSource, montoNoAplicado: remaining,
        estado: remaining === 0 ? 'APLICADO' : appliedSource > 0 ? 'PARCIALMENTE_APLICADO' : 'CONFIRMADO',
      });
    } else {
      const remaining = cxpMoneySum(Number(source.totalNeto), -appliedSource);
      await createCxpRepository('documentos').bind(connection).update(Number(source.idDocumento), {
        montoAplicado: appliedSource, saldoPendiente: remaining,
        estado: remaining === 0 ? 'APLICADA' : appliedSource > 0 ? 'PARCIALMENTE_APLICADA' : 'APROBADA',
      });
    }
  }
  // La confirmación de CxC es externa a este módulo; aquí solo se afectan saldos CxP.
  return { ...application, saldoAnterior: destination.saldoPendiente, saldoPosterior: updatedDestination.saldoPendiente };
}
