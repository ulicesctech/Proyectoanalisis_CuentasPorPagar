import oracledb from 'oracledb';
import { getConnection } from '../../../../config/database';

export interface BitacoraFilters {
  fechaInicio: string;
  fechaFin: string;
  usuarioEvento?: number;
  tipoEvento?: string;
  estado?: string;
  prioridad?: string;
  identificador?: number;
}

export interface BitacoraRow {
  idEvento: number;
  tipoEvento: string | null;
  asunto: string | null;
  detalle: string | null;
  estadoAnterior: string | null;
  estadoNuevo: string | null;
  prioridad: string | null;
  estado: string | null;
  usuarioEvento: number;
  fechaEvento: string | null;
  fechaCierre: string | null;
  idDocumento: number | null;
  idPago: number | null;
  idLote: number | null;
  idCuentaBancaria: number | null;
  idCompromiso: number | null;
  idPeriodo: number | null;
  resultadoJson: string | null;
}

export interface BitacoraResult {
  fechaInicio: string;
  fechaFin: string;
  detalle: BitacoraRow[];
  totales: {
    cantidad: number;
  };
}

export async function consultarBitacora(
  filters: BitacoraFilters,
): Promise<BitacoraResult> {
  const connection = await getConnection();

  try {
    const binds: oracledb.BindParameters = {
      fechaInicio: filters.fechaInicio,
      fechaFin: filters.fechaFin,
    };

    const conditions: string[] = [
      `e.FECHA_EVENTO >= TO_DATE(:fechaInicio, 'YYYY-MM-DD')`,
      `e.FECHA_EVENTO < TO_DATE(:fechaFin, 'YYYY-MM-DD') + 1`,
    ];

    if (filters.usuarioEvento !== undefined) {
      conditions.push(`e.USUARIO_EVENTO = :usuarioEvento`);
      binds.usuarioEvento = filters.usuarioEvento;
    }

    if (filters.tipoEvento) {
      conditions.push(
        `UPPER(e.TIPO_EVENTO) = UPPER(:tipoEvento)`,
      );
      binds.tipoEvento = filters.tipoEvento;
    }

    if (filters.estado) {
      conditions.push(
        `UPPER(e.ESTADO) = UPPER(:estado)`,
      );
      binds.estado = filters.estado;
    }

    if (filters.prioridad) {
      conditions.push(
        `UPPER(e.PRIORIDAD) = UPPER(:prioridad)`,
      );
      binds.prioridad = filters.prioridad;
    }

    if (filters.identificador !== undefined) {
      conditions.push(`
        (
          e.ID_EVENTO = :identificador
          OR e.ID_DOCUMENTO = :identificador
          OR e.ID_PAGO = :identificador
          OR e.ID_LOTE = :identificador
          OR e.ID_CUENTA_BANCARIA = :identificador
          OR e.ID_COMPROMISO = :identificador
          OR e.ID_PERIODO = :identificador
        )
      `);

      binds.identificador = filters.identificador;
    }

    const sql = `
      SELECT
        e.ID_EVENTO,
        e.TIPO_EVENTO,
        e.ASUNTO,
        e.DETALLE,
        e.ESTADO_ANTERIOR,
        e.ESTADO_NUEVO,
        e.PRIORIDAD,
        e.ESTADO,
        e.USUARIO_EVENTO,

        TO_CHAR(
          e.FECHA_EVENTO,
          'YYYY-MM-DD HH24:MI:SS'
        ) AS FECHA_EVENTO,

        TO_CHAR(
          e.FECHA_CIERRE,
          'YYYY-MM-DD HH24:MI:SS'
        ) AS FECHA_CIERRE,

        e.ID_DOCUMENTO,
        e.ID_PAGO,
        e.ID_LOTE,
        e.ID_CUENTA_BANCARIA,
        e.ID_COMPROMISO,
        e.ID_PERIODO,
        e.RESULTADO_JSON

      FROM CXP_EVENTO e

      WHERE ${conditions.join(' AND ')}

      ORDER BY
        e.FECHA_EVENTO DESC,
        e.ID_EVENTO DESC
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
      idEvento: Number(row.ID_EVENTO),

      tipoEvento: row.TIPO_EVENTO
        ? String(row.TIPO_EVENTO)
        : null,

      asunto: row.ASUNTO
        ? String(row.ASUNTO)
        : null,

      detalle: row.DETALLE
        ? String(row.DETALLE)
        : null,

      estadoAnterior: row.ESTADO_ANTERIOR
        ? String(row.ESTADO_ANTERIOR)
        : null,

      estadoNuevo: row.ESTADO_NUEVO
        ? String(row.ESTADO_NUEVO)
        : null,

      prioridad: row.PRIORIDAD
        ? String(row.PRIORIDAD)
        : null,

      estado: row.ESTADO
        ? String(row.ESTADO)
        : null,

      usuarioEvento: Number(row.USUARIO_EVENTO),

      fechaEvento: row.FECHA_EVENTO
        ? String(row.FECHA_EVENTO)
        : null,

      fechaCierre: row.FECHA_CIERRE
        ? String(row.FECHA_CIERRE)
        : null,

      idDocumento:
        row.ID_DOCUMENTO === null ||
        row.ID_DOCUMENTO === undefined
          ? null
          : Number(row.ID_DOCUMENTO),

      idPago:
        row.ID_PAGO === null ||
        row.ID_PAGO === undefined
          ? null
          : Number(row.ID_PAGO),

      idLote:
        row.ID_LOTE === null ||
        row.ID_LOTE === undefined
          ? null
          : Number(row.ID_LOTE),

      idCuentaBancaria:
        row.ID_CUENTA_BANCARIA === null ||
        row.ID_CUENTA_BANCARIA === undefined
          ? null
          : Number(row.ID_CUENTA_BANCARIA),

      idCompromiso:
        row.ID_COMPROMISO === null ||
        row.ID_COMPROMISO === undefined
          ? null
          : Number(row.ID_COMPROMISO),

      idPeriodo:
        row.ID_PERIODO === null ||
        row.ID_PERIODO === undefined
          ? null
          : Number(row.ID_PERIODO),

      resultadoJson: row.RESULTADO_JSON
        ? String(row.RESULTADO_JSON)
        : null,
    }));

    const totales = {
      cantidad: detalle.length,
    };

    return {
      fechaInicio: filters.fechaInicio,
      fechaFin: filters.fechaFin,
      detalle,
      totales,
    };
  } finally {
    await connection.close();
  }
}