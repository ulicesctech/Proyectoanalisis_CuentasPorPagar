import oracledb, { type Connection } from 'oracledb';
import type {
  ActorProceso,
  ChequeProceso,
  FormaPagoProceso,
  OpcionChequeProceso,
  ProcesoPago,
  TransferenciaProceso,
} from '@erp/contracts';
import { CxpError } from '../services/errors';

const object = { outFormat: oracledb.OUT_FORMAT_OBJECT };

type OriginBankAccount = {
  CUENTA_ID: number;
  EMPRESA_ID: number;
  BANCO_ID: number;
  NUMERO_CUENTA: string;
  PERMITE_CHEQUES: string;
  PERMITE_TRANSFERENCIAS: string;
};

type ProviderBankAccount = {
  CTA_PROVEEDOR_ID: number;
  NUMERO_CUENTA: string;
};

function chequeState(state: string): ChequeProceso['estado'] {
  if (state === 'RESERVADO') return 'PREPARADO';
  if (state === 'ENTREGADO') return 'ENTREGADO';
  if (state === 'COBRADO') return 'COBRADO';
  if (['ANULADO', 'EXTRAVIADO', 'REPUESTO'].includes(state)) return 'ANULADO';
  return 'EMITIDO';
}

function transferState(state: string): TransferenciaProceso['estado'] {
  if (state === 'EJECUTADA') return 'EJECUTADA';
  if (['RECHAZADA', 'ANULADA'].includes(state)) return 'ANULADA';
  return 'PROGRAMADA';
}

export async function paymentMethod(
  connection: Connection,
  id: number,
): Promise<FormaPagoProceso> {
  const result = await connection.execute<{
    ID_FORMA_PAGO: number;
    NOMBRE: string;
  }>(
    `SELECT ID_FORMA_PAGO, NOMBRE
       FROM CXC_FORMAS_PAGO
      WHERE ID_FORMA_PAGO = :id
        AND ESTADO = 'A'`,
    { id },
    object,
  );

  const row = result.rows?.[0];
  if (!row) throw new CxpError('La forma de pago seleccionada no existe o está inactiva', 400);

  const name = row.NOMBRE.trim();
  if (/CHEQUE/i.test(name)) {
    return { id: row.ID_FORMA_PAGO, nombre: name, tipo: 'CHEQUE' };
  }
  if (/TRANSFERENCIA/i.test(name)) {
    return { id: row.ID_FORMA_PAGO, nombre: name, tipo: 'TRANSFERENCIA' };
  }

  throw new CxpError('Para este flujo solo están habilitados CHEQUE y TRANSFERENCIA BANCARIA', 400);
}

export async function bankConfigured(connection: Connection): Promise<boolean> {
  try {
    const tables = await connection.execute<{ TOTAL: number }>(
      `SELECT COUNT(*) TOTAL
         FROM USER_TABLES
        WHERE TABLE_NAME IN (
          'MB_CUENTA_BANCARIA',
          'MB_CUENTA_BANCARIA_PROVEEDOR',
          'MB_CHEQUERA',
          'MB_CHEQUE',
          'MB_TRANSFERENCIA_BANCARIA',
          'MB_OPERACION_BANCARIA'
        )`,
      {},
      object,
    );

    const sequences = await connection.execute<{ TOTAL: number }>(
      `SELECT COUNT(*) TOTAL
         FROM USER_SEQUENCES
        WHERE SEQUENCE_NAME IN (
          'SEQ_MB_OPERACION_BANCARIA',
          'SEQ_MB_CHEQUE',
          'SEQ_MB_TRANSFERENCIA_BANCARIA'
        )`,
      {},
      object,
    );

    return Number(tables.rows?.[0]?.TOTAL ?? 0) === 6 &&
      Number(sequences.rows?.[0]?.TOTAL ?? 0) === 3;
  } catch {
    return false;
  }
}

