import oracledb from 'oracledb';
import { getConnection } from '../../../../config/database';

export interface LibroComprasFilters {
  fechaInicio: string;
  fechaFin: string;
  idProveedor?: number;
  idSucursal?: number;
  tipoDocumento?: string;
  moneda?: string;
  estado?: string;
}

export interface LibroCompraRow {
  idDocumento: number;
  idProveedor: number;
  tipoDocumento: string | null;
  serie: string | null;
  numeroDocumento: string | null;
  uuidFiscal: string | null;
  nitEmisor: string | null;
  fechaDocumento: string | null;
  moneda: string | null;
  subtotal: number;
  impuestoTotal: number;
  retencionTotal: number;
  totalNeto: number;
  totalLocal: number;
  estado: string | null;
}

export interface LibroComprasTributoRow {
  idTributo: number;
  idDocumento: number;
  tipoTributo: string | null;
  codigoTributo: string | null;
  nombreTributo: string | null;
  baseImponible: number;
  porcentaje: number;
  monto: number;
  estado: string | null;
  periodoFiscal: string | null;
}

export interface LibroComprasPeriodo {
  idPeriodo: number | null;
  idSucursal: number | null;
  estado: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  version: number;
}

export interface LibroComprasResult {
  fechaInicio: string;
  fechaFin: string;

  periodo: LibroComprasPeriodo;

  detalle: LibroCompraRow[];
  tributos: LibroComprasTributoRow[];

  validacion: {
    estado: 'VALIDO' | 'CON_ADVERTENCIAS' | 'INVALIDO';
    errores: string[];
    advertencias: string[];
  };

  totales: {
    cantidadDocumentos: number;
    subtotal: number;
    impuestoTotal: number;
    retencionTotal: number;
    totalNeto: number;
    totalLocal: number;
  };
}

