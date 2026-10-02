import oracledb from 'oracledb';
import { getConnection } from '../../../../config/database';

export interface RetencionesFilters {
  fechaInicio: string;
  fechaFin: string;
  tipoTributo?: string;
  codigoTributo?: string;
  idProveedor?: number;
  idDocumento?: number;
  numeroConstancia?: string;
  estado?: string;
  idSucursal?: number;
  moneda?: string;
}

export interface RetencionRow {
  idTributo: number;
  idDocumento: number;
  idProveedor: number | null;
  idSucursal: number | null;
  tipoDocumento: string | null;
  numeroDocumento: string | null;
  fechaDocumento: string | null;
  moneda: string | null;
  tipoTributo: string | null;
  codigoTributo: string | null;
  nombreTributo: string | null;
  baseImponible: number;
  porcentaje: number;
  monto: number;
  montoRecuperable: number;
  montoNoRecuperable: number;
  numeroConstancia: string | null;
  periodoFiscal: string | null;
  fechaAplicacion: string | null;
  estado: string | null;
}

export interface RetencionResumen {
  tipoTributo: string;
  codigoTributo: string;
  nombreTributo: string;
  cantidad: number;
  baseImponible: number;
  monto: number;
  montoRecuperable: number;
  montoNoRecuperable: number;
}

export interface RetencionesResult {
  fechaInicio: string;
  fechaFin: string;
  detalle: RetencionRow[];
  resumenPorTributo: RetencionResumen[];
  totales: {
    cantidad: number;
    baseImponible: number;
    monto: number;
    montoRecuperable: number;
    montoNoRecuperable: number;
  };
}