async function operationType(connection: Connection): Promise<number> {
  const result = await connection.execute<{ CATALOGO_ID: number }>(
    `SELECT CATALOGO_ID
       FROM MB_CATALOGO_BANCARIO
      WHERE GRUPO = 'TIPO_OPERACION'
        AND CODIGO = 'PAGO'
        AND ESTADO = 'ACTIVO'
      ORDER BY CATALOGO_ID DESC
      FETCH FIRST 1 ROW ONLY`,
    {},
    object,
  );
  const id = result.rows?.[0]?.CATALOGO_ID;
  if (!id) throw new CxpError('Bancos no tiene configurado el tipo de operación PAGO', 503);
  return Number(id);
}

async function originBankAccount(
  connection: Connection,
  paymentId: number,
): Promise<OriginBankAccount> {
  const result = await connection.execute<OriginBankAccount>(
    `SELECT M.CUENTA_ID, M.EMPRESA_ID, M.BANCO_ID, M.NUMERO_CUENTA,
            M.PERMITE_CHEQUES, M.PERMITE_TRANSFERENCIAS
       FROM CXP_PAGO P
       JOIN CXP_CUENTA_BANCARIA C
         ON C.ID_CUENTA_BANCARIA = P.ID_CUENTA_ORIGEN
       JOIN MB_CUENTA_BANCARIA M
         ON M.EMPRESA_ID = C.ID_EMPRESA
        AND M.NUMERO_CUENTA = C.NUMERO_CUENTA
       JOIN MB_BANCO B
         ON B.BANCO_ID = M.BANCO_ID
      WHERE P.ID_PAGO = :paymentId
        AND M.ESTADO = 'ACTIVA'
        AND M.PERMITE_PAGOS = 'S'
        AND (
          C.CODIGO_BANCO IS NULL
          OR UPPER(TRIM(B.CODIGO_BANCO)) = UPPER(TRIM(C.CODIGO_BANCO))
          OR UPPER(TRIM(B.NOMBRE)) LIKE '%' || UPPER(TRIM(C.BANCO_NOMBRE)) || '%'
        )
      ORDER BY M.CUENTA_ID`,
    { paymentId },
    object,
  );

  const rows = result.rows ?? [];
  if (rows.length === 0) {
    throw new CxpError(
      'La cuenta origen de CxP no está registrada en Bancos para la misma empresa, banco y número de cuenta',
      409,
    );
  }
  if (rows.length > 1) {
    throw new CxpError('Bancos tiene más de una cuenta compatible con la cuenta origen de CxP', 409);
  }
  return rows[0];
}

async function providerBankAccount(
  connection: Connection,
  paymentId: number,
): Promise<ProviderBankAccount> {
  const result = await connection.execute<ProviderBankAccount>(
    `SELECT M.CTA_PROVEEDOR_ID, M.NUMERO_CUENTA
       FROM CXP_PAGO P
       JOIN CXP_CUENTA_BANCARIA C
         ON C.ID_CUENTA_BANCARIA = P.ID_CUENTA_DESTINO
       JOIN MB_CUENTA_BANCARIA_PROVEEDOR M
         ON M.PROVEEDOR_ID = P.ID_PROVEEDOR
        AND M.NUMERO_CUENTA = C.NUMERO_CUENTA
       JOIN MB_BANCO B
         ON B.BANCO_ID = M.BANCO_ID
      WHERE P.ID_PAGO = :paymentId
        AND M.ESTADO = 'VERIFICADA'
        AND (
          C.CODIGO_BANCO IS NULL
          OR UPPER(TRIM(B.CODIGO_BANCO)) = UPPER(TRIM(C.CODIGO_BANCO))
          OR UPPER(TRIM(B.NOMBRE)) LIKE '%' || UPPER(TRIM(C.BANCO_NOMBRE)) || '%'
        )
      ORDER BY M.CTA_PROVEEDOR_ID DESC`,
    { paymentId },
    object,
  );

  const rows = result.rows ?? [];
  if (rows.length === 0) {
    throw new CxpError(
      'La cuenta destino del proveedor debe estar VERIFICADA en Bancos y coincidir con la cuenta seleccionada en CxP',
      409,
    );
  }
  if (rows.length > 1) {
    throw new CxpError('Bancos tiene más de una cuenta verificada compatible para el proveedor', 409);
  }
  return rows[0];
}

