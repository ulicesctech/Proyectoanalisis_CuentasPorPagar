import oracledb from 'oracledb';
import { getConnection } from '../../../../config/database';

export interface AntiguedadFilters {
  fechaCorte: string;
  idProveedor?: number;
  moneda?: string;
  estado?: string;
  centroCosto?: string;
  clasificacion?: string;
  rangoAntiguedad?: string;
}

export interface AntiguedadRow {
  idDocumento: number;
  idProveedor: number;
  numeroDocumento: string | null;
  tipoDocumento: string | null;
  fechaDocumento: string | null;
  fechaVencimiento: string | null;
  moneda: string | null;
  totalNeto: number;
  saldoHistorico: number;
  diasAntiguedad: number;
  rangoAntiguedad: string;
  centroCosto: string | null;
}

export interface AntiguedadResult {
  fechaCorte: string;
  detalle: AntiguedadRow[];
  totales: {
    cantidadDocumentos: number;
    saldoTotal: number;
  };
}

export async function consultarAntiguedad(
  filters: AntiguedadFilters,
): Promise<AntiguedadResult> {
  const connection = await getConnection();

  try {
    const binds: Record<string, string | number> = {
      fechaCorte: filters.fechaCorte,
    };

  const conditions: string[] = [
  `d.FECHA_DOCUMENTO <= TO_DATE(:fechaCorte, 'YYYY-MM-DD')`,
  `NVL(d.SALDO_PENDIENTE, 0) > 0`,
  `NVL(d.ESTADO, 'SIN_ESTADO') <> 'ANULADA'`,
];

    if (filters.idProveedor !== undefined) {
      conditions.push(`d.ID_PROVEEDOR = :idProveedor`);
      binds.idProveedor = filters.idProveedor;
    }

    if (filters.moneda) {
      conditions.push(`d.MONEDA = :moneda`);
      binds.moneda = filters.moneda;
    }

    if (filters.estado) {
      conditions.push(`d.ESTADO = :estado`);
      binds.estado = filters.estado;
    }

    if (filters.centroCosto) {
      conditions.push(`d.CENTRO_COSTO = :centroCosto`);
      binds.centroCosto = filters.centroCosto;
    }

    if (filters.clasificacion) {
  conditions.push(`d.TIPO_DOCUMENTO = :clasificacion`);
  binds.clasificacion = filters.clasificacion;
}

if (filters.rangoAntiguedad) {
  switch (filters.rangoAntiguedad) {
    case 'NO VENCIDO':
      conditions.push(`
        (
          d.FECHA_VENCIMIENTO IS NULL
          OR TRUNC(TO_DATE(:fechaCorte, 'YYYY-MM-DD'))
             <= TRUNC(d.FECHA_VENCIMIENTO)
        )
      `);
      break;

    case 'SIN VENCIMIENTO':
      conditions.push(`d.FECHA_VENCIMIENTO IS NULL`);
      break;

    case '1-30':
      conditions.push(`
        d.FECHA_VENCIMIENTO IS NOT NULL
        AND TRUNC(TO_DATE(:fechaCorte, 'YYYY-MM-DD'))
            - TRUNC(d.FECHA_VENCIMIENTO) BETWEEN 1 AND 30
      `);
      break;

    case '31-60':
      conditions.push(`
        d.FECHA_VENCIMIENTO IS NOT NULL
        AND TRUNC(TO_DATE(:fechaCorte, 'YYYY-MM-DD'))
            - TRUNC(d.FECHA_VENCIMIENTO) BETWEEN 31 AND 60
      `);
      break;

    case '61-90':
      conditions.push(`
        d.FECHA_VENCIMIENTO IS NOT NULL
        AND TRUNC(TO_DATE(:fechaCorte, 'YYYY-MM-DD'))
            - TRUNC(d.FECHA_VENCIMIENTO) BETWEEN 61 AND 90
      `);
      break;

    case '91-120':
      conditions.push(`
        d.FECHA_VENCIMIENTO IS NOT NULL
        AND TRUNC(TO_DATE(:fechaCorte, 'YYYY-MM-DD'))
            - TRUNC(d.FECHA_VENCIMIENTO) BETWEEN 91 AND 120
      `);
      break;

    case 'MAS DE 120':
      conditions.push(`
        d.FECHA_VENCIMIENTO IS NOT NULL
        AND TRUNC(TO_DATE(:fechaCorte, 'YYYY-MM-DD'))
            - TRUNC(d.FECHA_VENCIMIENTO) > 120
      `);
      break;

    default:
      throw new Error(
        'Rango de antigüedad no válido.',
      );
  }
}


    const sql = `
      SELECT
        d.ID_DOCUMENTO,
        d.ID_PROVEEDOR,
        d.NUMERO_DOCUMENTO,
        d.TIPO_DOCUMENTO,
        d.FECHA_DOCUMENTO,
        d.FECHA_VENCIMIENTO,
        d.MONEDA,
        NVL(d.TOTAL_NETO, 0) AS TOTAL_NETO,

        GREATEST(
          NVL(d.TOTAL_NETO, 0)
          -
          NVL((
            SELECT SUM(NVL(a.MONTO_TOTAL_APLICADO, 0))
            FROM CXP_APLICACION a
            WHERE a.ID_DOCUMENTO_DESTINO = d.ID_DOCUMENTO
              AND a.FECHA_APLICACION <=
                  TO_TIMESTAMP(:fechaCorte || ' 23:59:59',
                               'YYYY-MM-DD HH24:MI:SS')
              AND NVL(a.ESTADO, 'APLICADA')
                  NOT IN ('REVERSADA', 'ANULADA', 'CANCELADA')
          ), 0),
          0
        ) AS SALDO_HISTORICO,

        CASE
          WHEN d.FECHA_VENCIMIENTO IS NULL THEN 0
          WHEN TRUNC(TO_DATE(:fechaCorte, 'YYYY-MM-DD'))
               > TRUNC(d.FECHA_VENCIMIENTO)
          THEN
            TRUNC(TO_DATE(:fechaCorte, 'YYYY-MM-DD'))
            - TRUNC(d.FECHA_VENCIMIENTO)
          ELSE 0
        END AS DIAS_ANTIGUEDAD,

        CASE
          WHEN d.FECHA_VENCIMIENTO IS NULL THEN 'SIN VENCIMIENTO'

          WHEN TRUNC(TO_DATE(:fechaCorte, 'YYYY-MM-DD'))
               <= TRUNC(d.FECHA_VENCIMIENTO)
            THEN 'NO VENCIDO'

          WHEN TRUNC(TO_DATE(:fechaCorte, 'YYYY-MM-DD'))
               - TRUNC(d.FECHA_VENCIMIENTO) BETWEEN 1 AND 30
            THEN '1-30'

          WHEN TRUNC(TO_DATE(:fechaCorte, 'YYYY-MM-DD'))
               - TRUNC(d.FECHA_VENCIMIENTO) BETWEEN 31 AND 60
            THEN '31-60'

          WHEN TRUNC(TO_DATE(:fechaCorte, 'YYYY-MM-DD'))
               - TRUNC(d.FECHA_VENCIMIENTO) BETWEEN 61 AND 90
            THEN '61-90'

          WHEN TRUNC(TO_DATE(:fechaCorte, 'YYYY-MM-DD'))
               - TRUNC(d.FECHA_VENCIMIENTO) BETWEEN 91 AND 120
            THEN '91-120'

          ELSE 'MAS DE 120'
        END AS RANGO_ANTIGUEDAD,

        d.CENTRO_COSTO

      FROM CXP_DOCUMENTO d

      WHERE ${conditions.join(' AND ')}

      ORDER BY
        CASE
          WHEN d.FECHA_VENCIMIENTO IS NULL THEN 999999
          ELSE
            TRUNC(TO_DATE(:fechaCorte, 'YYYY-MM-DD'))
            - TRUNC(d.FECHA_VENCIMIENTO)
        END DESC,
        d.ID_DOCUMENTO
    `;

   interface AntiguedadDbRow {
  ID_DOCUMENTO: number;
  ID_PROVEEDOR: number;
  NUMERO_DOCUMENTO: string | null;
  TIPO_DOCUMENTO: string | null;
  FECHA_DOCUMENTO: Date | null;
  FECHA_VENCIMIENTO: Date | null;
  MONEDA: string | null;
  TOTAL_NETO: number;
  SALDO_HISTORICO: number;
  DIAS_ANTIGUEDAD: number;
  RANGO_ANTIGUEDAD: string;
  CENTRO_COSTO: string | null;
}

const result = await connection.execute<AntiguedadDbRow>(
  sql,
  binds,
  {
    outFormat: oracledb.OUT_FORMAT_OBJECT,
  },
);

const rows: AntiguedadDbRow[] = result.rows ?? [];

const detalle: AntiguedadRow[] = rows.map((row) => ({
  idDocumento: Number(row.ID_DOCUMENTO),
  idProveedor: Number(row.ID_PROVEEDOR),
  numeroDocumento: row.NUMERO_DOCUMENTO ?? null,
  tipoDocumento: row.TIPO_DOCUMENTO ?? null,
  fechaDocumento: row.FECHA_DOCUMENTO
    ? String(row.FECHA_DOCUMENTO)
    : null,
  fechaVencimiento: row.FECHA_VENCIMIENTO
    ? String(row.FECHA_VENCIMIENTO)
    : null,
  moneda: row.MONEDA ?? null,
  totalNeto: Number(row.TOTAL_NETO ?? 0),
  saldoHistorico: Number(row.SALDO_HISTORICO ?? 0),
  diasAntiguedad: Number(row.DIAS_ANTIGUEDAD ?? 0),
  rangoAntiguedad: String(row.RANGO_ANTIGUEDAD),
  centroCosto: row.CENTRO_COSTO ?? null,
}));

    
    const detalleConSaldo = detalle.filter(
      (row) => row.saldoHistorico > 0,
    );

const saldoTotal = detalleConSaldo.reduce(
  (total: number, row: AntiguedadRow) =>
    total + row.saldoHistorico,
  0,
);

    return {
      fechaCorte: filters.fechaCorte,
      detalle: detalleConSaldo,
      totales: {
        cantidadDocumentos: detalleConSaldo.length,
        saldoTotal,
      },
    };
  } finally {
    await connection.close();
  }
}   