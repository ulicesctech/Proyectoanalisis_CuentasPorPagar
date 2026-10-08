import oracledb, { type Connection } from 'oracledb';
import { cxpNow, type CxpReglaTributaria } from '@erp/contracts';
import { getConnection } from '../../../../config/database';

const OPTIONS = { outFormat: oracledb.OUT_FORMAT_OBJECT };

const COLUMNS = `R.ID_REGLA_TRIBUTARIA, R.CODIGO_REGLA, R.VERSION_REGLA, R.ID_REGLA_ANTERIOR, R.TIPO_DOCUMENTO,
  R.TIPO_TRIBUTO, R.CODIGO_TRIBUTO, R.NOMBRE_TRIBUTO, R.PORCENTAJE, R.MONTO_FIJO, R.BASE_DESDE, R.BASE_HASTA,
  R.SOBRE_EXCEDENTE, R.MONEDA, TO_CHAR(R.VIGENTE_DESDE, 'YYYY-MM-DD') AS VIGENTE_DESDE,
  TO_CHAR(R.VIGENTE_HASTA, 'YYYY-MM-DD') AS VIGENTE_HASTA, R.ESTADO, R.MOTIVO_CAMBIO, R.CREADA_POR,
  TO_CHAR(R.FECHA_CREACION, 'YYYY-MM-DD"T"HH24:MI:SS') AS FECHA_CREACION, R.MODIFICADA_POR,
  TO_CHAR(R.FECHA_MODIFICACION, 'YYYY-MM-DD"T"HH24:MI:SS') AS FECHA_MODIFICACION`;

type Row = Record<string, string | number | null>;

function mapRow(row: Row): CxpReglaTributaria {
  return {
    idReglaTributaria: Number(row.ID_REGLA_TRIBUTARIA),
    codigoRegla: String(row.CODIGO_REGLA),
    versionRegla: Number(row.VERSION_REGLA),
    idReglaAnterior: row.ID_REGLA_ANTERIOR == null ? null : Number(row.ID_REGLA_ANTERIOR),
    tipoDocumento: String(row.TIPO_DOCUMENTO),
    tipoTributo: row.TIPO_TRIBUTO as CxpReglaTributaria['tipoTributo'],
    codigoTributo: String(row.CODIGO_TRIBUTO),
    nombreTributo: String(row.NOMBRE_TRIBUTO),
    porcentaje: Number(row.PORCENTAJE),
    montoFijo: Number(row.MONTO_FIJO),
    baseDesde: Number(row.BASE_DESDE),
    baseHasta: row.BASE_HASTA == null ? null : Number(row.BASE_HASTA),
    sobreExcedente: String(row.SOBRE_EXCEDENTE).trim() as 'S' | 'N',
    moneda: row.MONEDA as string | null,
    vigenteDesde: String(row.VIGENTE_DESDE),
    vigenteHasta: row.VIGENTE_HASTA as string | null,
    estado: row.ESTADO as CxpReglaTributaria['estado'],
    motivoCambio: row.MOTIVO_CAMBIO as string | null,
    creadaPor: Number(row.CREADA_POR),
    fechaCreacion: String(row.FECHA_CREACION),
    modificadaPor: row.MODIFICADA_POR == null ? null : Number(row.MODIFICADA_POR),
    fechaModificacion: row.FECHA_MODIFICACION as string | null,
    ...(row.DOCUMENTOS_APLICADOS != null ? { documentosAplicados: Number(row.DOCUMENTOS_APLICADOS) } : {}),
  };
}

export interface NuevaReglaTributaria {
  codigoRegla: string;
  versionRegla: number;
  idReglaAnterior: number | null;
  tipoDocumento: string;
  tipoTributo: string;
  codigoTributo: string;
  nombreTributo: string;
  porcentaje: number;
  montoFijo: number;
  baseDesde: number;
  baseHasta: number | null;
  sobreExcedente: string;
  moneda: string | null;
  vigenteDesde: string;
  vigenteHasta: string | null;
  motivoCambio: string | null;
  creadaPor: number;
}