async function createOperation(
  connection: Connection,
  p: ProcesoPago,
  actor: ActorProceso,
  account: OriginBankAccount,
  state: string,
): Promise<number> {
  const typeId = await operationType(connection);
  const seq = await connection.execute<{ ID: number }>(
    `SELECT SEQ_MB_OPERACION_BANCARIA.NEXTVAL ID FROM DUAL`,
    {},
    object,
  );
  const id = Number(seq.rows?.[0]?.ID);
  if (!id) throw new CxpError('No se pudo generar la operación bancaria', 500);

  await connection.execute(
    `INSERT INTO MB_OPERACION_BANCARIA (
       OPERACION_ID, EMPRESA_ID, SUCURSAL_ID, CUENTA_PRINCIPAL_ID,
       TIPO_OPERACION_ID, OPERACION_RELACIONADA_ID, MODULO_ORIGEN,
       DOCUMENTO_ORIGEN_ID, ESTADO, CREADO_POR, CREADO_EN
     ) VALUES (
       :id, :company, :branch, :account,
       :typeId, NULL, 'CXP',
       :paymentId, :state, :actorId, SYSTIMESTAMP
     )`,
    {
      id,
      company: account.EMPRESA_ID,
      branch: p.sucursal,
      account: account.CUENTA_ID,
      typeId,
      paymentId: p.id,
      state,
      actorId: actor.id,
    },
  );

  return id;
}