export async function consultarLibroCompras(
  filters: LibroComprasFilters,
): Promise<LibroComprasResult> {
  const connection = await getConnection();

  try {
    /*
     * ============================================================
     * 1. VALIDAR Y LOCALIZAR EL PERÍODO
     * ============================================================
     *
     * Buscamos un período que contenga completamente el rango
     * solicitado.
     */
    interface PeriodoDbRow {
      ID_PERIODO: number;
      ID_SUCURSAL: number;
      ESTADO: string;
      FECHA_INICIO: Date;
      FECHA_FIN: Date;
    }

    const periodoResult = await connection.execute<PeriodoDbRow>(
      `
        SELECT
          p.ID_PERIODO,
          p.ID_SUCURSAL,
          p.ESTADO,
          p.FECHA_INICIO,
          p.FECHA_FIN
        FROM CXP_PERIODO p
        WHERE p.FECHA_INICIO <= TO_DATE(:fechaInicio, 'YYYY-MM-DD')
          AND p.FECHA_FIN >= TO_DATE(:fechaFin, 'YYYY-MM-DD')
          ${filters.idSucursal !== undefined ? 'AND p.ID_SUCURSAL = :idSucursal' : ''}
        ORDER BY p.ID_PERIODO
        FETCH FIRST 1 ROW ONLY
      `,
      {
        fechaInicio: filters.fechaInicio,
        fechaFin: filters.fechaFin,
        ...(filters.idSucursal !== undefined
          ? { idSucursal: filters.idSucursal }
          : {}),
      },
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      },
    );

    const periodo = periodoResult.rows?.[0];

    /*
     * Si encontramos el período, contamos cuántos eventos de
     * generación del libro existen para obtener la siguiente versión.
     */
    let version = 1;

    if (periodo) {
      const versionResult = await connection.execute<{ CANTIDAD: number }>(
        `
          SELECT COUNT(*) AS CANTIDAD
          FROM CXP_EVENTO
          WHERE ID_PERIODO = :idPeriodo
            AND TIPO_EVENTO = 'LIBRO_COMPRAS_GENERADO'
        `,
        {
          idPeriodo: periodo.ID_PERIODO,
        },
        {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        },
      );

      version = Number(versionResult.rows?.[0]?.CANTIDAD ?? 0) + 1;
    }

    const informacionPeriodo: LibroComprasPeriodo = {
      idPeriodo: periodo ? Number(periodo.ID_PERIODO) : null,
      idSucursal: periodo ? Number(periodo.ID_SUCURSAL) : null,
      estado: periodo?.ESTADO ?? null,
      fechaInicio: periodo?.FECHA_INICIO
        ? String(periodo.FECHA_INICIO)
        : null,
      fechaFin: periodo?.FECHA_FIN
        ? String(periodo.FECHA_FIN)
        : null,
      version,
    };

    const conditions: string[] = [
      `d.FECHA_DOCUMENTO >= TO_DATE(:fechaInicio, 'YYYY-MM-DD')`,
      `d.FECHA_DOCUMENTO < TO_DATE(:fechaFin, 'YYYY-MM-DD') + 1`,
      `NVL(d.ESTADO, 'SIN_ESTADO') <> 'ANULADA'`,
    ];

    const binds: Record<string, string | number> = {
      fechaInicio: filters.fechaInicio,
      fechaFin: filters.fechaFin,
    };

    if (filters.idProveedor !== undefined) {
      conditions.push(`d.ID_PROVEEDOR = :idProveedor`);
      binds.idProveedor = filters.idProveedor;
    }

    if (filters.idSucursal !== undefined) {
      conditions.push(`d.ID_SUCURSAL = :idSucursal`);
      binds.idSucursal = filters.idSucursal;
    }

    if (filters.tipoDocumento) {
      conditions.push(`d.TIPO_DOCUMENTO = :tipoDocumento`);
      binds.tipoDocumento = filters.tipoDocumento;
    }

    if (filters.moneda) {
      conditions.push(`d.MONEDA = :moneda`);
      binds.moneda = filters.moneda;
    }

    if (filters.estado) {
      conditions.push(`d.ESTADO = :estado`);
      binds.estado = filters.estado;
    }

    const sql = `
      SELECT
        d.ID_DOCUMENTO,
        d.ID_PROVEEDOR,
        d.TIPO_DOCUMENTO,
        d.SERIE,
        d.NUMERO_DOCUMENTO,
        d.UUID_FISCAL,
        d.NIT_EMISOR,
        d.FECHA_DOCUMENTO,
        d.MONEDA,
        NVL(d.SUBTOTAL, 0) AS SUBTOTAL,
        NVL(d.IMPUESTO_TOTAL, 0) AS IMPUESTO_TOTAL,
        NVL(d.RETENCION_TOTAL, 0) AS RETENCION_TOTAL,
        NVL(d.TOTAL_NETO, 0) AS TOTAL_NETO,
        NVL(d.TOTAL_LOCAL, 0) AS TOTAL_LOCAL,
        d.ESTADO
      FROM CXP_DOCUMENTO d
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        d.FECHA_DOCUMENTO,
        d.ID_DOCUMENTO
    `;

    interface LibroComprasDbRow {
      ID_DOCUMENTO: number;
      ID_PROVEEDOR: number;
      TIPO_DOCUMENTO: string | null;
      SERIE: string | null;
      NUMERO_DOCUMENTO: string | null;
      UUID_FISCAL: string | null;
      NIT_EMISOR: string | null;
      FECHA_DOCUMENTO: Date | null;
      MONEDA: string | null;
      SUBTOTAL: number;
      IMPUESTO_TOTAL: number;
      RETENCION_TOTAL: number;
      TOTAL_NETO: number;
      TOTAL_LOCAL: number;
      ESTADO: string | null;
    }

    const result = await connection.execute<LibroComprasDbRow>(
      sql,
      binds,
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      },
    );

    const rows = result.rows ?? [];

    const detalle: LibroCompraRow[] = rows.map((row) => ({
      idDocumento: Number(row.ID_DOCUMENTO),
      idProveedor: Number(row.ID_PROVEEDOR),
      tipoDocumento: row.TIPO_DOCUMENTO ?? null,
      serie: row.SERIE ?? null,
      numeroDocumento: row.NUMERO_DOCUMENTO ?? null,
      uuidFiscal: row.UUID_FISCAL ?? null,
      nitEmisor: row.NIT_EMISOR ?? null,
      fechaDocumento: row.FECHA_DOCUMENTO
        ? String(row.FECHA_DOCUMENTO)
        : null,
      moneda: row.MONEDA ?? null,
      subtotal: Number(row.SUBTOTAL ?? 0),
      impuestoTotal: Number(row.IMPUESTO_TOTAL ?? 0),
      retencionTotal: Number(row.RETENCION_TOTAL ?? 0),
      totalNeto: Number(row.TOTAL_NETO ?? 0),
      totalLocal: Number(row.TOTAL_LOCAL ?? 0),
      estado: row.ESTADO ?? null,
    }));

    /*
     * ============================================================
     * 2. DETALLE TRIBUTARIO
     * ============================================================
     */

    const idsDocumentos = detalle.map(
      (documento) => documento.idDocumento,
    );

    let tributos: LibroComprasTributoRow[] = [];

    if (idsDocumentos.length > 0) {
      const tributosResult = await connection.execute(
        `
          SELECT
            t.ID_TRIBUTO,
            t.ID_DOCUMENTO,
            t.TIPO_TRIBUTO,
            t.CODIGO_TRIBUTO,
            t.NOMBRE_TRIBUTO,
            t.BASE_IMPONIBLE,
            t.PORCENTAJE,
            t.MONTO,
            t.ESTADO,
            t.PERIODO_FISCAL
          FROM CXP_DOCUMENTO_TRIBUTO t
          WHERE t.ID_DOCUMENTO IN (${idsDocumentos.join(',')})
          ORDER BY t.ID_DOCUMENTO, t.ID_TRIBUTO
        `,
        {},
        {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        },
      );

      interface LibroComprasTributoDbRow {
        ID_TRIBUTO: number;
        ID_DOCUMENTO: number;
        TIPO_TRIBUTO: string | null;
        CODIGO_TRIBUTO: string | null;
        NOMBRE_TRIBUTO: string | null;
        BASE_IMPONIBLE: number | null;
        PORCENTAJE: number | null;
        MONTO: number | null;
        ESTADO: string | null;
        PERIODO_FISCAL: string | null;
      }

      const tributosRows =
        (tributosResult.rows ?? []) as LibroComprasTributoDbRow[];

      tributos = tributosRows.map((row) => ({
        idTributo: Number(row.ID_TRIBUTO),
        idDocumento: Number(row.ID_DOCUMENTO),
        tipoTributo: row.TIPO_TRIBUTO ?? null,
        codigoTributo: row.CODIGO_TRIBUTO ?? null,
        nombreTributo: row.NOMBRE_TRIBUTO ?? null,
        baseImponible: Number(row.BASE_IMPONIBLE ?? 0),
        porcentaje: Number(row.PORCENTAJE ?? 0),
        monto: Number(row.MONTO ?? 0),
        estado: row.ESTADO ?? null,
        periodoFiscal: row.PERIODO_FISCAL ?? null,
      }));
    }

    /*
     * ============================================================
     * 3. VALIDACIONES
     * ============================================================
     */

    const errores: string[] = [];
    const advertencias: string[] = [];

    const idsUnicos = new Set(
      detalle.map((documento) => documento.idDocumento),
    );

    if (idsUnicos.size !== detalle.length) {
      errores.push(
        'Existen documentos duplicados en el libro de compras.',
      );
    }

    const documentosAnulados = detalle.filter(
      (documento) =>
        String(documento.estado).toUpperCase() === 'ANULADA',
    );

    if (documentosAnulados.length > 0) {
      errores.push(
        `Existen ${documentosAnulados.length} documento(s) anulados en el resultado.`,
      );
    }

    const documentosDelLibro = new Set(
      detalle.map((documento) => documento.idDocumento),
    );

    const tributosSinDocumento = tributos.filter(
      (tributo) =>
        !documentosDelLibro.has(tributo.idDocumento),
    );

    if (tributosSinDocumento.length > 0) {
      errores.push(
        `Existen ${tributosSinDocumento.length} tributo(s) sin documento relacionado.`,
      );
    }

    if (filters.fechaInicio > filters.fechaFin) {
      errores.push(
        'La fecha inicial del período no puede ser mayor que la fecha final.',
      );
    }

    if (!periodo) {
      advertencias.push(
        'No se encontró un período CXP que contenga completamente el rango seleccionado. El libro se genera sin asociar una versión de período.',
      );
    }

    if (detalle.length === 0) {
      advertencias.push(
        'No se encontraron documentos para el período y filtros seleccionados.',
      );
    }

    if (periodo?.ESTADO === 'CERRADO') {
      advertencias.push(
        `El período está cerrado. Esta generación corresponde a la versión ${version}.`,
      );
    }

    const estadoValidacion =
      errores.length > 0
        ? 'INVALIDO'
        : advertencias.length > 0
          ? 'CON_ADVERTENCIAS'
          : 'VALIDO';

    /*
     * ============================================================
     * 4. TOTALES
     * ============================================================
     */

    const totales = detalle.reduce(
      (acc, row) => ({
        cantidadDocumentos: acc.cantidadDocumentos + 1,
        subtotal: acc.subtotal + row.subtotal,
        impuestoTotal:
          acc.impuestoTotal + row.impuestoTotal,
        retencionTotal:
          acc.retencionTotal + row.retencionTotal,
        totalNeto: acc.totalNeto + row.totalNeto,
        totalLocal: acc.totalLocal + row.totalLocal,
      }),
      {
        cantidadDocumentos: 0,
        subtotal: 0,
        impuestoTotal: 0,
        retencionTotal: 0,
        totalNeto: 0,
        totalLocal: 0,
      },
    );

    return {
      fechaInicio: filters.fechaInicio,
      fechaFin: filters.fechaFin,
      periodo: informacionPeriodo,
      detalle,
      tributos,
      validacion: {
        estado: estadoValidacion,
        errores,
        advertencias,
      },
      totales,
    };
  } finally {
    await connection.close();
  }
}