export async function listReglasTributarias(filters: { codigoRegla?: string; estado?: string; search?: string }): Promise<CxpReglaTributaria[]> {
  const connection = await getConnection();
  try {
    const clauses: string[] = [];
    const binds: oracledb.BindParameters = {};
    if (filters.codigoRegla) { clauses.push('R.CODIGO_REGLA = :codigoRegla'); binds.codigoRegla = filters.codigoRegla; }
    if (filters.estado) { clauses.push('R.ESTADO = :estado'); binds.estado = filters.estado; }
    if (filters.search) {
      clauses.push('(UPPER(R.CODIGO_REGLA) LIKE UPPER(:search) OR UPPER(R.NOMBRE_TRIBUTO) LIKE UPPER(:search) OR UPPER(R.CODIGO_TRIBUTO) LIKE UPPER(:search))');
      binds.search = `%${filters.search.slice(0, 100)}%`;
    }
    const result = await connection.execute<Row>(
      `SELECT ${COLUMNS},
              (SELECT COUNT(DISTINCT T.ID_DOCUMENTO) FROM CXP_DOCUMENTO_TRIBUTO T
                WHERE T.ID_REGLA_TRIBUTARIA = R.ID_REGLA_TRIBUTARIA) AS DOCUMENTOS_APLICADOS
         FROM CXP_REGLA_TRIBUTARIA R ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
        ORDER BY R.CODIGO_REGLA, R.VERSION_REGLA DESC
        FETCH FIRST 500 ROWS ONLY`,
      binds, OPTIONS,
    );
    return (result.rows ?? []).map(mapRow);
  } finally {
    await connection.close();
  }
}