async function issueCheque(
  connection: Connection,
  p: ProcesoPago,
  actor: ActorProceso,
): Promise<ChequeProceso> {
  const existing = await connection.execute<{
    CHEQUE_ID: number;
    NUMERO_CHEQUE: number;
    CUENTA_ID: number;
    MONTO: number;
    ESTADO: string;
  }>(
    `SELECT C.CHEQUE_ID, C.NUMERO_CHEQUE, Q.CUENTA_ID, C.MONTO, C.ESTADO
       FROM MB_CHEQUE C
       JOIN MB_CHEQUERA Q ON Q.CHEQUERA_ID = C.CHEQUERA_ID
      WHERE C.PAGO_ID = :paymentId
        AND C.ESTADO <> 'ANULADO'
      ORDER BY C.CHEQUE_ID DESC
      FETCH FIRST 1 ROW ONLY`,
    { paymentId: p.id },
    object,
  );
  const current = existing.rows?.[0];
  if (current) {
    return {
      id: String(current.CHEQUE_ID),
      numero: String(current.NUMERO_CHEQUE),
      cuenta: String(current.CUENTA_ID),
      moneda: p.moneda,
      proveedor: p.proveedor,
      importe: Number(current.MONTO),
      estado: chequeState(current.ESTADO),
    };
  }

  const account = await originBankAccount(connection, p.id);
  if (account.PERMITE_CHEQUES !== 'S') {
    throw new CxpError('La cuenta bancaria de Bancos no permite cheques', 409);
  }

  const candidate = await connection.execute<{
    CHEQUERA_ID: number;
  }>(
    `SELECT CHEQUERA_ID
       FROM MB_CHEQUERA
      WHERE CUENTA_ID = :account
        AND ESTADO = 'ACTIVA'
      ORDER BY CHEQUERA_ID
      FETCH FIRST 1 ROW ONLY`,
    { account: account.CUENTA_ID },
    object,
  );
  const chequeraId = candidate.rows?.[0]?.CHEQUERA_ID;
  if (!chequeraId) {
    throw new CxpError('La cuenta bancaria no tiene una chequera ACTIVA en Bancos', 409);
  }

  const locked = await connection.execute<{
    CHEQUERA_ID: number;
    NUMERO_INICIAL: number;
    NUMERO_FINAL: number;
  }>(
    `SELECT CHEQUERA_ID, NUMERO_INICIAL, NUMERO_FINAL
       FROM MB_CHEQUERA
      WHERE CHEQUERA_ID = :id
        AND ESTADO = 'ACTIVA'
      FOR UPDATE`,
    { id: chequeraId },
    object,
  );
  const chequera = locked.rows?.[0];
  if (!chequera) throw new CxpError('La chequera cambió de estado. Actualiza e intenta nuevamente', 409);

  const used = await connection.execute<{ ULTIMO: number | null }>(
    `SELECT MAX(NUMERO_CHEQUE) ULTIMO
       FROM MB_CHEQUE
      WHERE CHEQUERA_ID = :id`,
    { id: chequeraId },
    object,
  );
  const last = used.rows?.[0]?.ULTIMO;
  const next = last == null
    ? Number(chequera.NUMERO_INICIAL)
    : Number(last) + 1;

  if (next > Number(chequera.NUMERO_FINAL)) {
    await connection.execute(
      `UPDATE MB_CHEQUERA SET ESTADO = 'AGOTADA' WHERE CHEQUERA_ID = :id`,
      { id: chequeraId },
    );
    throw new CxpError('La chequera activa ya no tiene números disponibles', 409);
  }

  const operationId = await createOperation(connection, p, actor, account, 'EMITIDA');
  const chequeSeq = await connection.execute<{ ID: number }>(
    `SELECT SEQ_MB_CHEQUE.NEXTVAL ID FROM DUAL`,
    {},
    object,
  );
  const chequeId = Number(chequeSeq.rows?.[0]?.ID);
  if (!chequeId) throw new CxpError('No se pudo generar el identificador del cheque', 500);

  await connection.execute(
    `INSERT INTO MB_CHEQUE (
       CHEQUE_ID, OPERACION_ID, PAGO_ID, CHEQUERA_ID, MOVIMIENTO_ID,
       NUMERO_CHEQUE, BENEFICIARIO, MONTO, FECHA_EMISION,
       LUGAR_EMISION, CONCEPTO, ESTADO
     ) VALUES (
       :chequeId, :operationId, :paymentId, :chequeraId, NULL,
       :numberValue, :beneficiary, :amount, SYSDATE,
       'Guatemala', :concept, 'EMITIDO'
     )`,
    {
      chequeId,
      operationId,
      paymentId: p.id,
      chequeraId,
      numberValue: next,
      beneficiary: (p.proveedorNombre ?? `Proveedor #${p.proveedor}`).slice(0, 150),
      amount: p.total,
      concept: `Pago CxP ${p.codigo}`.slice(0, 250),
    },
  );

  if (next === Number(chequera.NUMERO_FINAL)) {
    await connection.execute(
      `UPDATE MB_CHEQUERA SET ESTADO = 'AGOTADA' WHERE CHEQUERA_ID = :id`,
      { id: chequeraId },
    );
  }

  return {
    id: String(chequeId),
    numero: String(next),
    cuenta: String(account.CUENTA_ID),
    moneda: p.moneda,
    proveedor: p.proveedor,
    importe: p.total,
    estado: 'EMITIDO',
  };
}

