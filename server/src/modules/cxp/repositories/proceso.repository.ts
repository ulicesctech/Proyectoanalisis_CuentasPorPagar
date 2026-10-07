import { createHash } from 'node:crypto';
import oracledb, { type BindParameters, type Connection } from 'oracledb';

import {
  estadosBandeja,
  type CxpRecord,
  type CxpResource,
  type EtapaProceso,
  type NuevaContrasena,
  type OpcionesProceso,
  type ProcesoPago,
} from '@erp/contracts';

import { cxpCatalogLabel } from './catalogos.repository';
import {
  advancePaymentInstrument,
  bankConfigured,
  issuePaymentInstrument,
  listPreparedCheques,
  paymentMethod,
} from './proceso-bank.repository';
import { getConnection } from '../../../config/database';
import { createCxpRepository, withCxpTransaction } from './crud.repository';
import { CxpError } from '../services/errors';
import { applyCxpMovement } from '../services/application.service';
import type { ProcesoStore, ProcesoTx } from '../services/procesos/ports';

const object = { outFormat: oracledb.OUT_FORMAT_OBJECT };
const eventOptions = {
  ...object,
  fetchInfo: { RESULTADO_JSON: { type: oracledb.STRING } },
};

const estadoMapToDb: Record<EtapaProceso, string> = {
  EMITIDA: 'BORRADOR',
  EN_REVISION: 'PENDIENTE_APROBACION',
  APROBADA: 'APROBADO',
  PROGRAMADA: 'PROGRAMADO',
  CHEQUE_EMITIDO: 'ENVIADO',
  ENTREGADO: 'APLICADO',
  COBRADO: 'CONCILIADO',
  RECHAZADA: 'RECHAZADO',
  ANULADA: 'ANULADO',
};

const estadoMapFromDb: Record<string, EtapaProceso> = {
  BORRADOR: 'EMITIDA',
  PENDIENTE_APROBACION: 'EN_REVISION',
  APROBADO: 'APROBADA',
  PROGRAMADO: 'PROGRAMADA',
  ENVIADO: 'CHEQUE_EMITIDO',
  EN_PROCESO: 'CHEQUE_EMITIDO',
  EJECUTADO: 'ENTREGADO',
  CONFIRMADO: 'ENTREGADO',
  PARCIALMENTE_APLICADO: 'ENTREGADO',
  APLICADO: 'ENTREGADO',
  CONCILIADO: 'COBRADO',
  RECHAZADO: 'RECHAZADA',
  DEVUELTO: 'ANULADA',
  ANULADO: 'ANULADA',
};

function dbStatesFor(state: EtapaProceso): string[] {
  if (state === 'CHEQUE_EMITIDO') return ['ENVIADO', 'EN_PROCESO'];
  if (state === 'ENTREGADO') return ['EJECUTADO', 'CONFIRMADO', 'PARCIALMENTE_APLICADO', 'APLICADO'];
  return [estadoMapToDb[state]];
}

function paymentCode(id: number) {
  return `CP-${String(id).padStart(8, '0')}`;
}

