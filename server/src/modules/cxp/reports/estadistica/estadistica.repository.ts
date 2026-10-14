import oracledb from 'oracledb';
import { getConnection } from '../../../../config/database';

export interface EstadisticaComprasFilters {
  fechaInicio: string;
  fechaFin: string;
  idProveedor?: number;
  clasificacion?: string;
  centroCosto?: string;
  moneda?: string;
  estado?: string;
  agrupacion?: 'PERIODO' | 'PROVEEDOR' | 'CLASIFICACION' | 'CENTRO_COSTO';
}

export interface EstadisticaCompraRow {
  periodo: string;
  idProveedor: number | null;
  centroCosto: string | null;
  tipoDocumento: string | null;
  moneda: string | null;
  cantidad: number;
  subtotal: number;
  impuestoTotal: number;
  retencionTotal: number;
  totalNeto: number;
  totalLocal: number;
  participacion: number;
  variacion: number | null;
  variacionTexto: string;
}

export interface EstadisticaComprasResult {
  fechaInicio: string;
  fechaFin: string;
  agrupacion: string;
  detalle: EstadisticaCompraRow[];
  totales: {
    cantidadDocumentos: number;
    subtotal: number;
    impuestoTotal: number;
    retencionTotal: number;
    totalNeto: number;
    totalLocal: number;
  };
  periodoComparable: {
    fechaInicio: string;
    fechaFin: string;
    totalLocal: number;
    disponible: boolean;
  };
  validacion: {
    estado: 'VALIDO' | 'CON_ADVERTENCIAS' | 'INVALIDO';
    errores: string[];
    advertencias: string[];
  };
}