export function reglaTributariaTx(connection: Connection) {
  return {
    async findById(id: number, lock = false): Promise<CxpReglaTributaria | null> {
      const result = await connection.execute<Row>(
        `SELECT ${COLUMNS} FROM CXP_REGLA_TRIBUTARIA R WHERE R.ID_REGLA_TRIBUTARIA = :id${lock ? ' FOR UPDATE' : ''}`, { id }, OPTIONS);
      return result.rows?.[0] ? mapRow(result.rows[0]) : null;
    },

    /** Última versión de un código de regla, bloqueada para versionar sin carreras. */
    async lockUltimaVersion(codigoRegla: string): Promise<CxpReglaTributaria | null> {
      const result = await connection.execute<Row>(
        `SELECT ${COLUMNS} FROM CXP_REGLA_TRIBUTARIA R
          WHERE R.CODIGO_REGLA = :codigoRegla
            AND R.VERSION_REGLA = (SELECT MAX(VERSION_REGLA) FROM CXP_REGLA_TRIBUTARIA WHERE CODIGO_REGLA = :codigoRegla)
          FOR UPDATE`, { codigoRegla }, OPTIONS);
      return result.rows?.[0] ? mapRow(result.rows[0]) : null;
    },

    /**
     * Reglas de otros códigos para el mismo tributo cuyo periodo y tramo de base se
     * cruzan con el indicado: dos reglas así harían ambiguo el cálculo.
     */
    async findSolapadas(regla: { codigoRegla: string; tipoDocumento: string; tipoTributo: string; codigoTributo: string; moneda: string | null;
      baseDesde: number; baseHasta: number | null; vigenteDesde: string; vigenteHasta: string | null }): Promise<CxpReglaTributaria[]> {
      const result = await connection.execute<Row>(
        `SELECT ${COLUMNS} FROM CXP_REGLA_TRIBUTARIA R
          WHERE R.CODIGO_REGLA <> :codigoRegla AND R.TIPO_DOCUMENTO = :tipoDocumento
            AND R.TIPO_TRIBUTO = :tipoTributo AND R.CODIGO_TRIBUTO = :codigoTributo
            AND (R.MONEDA IS NULL OR :moneda IS NULL OR R.MONEDA = :moneda)
            AND R.VIGENTE_DESDE <= NVL(TO_DATE(:vigenteHasta, 'YYYY-MM-DD'), DATE '9999-12-31')
            AND NVL(R.VIGENTE_HASTA, DATE '9999-12-31') >= TO_DATE(:vigenteDesde, 'YYYY-MM-DD')
            AND R.BASE_DESDE <= NVL(:baseHasta, 9999999999999999.99)
            AND NVL(R.BASE_HASTA, 9999999999999999.99) >= :baseDesde`,
        {
          codigoRegla: regla.codigoRegla, tipoDocumento: regla.tipoDocumento, tipoTributo: regla.tipoTributo,
          codigoTributo: regla.codigoTributo, moneda: regla.moneda, vigenteDesde: regla.vigenteDesde,
          vigenteHasta: regla.vigenteHasta, baseDesde: regla.baseDesde, baseHasta: regla.baseHasta,
        }, OPTIONS);
      return (result.rows ?? []).map(mapRow);
    },

    /** Reglas cuya vigencia cubre la fecha de la operación (sin importar si luego fueron reemplazadas). */
    async findVigentes(params: { tipoDocumento: string; fecha: string; moneda: string }): Promise<CxpReglaTributaria[]> {
      const result = await connection.execute<Row>(
        `SELECT ${COLUMNS} FROM CXP_REGLA_TRIBUTARIA R
          WHERE R.TIPO_DOCUMENTO = :tipoDocumento
            AND R.VIGENTE_DESDE <= TO_DATE(:fecha, 'YYYY-MM-DD')
            AND (R.VIGENTE_HASTA IS NULL OR R.VIGENTE_HASTA >= TO_DATE(:fecha, 'YYYY-MM-DD'))
            AND (R.MONEDA IS NULL OR R.MONEDA = :moneda)
          ORDER BY R.TIPO_TRIBUTO, R.CODIGO_TRIBUTO, R.BASE_DESDE`,
        params, OPTIONS);
      return (result.rows ?? []).map(mapRow);
    },

    async insert(regla: NuevaReglaTributaria): Promise<number> {
      const result = await connection.execute<{ newId: number[] }>(
        `INSERT INTO CXP_REGLA_TRIBUTARIA (CODIGO_REGLA, VERSION_REGLA, ID_REGLA_ANTERIOR, TIPO_DOCUMENTO, TIPO_TRIBUTO,
            CODIGO_TRIBUTO, NOMBRE_TRIBUTO, PORCENTAJE, MONTO_FIJO, BASE_DESDE, BASE_HASTA, SOBRE_EXCEDENTE, MONEDA,
            VIGENTE_DESDE, VIGENTE_HASTA, ESTADO, MOTIVO_CAMBIO, CREADA_POR, FECHA_CREACION)
         VALUES (:codigoRegla, :versionRegla, :idReglaAnterior, :tipoDocumento, :tipoTributo, :codigoTributo,
            :nombreTributo, :porcentaje, :montoFijo, :baseDesde, :baseHasta, :sobreExcedente, :moneda,
            TO_DATE(:vigenteDesde, 'YYYY-MM-DD'), TO_DATE(:vigenteHasta, 'YYYY-MM-DD'), 'VIGENTE', :motivoCambio, :creadaPor,
            TO_TIMESTAMP(:ahora, 'YYYY-MM-DD"T"HH24:MI:SS'))
         RETURNING ID_REGLA_TRIBUTARIA INTO :newId`,
        { ...regla, ahora: cxpNow(), newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
      );
      return result.outBinds!.newId[0];
    },

    /** Cierra la vigencia de una versión. Nunca modifica porcentajes ni montos. */
    async cerrar(id: number, params: { vigenteHasta: string; estado: 'REEMPLAZADA' | 'FINALIZADA'; usuario: number; motivo?: string }): Promise<void> {
      await connection.execute(
        `UPDATE CXP_REGLA_TRIBUTARIA
            SET VIGENTE_HASTA = TO_DATE(:vigenteHasta, 'YYYY-MM-DD'), ESTADO = :estado,
                MODIFICADA_POR = :usuario, FECHA_MODIFICACION = TO_TIMESTAMP(:ahora, 'YYYY-MM-DD"T"HH24:MI:SS'),
                MOTIVO_CAMBIO = CASE WHEN :motivo IS NULL THEN MOTIVO_CAMBIO
                                     ELSE SUBSTR(NVL2(MOTIVO_CAMBIO, MOTIVO_CAMBIO || ' | ', '') || :motivo, 1, 500) END
          WHERE ID_REGLA_TRIBUTARIA = :id`,
        { id, vigenteHasta: params.vigenteHasta, estado: params.estado, usuario: params.usuario, motivo: params.motivo ?? null, ahora: cxpNow() },
      );
    },

    /** Última fecha de operación de una factura especial ya calculada con esta versión. */
    async ultimaFechaAplicada(id: number): Promise<string | null> {
      const result = await connection.execute<{ FECHA: string | null }>(
        `SELECT TO_CHAR(MAX(D.FECHA_DOCUMENTO), 'YYYY-MM-DD') AS FECHA
           FROM CXP_DOCUMENTO_TRIBUTO T JOIN CXP_DOCUMENTO D ON D.ID_DOCUMENTO = T.ID_DOCUMENTO
          WHERE T.ID_REGLA_TRIBUTARIA = :id AND D.ESTADO <> 'ANULADA'`, { id }, OPTIONS);
      return result.rows?.[0]?.FECHA ?? null;
    },
  };
}