async function issueTransfer(
  connection: Connection,
  p: ProcesoPago,
  actor: ActorProceso,
): Promise<TransferenciaProceso> {
  const existing = await connection.execute<{
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
      WHERE PAGO_ID = :paymentId
        AND ESTADO NOT IN ('ANULADA', 'RECHAZADA')
      ORDER BY TRANSFERENCIA_ID DESC
      FETCH FIRST 1 ROW ONLY`,
    { paymentId: p.id },
    object,
  );
  const current = existing.rows?.[0];
  if (current) {
    return {
      id: String(current.TRANSFERENCIA_ID),
      cuentaOrigen: String(current.CUENTA_ORIGEN_ID),
      cuentaDestino: String(current.CTA_PROVEEDOR_ID ?? ''),
      moneda: p.moneda,
      proveedor: p.proveedor,
      importe: Number(current.MONTO_ORIGEN),
      estado: transferState(current.ESTADO),
      referencia: current.REFERENCIA_BANCARIA ?? undefined,
    };
  }

  const account = await originBankAccount(connection, p.id);
  if (account.PERMITE_TRANSFERENCIAS !== 'S') {
    throw new CxpError('La cuenta bancaria de Bancos no permite transferencias', 409);
  }
  const destination = await providerBankAccount(connection, p.id);
  const operationId = await createOperation(connection, p, actor, account, 'PROGRAMADA');

  const seq = await connection.execute<{ ID: number }>(
    `SELECT SEQ_MB_TRANSFERENCIA_BANCARIA.NEXTVAL ID FROM DUAL`,
    {},
    object,
  );
  const transferId = Number(seq.rows?.[0]?.ID);
  if (!transferId) throw new CxpError('No se pudo generar el identificador de la transferencia', 500);

  await connection.execute(
    `INSERT INTO MB_TRANSFERENCIA_BANCARIA (
       TRANSFERENCIA_ID, OPERACION_ID, PAGO_ID,
       CUENTA_ORIGEN_ID, CUENTA_DESTINO_ID, CTA_PROVEEDOR_ID,
       FECHA_PROGRAMADA, FECHA_EFECTIVA,
       MONTO_ORIGEN, TIPO_CAMBIO, MONTO_DESTINO,
       REFERENCIA_BANCARIA, CONCEPTO, ESTADO
     ) VALUES (
       :transferId, :operationId, :paymentId,
       :originAccount, NULL, :providerAccount,
       TO_DATE(:scheduled, 'YYYY-MM-DD'), NULL,
       :amount, :exchangeRate, :amount,
       NULL, :concept, 'PROGRAMADA'
     )`,
    {
      transferId,
      operationId,
      paymentId: p.id,
      originAccount: account.CUENTA_ID,
      providerAccount: destination.CTA_PROVEEDOR_ID,
      scheduled: p.fechaProgramada,
      amount: p.total,
      exchangeRate: p.tipoCambio,
      concept: `Pago CxP ${p.codigo}`.slice(0, 250),
    },
  );

  return {
    id: String(transferId),
    cuentaOrigen: String(account.CUENTA_ID),
    cuentaDestino: String(destination.CTA_PROVEEDOR_ID),
    moneda: p.moneda,
    proveedor: p.proveedor,
    importe: p.total,
    estado: 'PROGRAMADA',
  };
}

export async function issuePaymentInstrument(
  connection: Connection,
  p: ProcesoPago,
  actor: ActorProceso,
): Promise<Pick<ProcesoPago, 'cheque' | 'transferencia'>> {
  const method = await paymentMethod(connection, p.formaPago);
  if (method.tipo === 'CHEQUE') {
    return { cheque: await issueCheque(connection, p, actor), transferencia: undefined };
  }
  return { cheque: undefined, transferencia: await issueTransfer(connection, p, actor) };
}

async function advanceCheque(
  connection: Connection,
  p: ProcesoPago,
  actor: ActorProceso,
  action: 'EJECUTAR' | 'CONFIRMAR' | 'ANULAR',
): Promise<ChequeProceso> {
  // 1) Localizar el cheque más reciente del pago SIN FOR UPDATE.
  // Oracle no permite FOR UPDATE sobre la consulta anterior porque combinaba
  // JOIN + ORDER BY + FETCH FIRST (row limiting), lo que produce ORA-02014.
  const idResult = await connection.execute<{ CHEQUE_ID: number }>(
    `SELECT MAX(CHEQUE_ID) AS CHEQUE_ID
       FROM MB_CHEQUE
      WHERE PAGO_ID = :paymentId`,
    { paymentId: p.id },
    object,
  );

  const chequeId = idResult.rows?.[0]?.CHEQUE_ID;
  if (!chequeId) {
    throw new CxpError('El pago no tiene un cheque emitido en Bancos', 409);
  }

  // 2) Bloquear directamente la fila física de MB_CHEQUE.
  // Este SELECT sí es actualizable y evita que dos solicitudes cambien
  // simultáneamente el estado del mismo cheque.
  const result = await connection.execute<{
    CHEQUE_ID: number;
    OPERACION_ID: number;
    CHEQUERA_ID: number;
    NUMERO_CHEQUE: number;
    MONTO: number;
    ESTADO: string;
  }>(
    `SELECT CHEQUE_ID, OPERACION_ID, CHEQUERA_ID, NUMERO_CHEQUE, MONTO, ESTADO
       FROM MB_CHEQUE
      WHERE CHEQUE_ID = :chequeId
      FOR UPDATE`,
    { chequeId },
    object,
  );

  const row = result.rows?.[0];
  if (!row) {
    throw new CxpError('El cheque ya no está disponible para actualizarse', 409);
  }

  // 3) La cuenta pertenece a la chequera; no necesitamos bloquearla para
  // una transición de estado del cheque.
  const accountResult = await connection.execute<{ CUENTA_ID: number }>(
    `SELECT CUENTA_ID
       FROM MB_CHEQUERA
      WHERE CHEQUERA_ID = :chequeraId`,
    { chequeraId: row.CHEQUERA_ID },
    object,
  );
  const account = accountResult.rows?.[0];
  if (!account) {
    throw new CxpError('No se encontró la chequera asociada al cheque', 409);
  }

  let nextState = row.ESTADO;
  let operationState = row.ESTADO;

  if (action === 'EJECUTAR') {
    if (!['EMITIDO', 'IMPRESO'].includes(row.ESTADO)) {
      throw new CxpError('El cheque debe estar EMITIDO o IMPRESO antes de entregarlo', 409);
    }
    nextState = 'ENTREGADO';
    operationState = 'EJECUTADA';
  } else if (action === 'CONFIRMAR') {
    if (row.ESTADO !== 'ENTREGADO') {
      throw new CxpError('El cheque debe estar ENTREGADO antes de confirmar su cobro', 409);
    }
    nextState = 'COBRADO';
    operationState = 'CONFIRMADA';
  } else {
    if (row.ESTADO === 'COBRADO') {
      throw new CxpError('Un cheque COBRADO no se puede anular directamente', 409);
    }
    nextState = 'ANULADO';
    operationState = 'ANULADA';
  }

  await connection.execute(
    `UPDATE MB_CHEQUE SET ESTADO = :state WHERE CHEQUE_ID = :id`,
    { state: nextState, id: row.CHEQUE_ID },
  );
  await connection.execute(
    `UPDATE MB_OPERACION_BANCARIA
        SET ESTADO = :state, MODIFICADO_POR = :actorId, MODIFICADO_EN = SYSTIMESTAMP
      WHERE OPERACION_ID = :id`,
    { state: operationState, actorId: actor.id, id: row.OPERACION_ID },
  );

  return {
    id: String(row.CHEQUE_ID),
    numero: String(row.NUMERO_CHEQUE),
    cuenta: String(account.CUENTA_ID),
    moneda: p.moneda,
    proveedor: p.proveedor,
    importe: Number(row.MONTO),
    estado: chequeState(nextState),
  };
}

async function advanceTransfer(
  connection: Connection,
  p: ProcesoPago,
  actor: ActorProceso,
  action: 'EJECUTAR' | 'CONFIRMAR' | 'ANULAR',
): Promise<TransferenciaProceso> {
  const result = await connection.execute<{
    TRANSFERENCIA_ID: number;
    OPERACION_ID: number;
    CUENTA_ORIGEN_ID: number;
    CTA_PROVEEDOR_ID: number | null;
    MONTO_ORIGEN: number;
    ESTADO: string;
    REFERENCIA_BANCARIA: string | null;
  }>(
    `SELECT TRANSFERENCIA_ID, OPERACION_ID, CUENTA_ORIGEN_ID,
            CTA_PROVEEDOR_ID, MONTO_ORIGEN, ESTADO, REFERENCIA_BANCARIA
       FROM MB_TRANSFERENCIA_BANCARIA
      WHERE PAGO_ID = :paymentId
      ORDER BY TRANSFERENCIA_ID DESC
      FETCH FIRST 1 ROW ONLY
      FOR UPDATE`,
    { paymentId: p.id },
    object,
  );
  const row = result.rows?.[0];
  if (!row) throw new CxpError('El pago no tiene una transferencia generada en Bancos', 409);

  let nextState = row.ESTADO;
  let operationState = row.ESTADO;

  if (action === 'EJECUTAR') {
    if (row.ESTADO !== 'PROGRAMADA') {
      throw new CxpError('La transferencia debe estar PROGRAMADA antes de ejecutarla', 409);
    }
    nextState = 'EJECUTADA';
    operationState = 'EJECUTADA';
    await connection.execute(
      `UPDATE MB_TRANSFERENCIA_BANCARIA
          SET ESTADO = 'EJECUTADA', FECHA_EFECTIVA = SYSDATE
        WHERE TRANSFERENCIA_ID = :id`,
      { id: row.TRANSFERENCIA_ID },
    );
  } else if (action === 'CONFIRMAR') {
    if (row.ESTADO !== 'EJECUTADA') {
      throw new CxpError('La transferencia debe estar EJECUTADA antes de finalizar el pago', 409);
    }
    nextState = 'EJECUTADA';
    operationState = 'CONFIRMADA';
  } else {
    if (row.ESTADO === 'EJECUTADA') {
      throw new CxpError('Una transferencia EJECUTADA no se puede anular directamente', 409);
    }
    nextState = 'ANULADA';
    operationState = 'ANULADA';
    await connection.execute(
      `UPDATE MB_TRANSFERENCIA_BANCARIA SET ESTADO = 'ANULADA' WHERE TRANSFERENCIA_ID = :id`,
      { id: row.TRANSFERENCIA_ID },
    );
  }

  await connection.execute(
    `UPDATE MB_OPERACION_BANCARIA
        SET ESTADO = :state, MODIFICADO_POR = :actorId, MODIFICADO_EN = SYSTIMESTAMP
      WHERE OPERACION_ID = :id`,
    { state: operationState, actorId: actor.id, id: row.OPERACION_ID },
  );

  return {
    id: String(row.TRANSFERENCIA_ID),
    cuentaOrigen: String(row.CUENTA_ORIGEN_ID),
    cuentaDestino: String(row.CTA_PROVEEDOR_ID ?? ''),
    moneda: p.moneda,
    proveedor: p.proveedor,
    importe: Number(row.MONTO_ORIGEN),
    estado: transferState(nextState),
    referencia: row.REFERENCIA_BANCARIA ?? undefined,
  };
}

export async function advancePaymentInstrument(
  connection: Connection,
  p: ProcesoPago,
  actor: ActorProceso,
  action: 'EJECUTAR' | 'CONFIRMAR' | 'ANULAR',
): Promise<Pick<ProcesoPago, 'cheque' | 'transferencia'>> {
  const method = await paymentMethod(connection, p.formaPago);
  if (method.tipo === 'CHEQUE') {
    return { cheque: await advanceCheque(connection, p, actor, action), transferencia: undefined };
  }
  return { cheque: undefined, transferencia: await advanceTransfer(connection, p, actor, action) };
}

/** Compatibilidad: lista cheques RESERVADOS ya existentes, resolviendo la cuenta sin mappings manuales. */
export async function listPreparedCheques(
  connection: Connection,
  p: ProcesoPago,
): Promise<OpcionChequeProceso[]> {
  const account = await originBankAccount(connection, p.id);
  const result = await connection.execute<{
    CHEQUE_ID: number;
    NUMERO_CHEQUE: number;
    MONTO: number;
  }>(
    `SELECT C.CHEQUE_ID, C.NUMERO_CHEQUE, C.MONTO
       FROM MB_CHEQUE C
       JOIN MB_CHEQUERA Q ON Q.CHEQUERA_ID = C.CHEQUERA_ID
      WHERE Q.CUENTA_ID = :account
        AND C.MONTO = :amount
        AND C.ESTADO = 'RESERVADO'
        AND (C.PAGO_ID IS NULL OR C.PAGO_ID = :paymentId)
      ORDER BY C.NUMERO_CHEQUE
      FETCH FIRST 100 ROWS ONLY`,
    { account: account.CUENTA_ID, amount: p.total, paymentId: p.id },
    object,
  );

  return (result.rows ?? []).map(row => ({
    id: String(row.CHEQUE_ID),
    numero: String(row.NUMERO_CHEQUE),
    importe: Number(row.MONTO),
    moneda: p.moneda,
  }));
}