function parseEventResult(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

async function period(connection: Connection, branch: number, date: string) {
  const result = await connection.execute<{ ESTADO: string }>(
    `SELECT ESTADO
       FROM CXP_PERIODO
      WHERE ID_SUCURSAL = :branch
        AND FECHA_INICIO <= TO_DATE(:day, 'YYYY-MM-DD')
        AND FECHA_FIN >= TO_DATE(:day, 'YYYY-MM-DD')
      FOR UPDATE`,
    { branch, day: date },
    object,
  );

  if (result.rows?.length !== 1 || !['ABIERTO', 'REABIERTO'].includes(result.rows[0].ESTADO)) {
    throw new CxpError('Debe existir exactamente un período abierto para la sucursal y fecha de la operación', 409);
  }
}

type PaymentRow = {
  ID_PAGO: number;
  ID_LOTE: number | null;
  ID_PROVEEDOR: number;
  ID_SUCURSAL: number;
  ID_FORMA_PAGO: number;
  FORMA_PAGO_NOMBRE: string;
  ID_CUENTA_ORIGEN: number;
  ID_CUENTA_DESTINO: number;
  CODIGO_PAGO: string;
  FECHA_PROGRAMADA: string;
  MONEDA: string;
  TIPO_CAMBIO: number;
  MONTO_OBLIGACION: number;
  NUMERO_CHEQUE: string | null;
  CLAVE_IDEMPOTENCIA: string;
  ESTADO: string;
  PROGRAMADO_POR: number;
  EJECUTADO_POR: number | null;
  CONCILIADO_POR: number | null;
  VERSION: string;
};

async function readProcess(connection: Connection, id: number, lock: boolean): Promise<ProcesoPago> {
  const payment = await connection.execute<PaymentRow>(
    `SELECT P.ID_PAGO, P.ID_LOTE, P.ID_PROVEEDOR, P.ID_SUCURSAL,
            P.ID_FORMA_PAGO, F.NOMBRE FORMA_PAGO_NOMBRE, P.ID_CUENTA_ORIGEN, P.ID_CUENTA_DESTINO,
            P.CODIGO_PAGO,
            TO_CHAR(P.FECHA_PROGRAMADA, 'YYYY-MM-DD') FECHA_PROGRAMADA,
            P.MONEDA, P.TIPO_CAMBIO, P.MONTO_OBLIGACION, P.NUMERO_CHEQUE,
            P.CLAVE_IDEMPOTENCIA, P.ESTADO, P.PROGRAMADO_POR,
            P.EJECUTADO_POR, P.CONCILIADO_POR,
            TO_CHAR(P.FECHA_MODIFICACION, 'YYYY-MM-DD"T"HH24:MI:SS.FF6') VERSION
       FROM CXP_PAGO P
       JOIN CXC_FORMAS_PAGO F ON F.ID_FORMA_PAGO = P.ID_FORMA_PAGO
      WHERE P.ID_PAGO = :id${lock ? ' FOR UPDATE' : ''}`,
    { id },
    object,
  );
  const row = payment.rows?.[0];
  if (!row) throw new CxpError('Solicitud de pago no encontrada', 404);

  const apps = await connection.execute<{
    ID_APLICACION: number;
    ID_DOCUMENTO_DESTINO: number;
    NUMERO_DOCUMENTO: string | null;
    NO_FACTURA_COMPRA: string | null;
    MONTO_TOTAL_APLICADO: number;
    ESTADO: string;
  }>(
    `SELECT A.ID_APLICACION, A.ID_DOCUMENTO_DESTINO,
            D.NUMERO_DOCUMENTO, D.NO_FACTURA_COMPRA,
            A.MONTO_TOTAL_APLICADO, A.ESTADO
       FROM CXP_APLICACION A
       JOIN CXP_DOCUMENTO D ON D.ID_DOCUMENTO = A.ID_DOCUMENTO_DESTINO
      WHERE A.ID_PAGO = :id
        AND A.TIPO_APLICACION = 'PAGO'
        AND A.ESTADO <> 'CANCELADA'
      ORDER BY A.ID_APLICACION`,
    { id },
    object,
  );

  const approvals = await connection.execute<{
    ID_APROBACION: number;
    ID_REGLA: number;
    NOMBRE_REGLA: string;
    NIVEL: number;
    ID_ROL_APROBADOR: number;
    ID_USUARIO_APROBADOR: number | null;
    ESTADO: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'DELEGADA' | 'CANCELADA';
  }>(
    `SELECT A.ID_APROBACION, A.ID_REGLA,
            NVL(R.NOMBRE_REGLA, 'Regla #' || TO_CHAR(A.ID_REGLA)) NOMBRE_REGLA,
            A.NIVEL, A.ID_ROL_APROBADOR, A.ID_USUARIO_APROBADOR, A.ESTADO
       FROM CXP_APROBACION A
       LEFT JOIN CXP_REGLA_APROBACION R ON R.ID_REGLA = A.ID_REGLA
      WHERE A.ID_PAGO = :id
         OR A.ID_LOTE = :lot
      ORDER BY A.NIVEL, A.ID_APROBACION`,
    { id, lot: row.ID_LOTE },
    object,
  );

  const events = await connection.execute<{
    TIPO_EVENTO: string;
    DETALLE: string | null;
    USUARIO_EVENTO: number;
    FECHA_EVENTO: string;
    RESULTADO_JSON: string | null;
  }>(
    `SELECT TIPO_EVENTO, DETALLE, USUARIO_EVENTO,
            TO_CHAR(FECHA_EVENTO, 'YYYY-MM-DD"T"HH24:MI:SS.FF6') FECHA_EVENTO,
            RESULTADO_JSON
       FROM CXP_EVENTO
      WHERE ID_PAGO = :id
      ORDER BY ID_EVENTO`,
    { id },
    eventOptions,
  );

  const eventRows = events.rows ?? [];
  const creatorEvent = eventRows.find(event => event.TIPO_EVENTO === 'CREAR');
  const requestEvent = eventRows.find(event => event.TIPO_EVENTO === 'SOLICITAR');
  const deliveryEvent = [...eventRows].reverse().find(event => event.TIPO_EVENTO === 'ENTREGAR');
  const deliveryResult = parseEventResult(deliveryEvent?.RESULTADO_JSON);

  let cheque: ProcesoPago['cheque'];
  if (row.NUMERO_CHEQUE) {
    const chequeResult = await connection.execute<{
      CHEQUE_ID: number;
      NUMERO_CHEQUE: number;
      CUENTA_ID: number;
      MONTO: number;
      ESTADO: string;
    }>(
      `SELECT C.CHEQUE_ID, C.NUMERO_CHEQUE, Q.CUENTA_ID, C.MONTO, C.ESTADO
         FROM MB_CHEQUE C
         JOIN MB_CHEQUERA Q ON Q.CHEQUERA_ID = C.CHEQUERA_ID
        WHERE C.PAGO_ID = :id
        FETCH FIRST 1 ROW ONLY`,
      { id },
      object,
    );
    const bank = chequeResult.rows?.[0];
    if (bank) {
      const bankState: Record<string, NonNullable<ProcesoPago['cheque']>['estado']> = {
        RESERVADO: 'PREPARADO',
        EMITIDO: 'EMITIDO',
        IMPRESO: 'EMITIDO',
        ENTREGADO: 'ENTREGADO',
        COBRADO: 'COBRADO',
        ANULADO: 'ANULADO',
        EXTRAVIADO: 'ANULADO',
        REPUESTO: 'ANULADO',
      };
      cheque = {
        id: String(bank.CHEQUE_ID),
        numero: String(bank.NUMERO_CHEQUE),
        cuenta: String(bank.CUENTA_ID),
        moneda: row.MONEDA.trim(),
        proveedor: row.ID_PROVEEDOR,
        importe: Number(bank.MONTO),
        estado: bankState[bank.ESTADO] ?? 'EMITIDO',
      };
    }
  }

  let transferencia: ProcesoPago['transferencia'];
  if (/TRANSFERENCIA/i.test(row.FORMA_PAGO_NOMBRE)) {
    const transferResult = await connection.execute<{
      TRANSFERENCIA_ID: number;
      CUENTA_ORIGEN_ID: number;
      CTA_PROVEEDOR_ID: number | null;
      MONTO_ORIGEN: number;
      ESTADO: string;
      REFERENCIA_BANCARIA: string | null;
    }>(
      `SELECT TRANSFERENCIA_ID, CUENTA_ORIGEN_ID, CTA_PROVEEDOR_ID,
              MONTO_ORIGEN, ESTADO, REFERENCIA_BANCARIA
         FROM MB_TRANSFERENCIA_BANCARIA
        WHERE PAGO_ID = :id
        ORDER BY TRANSFERENCIA_ID DESC
        FETCH FIRST 1 ROW ONLY`,
      { id },
      object,
    );
    const bank = transferResult.rows?.[0];
    if (bank) {
      transferencia = {
        id: String(bank.TRANSFERENCIA_ID),
        cuentaOrigen: String(bank.CUENTA_ORIGEN_ID),
        cuentaDestino: String(bank.CTA_PROVEEDOR_ID ?? ''),
        moneda: row.MONEDA.trim(),
        proveedor: row.ID_PROVEEDOR,
        importe: Number(bank.MONTO_ORIGEN),
        estado: bank.ESTADO === 'EJECUTADA'
          ? 'EJECUTADA'
          : ['ANULADA', 'RECHAZADA'].includes(bank.ESTADO)
            ? 'ANULADA'
            : 'PROGRAMADA',
        referencia: bank.REFERENCIA_BANCARIA ?? undefined,
      };
    }
  }

  const estado = estadoMapFromDb[row.ESTADO];
  if (!estado) throw new CxpError(`Estado de pago no soportado por RF07/RF10: ${row.ESTADO}`, 409);

  return {
    id: row.ID_PAGO,
    codigo: row.CODIGO_PAGO,
    clave: row.CLAVE_IDEMPOTENCIA,
    version: row.VERSION,
    estado,
    proveedorNombre: await cxpCatalogLabel(connection, 'proveedores', row.ID_PROVEEDOR),
    creador: creatorEvent?.USUARIO_EVENTO ?? row.PROGRAMADO_POR,
    solicitante: requestEvent?.USUARIO_EVENTO,
    proveedor: row.ID_PROVEEDOR,
    sucursal: row.ID_SUCURSAL,
    moneda: row.MONEDA.trim(),
    tipoCambio: Number(row.TIPO_CAMBIO),
    total: Number(row.MONTO_OBLIGACION),
    formaPago: row.ID_FORMA_PAGO,
    formaPagoNombre: row.FORMA_PAGO_NOMBRE.trim(),
    documentos: (apps.rows ?? []).map(application => ({
      id: application.ID_DOCUMENTO_DESTINO,
      numero: application.NUMERO_DOCUMENTO || application.NO_FACTURA_COMPRA || String(application.ID_DOCUMENTO_DESTINO),
      importe: Number(application.MONTO_TOTAL_APLICADO),
    })),
    aprobaciones: (approvals.rows ?? []).map(approval => ({
      id: approval.ID_APROBACION,
      regla: approval.ID_REGLA,
      nombre: approval.NOMBRE_REGLA,
      nivel: approval.NIVEL,
      rol: approval.ID_ROL_APROBADOR,
      usuario: approval.ID_USUARIO_APROBADOR ?? undefined,
      decision: approval.ESTADO === 'DELEGADA' ? 'PENDIENTE' : approval.ESTADO,
    })),
    historial: eventRows.map(event => ({
      fecha: event.FECHA_EVENTO,
      usuario: event.USUARIO_EVENTO,
      nombre: `Usuario #${event.USUARIO_EVENTO}`,
      accion: event.TIPO_EVENTO,
      detalle: event.DETALLE ?? '',
    })),
    pago: row.ID_PAGO,
    lote: row.ID_LOTE ?? undefined,
    fechaProgramada: row.FECHA_PROGRAMADA,
    cheque,
    transferencia,
    aplicaciones: (apps.rows ?? []).filter(application => application.ESTADO === 'APLICADA').map(application => application.ID_APLICACION),
    reimpresiones: eventRows.filter(event => event.TIPO_EVENTO === 'REIMPRIMIR').length,
    receptor: typeof deliveryResult?.receptor === 'string' ? deliveryResult.receptor : undefined,
  };
}

function bind(connection: Connection): ProcesoTx {
  const repo = (resource: CxpResource) => createCxpRepository(resource).bind(connection);

  return {
    providerName: id => cxpCatalogLabel(connection, 'proveedores', id),
    cheques: p => listPreparedCheques(connection, p),
    get: id => readProcess(connection, id, true),

    async byKey(key) {
      const result = await connection.execute<{ ID_PAGO: number }>(
        `SELECT ID_PAGO FROM CXP_PAGO WHERE CLAVE_IDEMPOTENCIA = :key`,
        { key },
        object,
      );
      return result.rows?.[0] ? readProcess(connection, result.rows[0].ID_PAGO, true) : null;
    },

    async insert(p: ProcesoPago, input: NuevaContrasena) {
      const temporaryCode = `TMP-${createHash('sha256').update(input.clave).digest('hex').slice(0, 32)}`;
      const result = await connection.execute<{ id: number[] }>(
        `INSERT INTO CXP_PAGO (
           ID_PROVEEDOR, ID_SUCURSAL, ID_FORMA_PAGO,
           ID_CUENTA_ORIGEN, ID_CUENTA_DESTINO, CODIGO_PAGO,
           TIPO_PAGO, FECHA_PROGRAMADA, MONEDA, TIPO_CAMBIO,
           MONTO_OBLIGACION, MONTO_DESCUENTO, MONTO_RETENCION,
           MONTO_COMISION, MONTO_TRANSFERIDO, MONTO_APLICADO,
           MONTO_NO_APLICADO, CONCEPTO, ESTADO_CONTABLE,
           CLAVE_IDEMPOTENCIA, ESTADO, PROGRAMADO_POR,
           FECHA_CREACION, FECHA_MODIFICACION
         ) VALUES (
           :provider, :branch, :paymentMethod,
           :originAccount, :destinationAccount, :code,
           'ORDINARIO', TO_DATE(:scheduled, 'YYYY-MM-DD'), :currency, :exchangeRate,
           :amount, 0, 0,
           0, :amount, 0,
           :amount, :concept, 'PENDIENTE',
           :idempotencyKey, 'BORRADOR', :responsible,
           SYSTIMESTAMP, SYSTIMESTAMP
         )
         RETURNING ID_PAGO INTO :id`,
        {
          provider: p.proveedor,
          branch: p.sucursal,
          paymentMethod: input.idFormaPago,
          originAccount: input.idCuentaOrigen,
          destinationAccount: input.idCuentaDestino,
          code: temporaryCode,
          scheduled: input.fecha,
          currency: p.moneda,
          exchangeRate: p.tipoCambio,
          amount: p.total,
          concept: `Solicitud de pago de ${p.documentos.length} documento(s)`,
          idempotencyKey: p.clave,
          responsible: p.creador,
          id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
      );
      const id = result.outBinds?.id?.[0];
      if (!id) throw new CxpError('No se pudo crear la solicitud de pago');

      const code = paymentCode(id);
      await connection.execute(
        `UPDATE CXP_PAGO
            SET CODIGO_PAGO = :code,
                FECHA_MODIFICACION = SYSTIMESTAMP
          WHERE ID_PAGO = :id`,
        { code, id },
      );

      const versionResult = await connection.execute<{ VERSION: string }>(
        `SELECT TO_CHAR(FECHA_MODIFICACION, 'YYYY-MM-DD"T"HH24:MI:SS.FF6') VERSION
           FROM CXP_PAGO WHERE ID_PAGO = :id`,
        { id },
        object,
      );
      p.id = id;
      p.pago = id;
      p.codigo = code;
      p.fechaProgramada = input.fecha;
      p.version = versionResult.rows?.[0]?.VERSION ?? '';
      return id;
    },

    async save(p) {
      if (!p.version) throw new CxpError('Actualiza el proceso antes de continuar', 409);
      const dbState = estadoMapToDb[p.estado];
      const result = await connection.execute(
        `UPDATE CXP_PAGO
            SET ID_LOTE = :lot,
                FECHA_PROGRAMADA = TO_DATE(:scheduled, 'YYYY-MM-DD'),
                ESTADO = :state,
                FECHA_MODIFICACION = SYSTIMESTAMP
          WHERE ID_PAGO = :id
            AND FECHA_MODIFICACION = TO_TIMESTAMP(:expectedVersion, 'YYYY-MM-DD"T"HH24:MI:SS.FF6')`,
        {
          id: p.id,
          lot: p.lote ?? null,
          scheduled: p.fechaProgramada,
          state: dbState,
          expectedVersion: p.version,
        },
      );
      if (result.rowsAffected !== 1) {
        throw new CxpError('Otro usuario modificó este proceso. Actualiza antes de continuar', 409);
      }

      const event = p.historial[p.historial.length - 1];
      if (event) {
        const resultJson = event.accion === 'ENTREGAR' && p.receptor
          ? JSON.stringify({ receptor: p.receptor })
          : null;
        await connection.execute(
          `INSERT INTO CXP_EVENTO (
             ID_PAGO, TIPO_EVENTO, ASUNTO, DETALLE,
             MONTO_RELACIONADO, CANAL, RESULTADO_JSON,
             USUARIO_EVENTO, FECHA_EVENTO
           ) VALUES (
             :payment, :eventType, :subject, :detail,
             :amount, 'SISTEMA', :resultJson,
             :userId, TO_TIMESTAMP(:eventDate, 'YYYY-MM-DD"T"HH24:MI:SS.FF3')
           )`,
          {
            payment: p.id,
            eventType: event.accion.slice(0, 30),
            subject: event.accion.slice(0, 250),
            detail: event.detalle.slice(0, 2000),
            amount: p.total,
            resultJson,
            userId: event.usuario,
            eventDate: event.fecha.slice(0, 23),
          },
        );
      }

      const version = await connection.execute<{ VERSION: string }>(
        `SELECT TO_CHAR(FECHA_MODIFICACION, 'YYYY-MM-DD"T"HH24:MI:SS.FF6') VERSION
           FROM CXP_PAGO WHERE ID_PAGO = :id`,
        { id: p.id },
        object,
      );
      p.version = version.rows?.[0]?.VERSION ?? p.version;
    },

    async reserve(p) {
      for (const document of p.documentos) {
        const row = await repo('documentos').findById(document.id, true);
        if (!row) throw new CxpError('Uno de los documentos ya no existe', 409);

        const active = await connection.execute(
          `SELECT 1
             FROM CXP_APLICACION A
             JOIN CXP_PAGO P ON P.ID_PAGO = A.ID_PAGO
            WHERE A.ID_DOCUMENTO_DESTINO = :documentId
              AND A.TIPO_APLICACION = 'PAGO'
              AND (A.ESTADO = 'PENDIENTE'
                   OR (A.ESTADO = 'APLICADA' AND P.CODIGO_PAGO LIKE 'CP-%'))
              AND P.ESTADO NOT IN ('RECHAZADO', 'DEVUELTO', 'ANULADO')
              AND P.ID_PAGO <> :paymentId
            FETCH FIRST 1 ROW ONLY`,
          { documentId: document.id, paymentId: p.id },
          object,
        );
        if (active.rows?.length) throw new CxpError(`El documento ${document.numero} ya está comprometido en otro proceso`, 409);

        await connection.execute(
          `INSERT INTO CXP_APLICACION (
             ID_DOCUMENTO_DESTINO, ID_PAGO, TIPO_APLICACION,
             FECHA_APLICACION, MONTO_PRINCIPAL, MONTO_DESCUENTO,
             MONTO_RETENCION, DIFERENCIA_CAMBIARIA, MONTO_TOTAL_APLICADO,
             SALDO_ANTERIOR, SALDO_POSTERIOR, ESTADO_CXC,
             ESTADO, APLICADO_POR
           ) VALUES (
             :documentId, :paymentId, 'PAGO',
             SYSTIMESTAMP, :amount, 0,
             0, 0, :amount,
             :balance, :balance, 'NO_APLICA',
             'PENDIENTE', :responsible
           )`,
          {
            documentId: document.id,
            paymentId: p.id,
            amount: document.importe,
            balance: Number(row.saldoPendiente),
            responsible: p.creador,
          },
        );
      }
    },

    async release(p) {
      await connection.execute(
        `UPDATE CXP_APLICACION
            SET ESTADO = 'CANCELADA'
          WHERE ID_PAGO = :id
            AND TIPO_APLICACION = 'PAGO'
            AND ESTADO = 'PENDIENTE'`,
        { id: p.id },
      );
    },

    async row(resource, id) {
      const result = await repo(resource).findById(id, true);
      if (!result) throw new CxpError(`No existe el registro relacionado: ${resource}`, 400);
      return result;
    },

    create: (resource, input) => repo(resource).create(input),
    update: (resource, id, input) => repo(resource).update(id, input),

    async rules() {
      const result = await connection.execute<{ ID_REGLA: number }>(
        `SELECT ID_REGLA FROM CXP_REGLA_APROBACION WHERE ACTIVA = 'S' ORDER BY NIVEL, ID_REGLA`,
        {},
        object,
      );
      const rows: CxpRecord[] = [];
      for (const rule of result.rows ?? []) {
        const value = await repo('reglas-aprobacion').findById(rule.ID_REGLA, true);
        if (value) rows.push(value);
      }
      return rows;
    },

    openPeriod: (branch, date) => period(connection, branch, date),

    async actorExists(actor) {
      const result = await connection.execute(
        `SELECT USU_ID_USUARIO FROM USUARIO WHERE USU_ID_USUARIO = :id`,
        { id: actor.id },
        object,
      );
      if (!result.rows?.length) throw new CxpError('El usuario autenticado no existe en USUARIO', 403);
    },

    paymentMethod: id => paymentMethod(connection, id),

    bankIssue: (p, actor) => issuePaymentInstrument(connection, p, actor),

    bankAdvance: (p, actor, action) => advancePaymentInstrument(connection, p, actor, action),

    async apply(p, actor, now) {
      const candidates = await connection.execute<{ ID_APLICACION: number }>(
        `SELECT ID_APLICACION
           FROM CXP_APLICACION
          WHERE ID_PAGO = :id
            AND TIPO_APLICACION = 'PAGO'
            AND ESTADO = 'PENDIENTE'
          ORDER BY ID_APLICACION`,
        { id: p.id },
        object,
      );
      if (!candidates.rows?.length) throw new CxpError('No hay aplicaciones pendientes para este pago', 409);

      const ids: number[] = [];
      for (const candidate of candidates.rows) {
        const application = await repo('aplicaciones').findById(candidate.ID_APLICACION, true);
        if (!application || application.idPago !== p.id || application.estado !== 'PENDIENTE') {
          throw new CxpError('La aplicación ya fue procesada o cambió durante la operación', 409);
        }
        const pending = {
          ...application,
          aplicadoPor: actor.id,
          fechaAplicacion: now,
        };
        const applied = await applyCxpMovement(connection, pending);
        await repo('aplicaciones').update(candidate.ID_APLICACION, {
          estado: 'APLICADA',
          aplicadoPor: actor.id,
          fechaAplicacion: now,
          saldoAnterior: applied.saldoAnterior,
          saldoPosterior: applied.saldoPosterior,
        });
        ids.push(candidate.ID_APLICACION);
      }
      return ids;
    },

    async reverse(p, actor, now, reason) {
      for (const id of p.aplicaciones) {
        const application = await repo('aplicaciones').findById(id, true);
        if (!application || application.idPago !== p.id || application.estado !== 'APLICADA') {
          throw new CxpError('Una aplicación fue alterada o ya fue revertida. Se requiere revisión', 409);
        }
        await applyCxpMovement(connection, application, true);
        await repo('aplicaciones').update(id, {
          estado: 'REVERTIDA',
          revertidoPor: actor.id,
          fechaReverso: now,
          motivoReverso: reason,
        });
      }
    },
  };
}

export const procesoStore: ProcesoStore = {
  transaction: fn => withCxpTransaction(connection => fn(bind(connection))),

  async list(page, bandeja = 'contrasenas', estado) {
    const connection = await getConnection();
    try {
      const allowed = estadosBandeja[bandeja];
      if (!allowed || (estado && !allowed.includes(estado as EtapaProceso))) {
        throw new CxpError('Bandeja o estado inválido', 400);
      }
      const requested = (estado ? [estado as EtapaProceso] : allowed)
        .flatMap(dbStatesFor)
        .filter((value, index, values) => values.indexOf(value) === index);
      const binds: BindParameters = { offset: (page - 1) * 20 };
      requested.forEach((value, index) => { binds[`state${index}`] = value; });
      const placeholders = requested.map((_, index) => `:state${index}`).join(', ');
      const rows = await connection.execute<{ ID_PAGO: number }>(
        `SELECT ID_PAGO
           FROM CXP_PAGO
          WHERE ESTADO IN (${placeholders})
          ORDER BY ID_PAGO DESC
          OFFSET :offset ROWS FETCH NEXT 21 ROWS ONLY`,
        binds,
        object,
      );
      const ids = (rows.rows ?? []).slice(0, 20).map(row => row.ID_PAGO);
      const data: ProcesoPago[] = [];
      for (const id of ids) data.push(await readProcess(connection, id, false));
      return { data, page, hasMore: (rows.rows?.length ?? 0) > 20 };
    } finally {
      await connection.close();
    }
  },

  async options(search = '', proveedor?: number) {
    const connection = await getConnection();
    try {
      const searchText = search.trim() ? `%${search.trim().toUpperCase()}%` : null;
      const docs = await connection.execute<{
        ID_DOCUMENTO: number;
        NUMERO_DOCUMENTO: string | null;
        NO_FACTURA_COMPRA: string | null;
        ID_PROVEEDOR: number;
        ID_SUCURSAL: number;
        MONEDA: string;
        SALDO_PENDIENTE: number;
      }>(
        `SELECT D.ID_DOCUMENTO, D.NUMERO_DOCUMENTO, D.NO_FACTURA_COMPRA,
                D.ID_PROVEEDOR, D.ID_SUCURSAL, D.MONEDA, D.SALDO_PENDIENTE
           FROM CXP_DOCUMENTO D
          WHERE :provider IS NOT NULL
            AND D.ID_PROVEEDOR = :provider
            AND (:search IS NULL
                 OR UPPER(NVL(D.NUMERO_DOCUMENTO, D.NO_FACTURA_COMPRA)) LIKE :search
                 OR TO_CHAR(D.ID_DOCUMENTO) LIKE :search)
            AND D.NATURALEZA = 'D'
            AND D.POSIBLE_DUPLICADO = 'N'
            AND D.ESTADO IN ('APROBADA', 'CONTABILIZADA', 'PENDIENTE_PAGO', 'PARCIALMENTE_PAGADA', 'VENCIDA')
            AND NOT (D.TIPO_DOCUMENTO = 'FACTURA_ESPECIAL' AND D.ESTADO = 'APROBADA')
            AND D.TIPO_DOCUMENTO <> 'GASTO_CAJA_CHICA'
            AND D.SALDO_PENDIENTE > 0
            AND NOT EXISTS (
              SELECT 1
                FROM CXP_APLICACION A
                JOIN CXP_PAGO P ON P.ID_PAGO = A.ID_PAGO
               WHERE A.ID_DOCUMENTO_DESTINO = D.ID_DOCUMENTO
                 AND A.TIPO_APLICACION = 'PAGO'
                 AND (A.ESTADO = 'PENDIENTE'
                      OR (A.ESTADO = 'APLICADA' AND P.CODIGO_PAGO LIKE 'CP-%'))
                 AND P.ESTADO NOT IN ('RECHAZADO', 'DEVUELTO', 'ANULADO')
            )
          ORDER BY D.ID_DOCUMENTO DESC
          FETCH FIRST 200 ROWS ONLY`,
        {
          provider: { val: proveedor ?? null, type: oracledb.NUMBER },
          search: { val: searchText, type: oracledb.STRING },
        },
        object,
      );

      const accounts = await connection.execute<{
        ID_CUENTA_BANCARIA: number;
        TIPO_TITULAR: string;
        ID_PROVEEDOR: number | null;
        TITULAR: string;
        NUMERO_CUENTA: string;
        MONEDA: string;
      }>(
        `SELECT ID_CUENTA_BANCARIA, TIPO_TITULAR, ID_PROVEEDOR,
                TITULAR, NUMERO_CUENTA, MONEDA
           FROM CXP_CUENTA_BANCARIA
          WHERE ESTADO = 'ACTIVA'
            AND ESTADO_APROBACION = 'APROBADA'
          ORDER BY ID_CUENTA_BANCARIA`,
        {},
        object,
      );

      const forms = await connection.execute<{
        ID_FORMA_PAGO: number;
        NOMBRE: string;
      }>(
        `SELECT ID_FORMA_PAGO, NOMBRE
           FROM CXC_FORMAS_PAGO
          WHERE ESTADO = 'A'
            AND (UPPER(NOMBRE) LIKE '%CHEQUE%' OR UPPER(NOMBRE) LIKE '%TRANSFERENCIA%')
          ORDER BY CASE WHEN UPPER(NOMBRE) LIKE '%TRANSFERENCIA%' THEN 1 ELSE 2 END, ID_FORMA_PAGO`,
        {},
        object,
      );

      const paymentForms = (forms.rows ?? []).map(form => ({
        id: form.ID_FORMA_PAGO,
        nombre: form.NOMBRE.trim(),
        tipo: /CHEQUE/i.test(form.NOMBRE) ? 'CHEQUE' as const : 'TRANSFERENCIA' as const,
      }));
      const formaCheque = paymentForms.find(form => form.tipo === 'CHEQUE')?.id;
      const formaTransferencia = paymentForms.find(form => form.tipo === 'TRANSFERENCIA')?.id;

      const accountRows = accounts.rows ?? [];
      const result: OpcionesProceso = {
        documentos: (docs.rows ?? []).map(document => ({
          id: document.ID_DOCUMENTO,
          nombre: document.NUMERO_DOCUMENTO || document.NO_FACTURA_COMPRA || String(document.ID_DOCUMENTO),
          proveedor: document.ID_PROVEEDOR,
          sucursal: document.ID_SUCURSAL,
          moneda: document.MONEDA.trim(),
          saldo: Number(document.SALDO_PENDIENTE),
        })),
        origenes: accountRows
          .filter(account => account.TIPO_TITULAR === 'EMPRESA')
          .map(account => ({
            id: account.ID_CUENTA_BANCARIA,
            moneda: account.MONEDA.trim(),
            nombre: `${account.TITULAR} · ${account.MONEDA.trim()} · ${account.NUMERO_CUENTA}`,
          })),
        destinos: accountRows
          .filter(account => account.TIPO_TITULAR === 'PROVEEDOR' && account.ID_PROVEEDOR !== null)
          .map(account => ({
            id: account.ID_CUENTA_BANCARIA,
            proveedor: account.ID_PROVEEDOR!,
            moneda: account.MONEDA.trim(),
            nombre: `${account.TITULAR} · ${account.MONEDA.trim()} · ${account.NUMERO_CUENTA}`,
          })),
        formasPago: paymentForms,
        formaCheque,
        formaTransferencia,
        bancosConfigurados: await bankConfigured(connection),
      };
      return result;
    } finally {
      await connection.close();
    }
  },
};