export async function consultarRetenciones(
  filters: RetencionesFilters,
): Promise<RetencionesResult> {
  const connection = await getConnection();

  try {
    const binds: oracledb.BindParameters = {
      fechaInicio: filters.fechaInicio,
      fechaFin: filters.fechaFin,
    };

    const conditions: string[] = [
      `t.FECHA_APLICACION >= TO_DATE(:fechaInicio, 'YYYY-MM-DD')`,
      `t.FECHA_APLICACION < TO_DATE(:fechaFin, 'YYYY-MM-DD') + 1`,
    ];

    if (filters.tipoTributo) {
      conditions.push(
        `UPPER(t.TIPO_TRIBUTO) = UPPER(:tipoTributo)`,
      );

      binds.tipoTributo = filters.tipoTributo;
    }

    if (filters.codigoTributo) {
      conditions.push(
        `UPPER(t.CODIGO_TRIBUTO) = UPPER(:codigoTributo)`,
      );

      binds.codigoTributo = filters.codigoTributo;
    }

    if (filters.idProveedor !== undefined) {
      conditions.push(
        `d.ID_PROVEEDOR = :idProveedor`,
      );

      binds.idProveedor = filters.idProveedor;
    }

    if (filters.idDocumento !== undefined) {
      conditions.push(
        `d.ID_DOCUMENTO = :idDocumento`,
      );

      binds.idDocumento = filters.idDocumento;
    }

    if (filters.numeroConstancia) {
      conditions.push(
        `UPPER(t.NUMERO_CONSTANCIA) = UPPER(:numeroConstancia)`,
      );

      binds.numeroConstancia = filters.numeroConstancia;
    }

    if (filters.estado) {
      conditions.push(
        `UPPER(t.ESTADO) = UPPER(:estado)`,
      );

      binds.estado = filters.estado;
    }

    if (filters.moneda) {
      conditions.push(
        `UPPER(d.MONEDA) = UPPER(:moneda)`,
      );

      binds.moneda = filters.moneda;
    }

    if (filters.idSucursal !== undefined) {
      conditions.push(
        `d.ID_SUCURSAL = :idSucursal`,
      );

      binds.idSucursal = filters.idSucursal;
    }

    const sql = `
      SELECT
        t.ID_TRIBUTO,
        t.ID_DOCUMENTO,
        d.ID_PROVEEDOR,
        d.ID_SUCURSAL,
        d.TIPO_DOCUMENTO,
        d.NUMERO_DOCUMENTO,

        TO_CHAR(
          d.FECHA_DOCUMENTO,
          'YYYY-MM-DD'
        ) AS FECHA_DOCUMENTO,

        d.MONEDA,
        t.TIPO_TRIBUTO,
        t.CODIGO_TRIBUTO,
        t.NOMBRE_TRIBUTO,

        NVL(t.BASE_IMPONIBLE, 0) AS BASE_IMPONIBLE,
        NVL(t.PORCENTAJE, 0) AS PORCENTAJE,
        NVL(t.MONTO, 0) AS MONTO,
        NVL(t.MONTO_RECUPERABLE, 0) AS MONTO_RECUPERABLE,
        NVL(t.MONTO_NO_RECUPERABLE, 0) AS MONTO_NO_RECUPERABLE,

        t.NUMERO_CONSTANCIA,
        t.PERIODO_FISCAL,

        TO_CHAR(
          t.FECHA_APLICACION,
          'YYYY-MM-DD'
        ) AS FECHA_APLICACION,

        t.ESTADO

      FROM CXP_DOCUMENTO_TRIBUTO t

      INNER JOIN CXP_DOCUMENTO d
        ON d.ID_DOCUMENTO = t.ID_DOCUMENTO

      WHERE ${conditions.join(' AND ')}

      ORDER BY
        t.FECHA_APLICACION,
        t.ID_TRIBUTO
    `;

    const result = await connection.execute(
      sql,
      binds,
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      },
    );

    const detalle = (
      (result.rows ?? []) as Record<string, unknown>[]
    ).map((row) => ({
      idTributo: Number(row.ID_TRIBUTO),

      idDocumento: Number(row.ID_DOCUMENTO),

      idProveedor:
        row.ID_PROVEEDOR === null ||
        row.ID_PROVEEDOR === undefined
          ? null
          : Number(row.ID_PROVEEDOR),

      idSucursal:
        row.ID_SUCURSAL === null ||
        row.ID_SUCURSAL === undefined
          ? null
          : Number(row.ID_SUCURSAL),

      tipoDocumento: row.TIPO_DOCUMENTO
        ? String(row.TIPO_DOCUMENTO)
        : null,

      numeroDocumento: row.NUMERO_DOCUMENTO
        ? String(row.NUMERO_DOCUMENTO)
        : null,

      fechaDocumento: row.FECHA_DOCUMENTO
        ? String(row.FECHA_DOCUMENTO)
        : null,

      moneda: row.MONEDA
        ? String(row.MONEDA)
        : null,

      tipoTributo: row.TIPO_TRIBUTO
        ? String(row.TIPO_TRIBUTO)
        : null,

      codigoTributo: row.CODIGO_TRIBUTO
        ? String(row.CODIGO_TRIBUTO)
        : null,

      nombreTributo: row.NOMBRE_TRIBUTO
        ? String(row.NOMBRE_TRIBUTO)
        : null,

      baseImponible: Number(
        row.BASE_IMPONIBLE ?? 0,
      ),

      porcentaje: Number(
        row.PORCENTAJE ?? 0,
      ),

      monto: Number(
        row.MONTO ?? 0,
      ),

      montoRecuperable: Number(
        row.MONTO_RECUPERABLE ?? 0,
      ),

      montoNoRecuperable: Number(
        row.MONTO_NO_RECUPERABLE ?? 0,
      ),

      numeroConstancia: row.NUMERO_CONSTANCIA
        ? String(row.NUMERO_CONSTANCIA)
        : null,

      periodoFiscal: row.PERIODO_FISCAL
        ? String(row.PERIODO_FISCAL)
        : null,

      fechaAplicacion: row.FECHA_APLICACION
        ? String(row.FECHA_APLICACION)
        : null,

      estado: row.ESTADO
        ? String(row.ESTADO)
        : null,
    }));

    /*
     * RESUMEN POR TRIBUTO
     *
     * Agrupa las retenciones utilizando:
     * - Tipo de tributo
     * - Código de tributo
     *
     * Esto permite generar un reporte resumido
     * además del detalle individual.
     */

    const resumenMap = new Map<
      string,
      RetencionResumen
    >();

    for (const row of detalle) {
      const tipoTributo =
        row.tipoTributo ?? 'SIN_TIPO';

      const codigoTributo =
        row.codigoTributo ?? 'SIN_CODIGO';

      const nombreTributo =
        row.nombreTributo ?? 'SIN_NOMBRE';

      const key =
        `${tipoTributo}|${codigoTributo}`;

      const actual = resumenMap.get(key);

      if (actual) {
        actual.cantidad += 1;

        actual.baseImponible +=
          row.baseImponible;

        actual.monto +=
          row.monto;

        actual.montoRecuperable +=
          row.montoRecuperable;

        actual.montoNoRecuperable +=
          row.montoNoRecuperable;
      } else {
        resumenMap.set(key, {
          tipoTributo,
          codigoTributo,
          nombreTributo,

          cantidad: 1,

          baseImponible:
            row.baseImponible,

          monto:
            row.monto,

          montoRecuperable:
            row.montoRecuperable,

          montoNoRecuperable:
            row.montoNoRecuperable,
        });
      }
    }

    const resumenPorTributo =
      Array.from(
        resumenMap.values(),
      );

    /*
     * TOTALES GENERALES
     */

    const totales = detalle.reduce(
      (acc, row) => ({
        cantidad:
          acc.cantidad + 1,

        baseImponible:
          acc.baseImponible +
          row.baseImponible,

        monto:
          acc.monto +
          row.monto,

        montoRecuperable:
          acc.montoRecuperable +
          row.montoRecuperable,

        montoNoRecuperable:
          acc.montoNoRecuperable +
          row.montoNoRecuperable,
      }),
      {
        cantidad: 0,
        baseImponible: 0,
        monto: 0,
        montoRecuperable: 0,
        montoNoRecuperable: 0,
      },
    );

    return {
      fechaInicio:
        filters.fechaInicio,

      fechaFin:
        filters.fechaFin,

      detalle,

      resumenPorTributo,

      totales,
    };
  } finally {
    await connection.close();
  }
}