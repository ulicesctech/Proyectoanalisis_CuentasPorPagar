import oracledb, { type Connection } from 'oracledb';

export type DocumentoCreditCondition = {
  idCondicionCredito: number;
  diasCredito: number;
};

export async function findActiveDocumentoCreditCondition(
  connection: Connection,
  idCondicionCredito: number,
): Promise<DocumentoCreditCondition | null> {
  const result = await connection.execute<{ ID_CONDICION: number; DIAS_CREDITO: number }>(
    `SELECT ID_CONDICION, DIAS_CREDITO
       FROM CXC_CONDICIONES_CREDITO
      WHERE ID_CONDICION = :idCondicionCredito
        AND ESTADO = 'A'`,
    { idCondicionCredito },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const row = result.rows?.[0];
  return row ? {
    idCondicionCredito: Number(row.ID_CONDICION),
    diasCredito: Number(row.DIAS_CREDITO),
  } : null;
}
