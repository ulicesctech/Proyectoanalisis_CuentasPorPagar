import oracledb, { type Connection } from 'oracledb';
import { createCxpAplicacionSchema, type CxpRecord } from '@erp/contracts';
import { z } from 'zod';
import { getConnection } from '../../../../config/database';
import { createCxpRepository, mapRow, options, selection, withCxpTransaction } from '../../repositories/crud.repository';
import { applyCxpMovement } from '../application.service';
import { CxpError } from '../errors';
import { assertCxpDocumentoForApplication } from './documento.policy';

const paymentInput = z.strictObject({
  idPago: z.number().int().positive(),
  monto: z.number().finite().positive(),
  aplicadoPor: z.number().int().positive(),
});
const reversalInput = z.strictObject({
  revertidoPor: z.number().int().positive(),
  motivoReverso: z.string().trim().min(1).max(1000),
});

function validId(id: number): number {
  if (!Number.isSafeInteger(id) || id <= 0) throw new CxpError('Identificador inválido');
  return id;
}

async function assertUserExists(connection: Connection, id: number) {
  const result = await connection.execute<{ PRESENTE: number }>(
    'SELECT 1 AS PRESENTE FROM USUARIO WHERE USU_ID_USUARIO = :id', { id },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  if (!result.rows?.length) throw new CxpError('Selecciona un usuario existente para registrar la operación', 400);
}

export async function listDocumentoEligiblePaymentsWithConnection(connection: Connection, id: number, search = '') {
  const document = await createCxpRepository('documentos').bind(connection).findById(validId(id));
  if (!document) throw new CxpError('Documento no encontrado', 404);
  assertCxpDocumentoForApplication(document, 'destino');
  if (document.idProveedor == null) throw new CxpError('El documento no tiene proveedor', 409);
  const term = search.trim().slice(0, 100);
  const result = await connection.execute<Record<string, string | number | null>>(
    `SELECT ${selection('pagos')} FROM CXP_PAGO
       WHERE ID_PROVEEDOR = :idProveedor AND MONEDA = :moneda
         AND TIPO_PAGO = 'ORDINARIO' AND MONTO_NO_APLICADO > 0
         AND ESTADO IN ('EJECUTADO', 'CONFIRMADO', 'PARCIALMENTE_APLICADO', 'APLICADO', 'CONCILIADO')
         ${term ? 'AND (UPPER(CODIGO_PAGO) LIKE UPPER(:search) OR TO_CHAR(ID_PAGO) LIKE :search)' : ''}
       ORDER BY ID_PAGO DESC FETCH FIRST 50 ROWS ONLY`,
    { idProveedor: document.idProveedor, moneda: document.moneda, ...(term ? { search: `%${term}%` } : {}) },
    options('pagos'),
  );
  return (result.rows ?? []).map(row => mapRow('pagos', row));
}

export async function listDocumentoEligiblePayments(id: number, search = '') {
  const connection = await getConnection();
  try { return await listDocumentoEligiblePaymentsWithConnection(connection, id, search); }
  finally { await connection.close(); }
}

export function createDocumentoPaymentOperations(run: typeof withCxpTransaction = withCxpTransaction) {
  return {
    async apply(id: number, raw: unknown) {
      validId(id);
      const { idPago, monto, aplicadoPor } = paymentInput.parse(raw);
      const cents = Math.round(monto * 100);
      if (!Number.isSafeInteger(cents) || Math.abs(monto * 100 - cents) > 1e-7) {
        throw new CxpError('Ingresa un monto positivo con máximo dos decimales');
      }
      return run(async connection => {
        await assertUserExists(connection, aplicadoPor);
        const application = createCxpAplicacionSchema.parse({
          idDocumentoDestino: id, idPago, tipoAplicacion: 'PAGO',
          montoPrincipal: cents / 100, montoTotalAplicado: cents / 100,
          estado: 'APLICADA', aplicadoPor,
        }) as CxpRecord;
        const moved = await applyCxpMovement(connection, application, false, 'ORDINARIO');
        const repository = createCxpRepository('aplicaciones').bind(connection);
        const createdId = await repository.create(moved);
        return (await repository.findById(createdId))!;
      });
    },
    async reverse(id: number, applicationId: number, raw: unknown) {
      validId(id); validId(applicationId);
      const { revertidoPor, motivoReverso } = reversalInput.parse(raw);
      return run(async connection => {
        const repository = createCxpRepository('aplicaciones').bind(connection);
        const current = await repository.findById(applicationId, true);
        if (!current || Number(current.idDocumentoDestino) !== id || current.tipoAplicacion !== 'PAGO') {
          throw new CxpError('La aplicación no pertenece a este documento', 404);
        }
        if (current.estado !== 'APLICADA') throw new CxpError('Esta aplicación ya no se puede revertir', 409);
        await assertUserExists(connection, revertidoPor);
        const timestamp = await connection.execute<{ FECHA: string }>(
          `SELECT TO_CHAR(SYSTIMESTAMP AT TIME ZONE 'America/Guatemala',
            'YYYY-MM-DD"T"HH24:MI:SS.FF6') AS FECHA FROM DUAL`,
          {}, { outFormat: oracledb.OUT_FORMAT_OBJECT },
        );
        await applyCxpMovement(connection, current, true);
        await repository.update(applicationId, {
          estado: 'REVERTIDA', revertidoPor, motivoReverso, fechaReverso: timestamp.rows![0].FECHA,
        });
        return (await repository.findById(applicationId))!;
      });
    },
  };
}

export const documentoPaymentOperations = createDocumentoPaymentOperations();