export async function consultarEstadisticaCompras(
  filters: EstadisticaComprasFilters,
): Promise<EstadisticaComprasResult> {
  const connection = await getConnection();

  try {
    const errores: string[] = [];
    const advertencias: string[] = [];

    /*
     * ============================================================
     * 1. VALIDACIÓN BÁSICA
     * ============================================================
     */

    if (filters.fechaInicio > filters.fechaFin) {
      errores.push(
        'La fecha inicial no puede ser mayor que la fecha final.',
      );
    }

    /*
     * ============================================================
     * 2. DETERMINAR AGRUPACIÓN
     * ============================================================
     */

    const agrupacion = filters.agrupacion ?? 'PERIODO';

    /*
     * ============================================================
     * 3. CONSTRUIR FILTROS
     * ============================================================
     */

    const conditions: string[] = [
      `d.FECHA_DOCUMENTO >= TO_DATE(:fechaInicio, 'YYYY-MM-DD')`,
      `d.FECHA_DOCUMENTO < TO_DATE(:fechaFin, 'YYYY-MM-DD') + 1`,
      `d.ESTADO NOT IN ('BORRADOR', 'RECIBIDO', 'PENDIENTE_CLASIFICACION', 'PENDIENTE_REVISION', 'EN_VALIDACION', 'DUPLICADO', 'CON_DIFERENCIAS', 'PENDIENTE_APROBACION', 'RECHAZADA', 'BLOQUEADA', 'EN_DISPUTA', 'ANULADA')`,
      `d.TIPO_DOCUMENTO NOT IN ('GASTO_CAJA_CHICA', 'REEMBOLSO')`,
      `(d.TIPO_DOCUMENTO <> 'FACTURA_ESPECIAL' OR d.ESTADO <> 'APROBADA')`,
    ];

    const binds: Record<string, string | number> = {
      fechaInicio: filters.fechaInicio,
      fechaFin: filters.fechaFin,
    };

    if (filters.idProveedor !== undefined) {
      conditions.push(`d.ID_PROVEEDOR = :idProveedor`);
      binds.idProveedor = filters.idProveedor;
    }

    if (filters.centroCosto) {
      conditions.push(`d.CENTRO_COSTO = :centroCosto`);
      binds.centroCosto = filters.centroCosto;
    }

    if (filters.moneda) {
      conditions.push(`d.MONEDA = :moneda`);
      binds.moneda = filters.moneda;
    }

    if (filters.estado) {
      conditions.push(`d.ESTADO = :estado`);
      binds.estado = filters.estado;
    }

    /*
     * ============================================================
     * 4. CONSULTAR DOCUMENTOS
     * ============================================================
     *
     * Clasificación y centro de costo se dejan como NULL hasta
     * confirmar las columnas/tablas específicas de la BD.
     */

    const sql = `
      SELECT
        d.ID_DOCUMENTO,
        d.ID_PROVEEDOR,
        d.TIPO_DOCUMENTO,
        d.FECHA_DOCUMENTO,
        d.MONEDA,
        d.CENTRO_COSTO,
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

    interface DbRow {
      ID_DOCUMENTO: number;
      ID_PROVEEDOR: number | null;
      TIPO_DOCUMENTO: string | null;
      FECHA_DOCUMENTO: Date | null;
      MONEDA: string | null;
      CENTRO_COSTO: string | null;
      SUBTOTAL: number;
      IMPUESTO_TOTAL: number;
      RETENCION_TOTAL: number;
      TOTAL_NETO: number;
      TOTAL_LOCAL: number;
      ESTADO: string | null;
    }

    const result = await connection.execute<DbRow>(
      sql,
      binds,
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      },
    );

    const documentos = result.rows ?? [];

    /*
     * ============================================================
     * 5. CALCULAR TOTALES
     * ============================================================
     */

    const totales = documentos.reduce(
      (acc, row) => ({
        cantidadDocumentos: acc.cantidadDocumentos + 1,
        subtotal:
          acc.subtotal + Number(row.SUBTOTAL ?? 0),
        impuestoTotal:
          acc.impuestoTotal +
          Number(row.IMPUESTO_TOTAL ?? 0),
        retencionTotal:
          acc.retencionTotal +
          Number(row.RETENCION_TOTAL ?? 0),
        totalNeto:
          acc.totalNeto +
          Number(row.TOTAL_NETO ?? 0),
        totalLocal:
          acc.totalLocal +
          Number(row.TOTAL_LOCAL ?? 0),
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

    /*
     * ============================================================
     * 6. PERÍODO COMPARABLE
     * ============================================================
     *
     * Se calcula un período anterior con la misma duración.
     */

    const inicio = new Date(`${filters.fechaInicio}T00:00:00Z`);
    const fin = new Date(`${filters.fechaFin}T00:00:00Z`);

    const duracionDias =
      Math.floor(
        (fin.getTime() - inicio.getTime()) /
          (1000 * 60 * 60 * 24),
      ) + 1;

    const comparableFin = new Date(inicio);
    comparableFin.setUTCDate(
      comparableFin.getUTCDate() - 1,
    );

    const comparableInicio = new Date(
      comparableFin,
    );

    comparableInicio.setUTCDate(
      comparableInicio.getUTCDate() -
        duracionDias +
        1,
    );

    const formatoFecha = (fecha: Date): string =>
      fecha.toISOString().slice(0, 10);

    const fechaComparableInicio =
      formatoFecha(comparableInicio);

    const fechaComparableFin =
      formatoFecha(comparableFin);

    const comparableConditions: string[] = [
      `d.FECHA_DOCUMENTO >= TO_DATE(:fechaComparableInicio, 'YYYY-MM-DD')`,
      `d.FECHA_DOCUMENTO < TO_DATE(:fechaComparableFin, 'YYYY-MM-DD') + 1`,
      `d.ESTADO NOT IN ('BORRADOR', 'RECIBIDO', 'PENDIENTE_CLASIFICACION', 'PENDIENTE_REVISION', 'EN_VALIDACION', 'DUPLICADO', 'CON_DIFERENCIAS', 'PENDIENTE_APROBACION', 'RECHAZADA', 'BLOQUEADA', 'EN_DISPUTA', 'ANULADA')`,
      `d.TIPO_DOCUMENTO NOT IN ('GASTO_CAJA_CHICA', 'REEMBOLSO')`,
      `(d.TIPO_DOCUMENTO <> 'FACTURA_ESPECIAL' OR d.ESTADO <> 'APROBADA')`,
    ];

    const comparableBinds: Record<
      string,
      string | number
    > = {
      fechaComparableInicio,
      fechaComparableFin,
    };

    if (filters.idProveedor !== undefined) {
      comparableConditions.push(
        `d.ID_PROVEEDOR = :idProveedor`,
      );
      comparableBinds.idProveedor =
        filters.idProveedor;
    }

    if (filters.centroCosto) {
      comparableConditions.push(`d.CENTRO_COSTO = :centroCosto`);
      comparableBinds.centroCosto = filters.centroCosto;
    }

    if (filters.moneda) {
      comparableConditions.push(
        `d.MONEDA = :moneda`,
      );
      comparableBinds.moneda = filters.moneda;
    }

    if (filters.estado) {
      comparableConditions.push(
        `d.ESTADO = :estado`,
      );
      comparableBinds.estado = filters.estado;
    }

    const comparableResult =
      await connection.execute<{
        TOTAL_LOCAL: number;
      }>(
        `
        SELECT
          NVL(SUM(d.TOTAL_LOCAL), 0) AS TOTAL_LOCAL
        FROM CXP_DOCUMENTO d
        WHERE ${comparableConditions.join(' AND ')}
        `,
        comparableBinds,
        {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        },
      );

    const totalComparable = Number(
      comparableResult.rows?.[0]?.TOTAL_LOCAL ?? 0,
    );

    const disponibleComparable =
      documentos.length > 0 &&
      totalComparable > 0;

    /*
     * ============================================================
     * 7. AGRUPACIÓN
     * ============================================================
     */

    const grupos = new Map<
      string,
      EstadisticaCompraRow
    >();

    for (const documento of documentos) {
      let clave: string;

      if (agrupacion === 'PROVEEDOR') {
        clave =
          documento.ID_PROVEEDOR !== null
            ? `PROVEEDOR_${documento.ID_PROVEEDOR}`
            : 'PROVEEDOR_SIN_IDENTIFICAR';
      } else if (agrupacion === 'CLASIFICACION') {
        clave = 'SIN_CLASIFICACION';
      } else if (agrupacion === 'CENTRO_COSTO') {
  clave =
    documento.CENTRO_COSTO ??
    'SIN_CENTRO_COSTO';
}
 else {
        const fecha = documento.FECHA_DOCUMENTO
          ? new Date(documento.FECHA_DOCUMENTO)
          : null;

        clave = fecha
          ? `${fecha.getFullYear()}-${String(
              fecha.getMonth() + 1,
            ).padStart(2, '0')}`
          : 'SIN_PERIODO';
      }

      const existente = grupos.get(clave);

      if (existente) {
        existente.cantidad += 1;
        existente.subtotal += Number(
          documento.SUBTOTAL ?? 0,
        );
        existente.impuestoTotal += Number(
          documento.IMPUESTO_TOTAL ?? 0,
        );
        existente.retencionTotal += Number(
          documento.RETENCION_TOTAL ?? 0,
        );
        existente.totalNeto += Number(
          documento.TOTAL_NETO ?? 0,
        );
        existente.totalLocal += Number(
          documento.TOTAL_LOCAL ?? 0,
        );
      } else {
        grupos.set(clave, {
          periodo: clave,
          idProveedor:
            documento.ID_PROVEEDOR !== null
              ? Number(documento.ID_PROVEEDOR)
              : null,
              centroCosto:
  documento.CENTRO_COSTO ?? null,
          tipoDocumento:
            documento.TIPO_DOCUMENTO ?? null,
          moneda: documento.MONEDA ?? null,
          cantidad: 1,
          subtotal: Number(
            documento.SUBTOTAL ?? 0,
          ),
          impuestoTotal: Number(
            documento.IMPUESTO_TOTAL ?? 0,
          ),
          retencionTotal: Number(
            documento.RETENCION_TOTAL ?? 0,
          ),
          totalNeto: Number(
            documento.TOTAL_NETO ?? 0,
          ),
          totalLocal: Number(
            documento.TOTAL_LOCAL ?? 0,
          ),
          participacion: 0,
          variacion: null,
          variacionTexto: 'No disponible',
        });
      }
    }

    /*
     * ============================================================
     * 8. PARTICIPACIÓN Y VARIACIÓN
     * ============================================================
     */

    const detalle = Array.from(grupos.values());

    for (const fila of detalle) {
      fila.participacion =
        totales.totalLocal > 0
          ? (fila.totalLocal /
              totales.totalLocal) *
            100
          : 0;

      if (disponibleComparable) {
        fila.variacion =
          totalComparable > 0
            ? ((fila.totalLocal -
                totalComparable) /
                totalComparable) *
              100
            : null;

        fila.variacionTexto =
          fila.variacion !== null
            ? `${fila.variacion.toFixed(2)}%`
            : 'No disponible';
      }
    }

    /*
     * ============================================================
     * 9. ADVERTENCIAS
     * ============================================================
     */

    if (documentos.length === 0) {
      advertencias.push(
        'No se encontraron documentos para el período y filtros seleccionados.',
      );
    }

    if (!disponibleComparable) {
      advertencias.push(
        'No existe información suficiente para calcular la variación del período comparable.',
      );
    }

   if (filters.clasificacion) {
  advertencias.push(
    'El filtro de clasificación requiere confirmar la tabla o columna relacionada en la base de datos.',
  );
}

    const estadoValidacion =
      errores.length > 0
        ? 'INVALIDO'
        : advertencias.length > 0
          ? 'CON_ADVERTENCIAS'
          : 'VALIDO';

    return {
      fechaInicio: filters.fechaInicio,
      fechaFin: filters.fechaFin,
      agrupacion,
      detalle,
      totales,
      periodoComparable: {
        fechaInicio:
          fechaComparableInicio,
        fechaFin: fechaComparableFin,
        totalLocal: totalComparable,
        disponible: disponibleComparable,
      },
      validacion: {
        estado: estadoValidacion,
        errores,
        advertencias,
      },
    };
  } finally {
    await connection.close();
  }
}
