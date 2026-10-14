import oracledb from 'oracledb';
import { getConnection } from '../../../../config/database';

export interface AsisteComprasFilters {
  fechaInicio: string;
  fechaFin: string;
  idSucursal?: number;
  versionFormato?: string;
}

export interface AsisteCompraDocumento {
  idDocumento: number;
  idProveedor: number | null;
  tipoDocumento: string | null;
  numeroDocumento: string | null;
  fechaDocumento: string | null;
  moneda: string | null;
  tipoCambio: number | null;
  subtotal: number;
  impuestoTotal: number;
  retencionTotal: number;
  totalNeto: number;
  totalLocal: number;
  estado: string | null;
  centroCosto: string | null;
  tributos: AsisteCompraTributo[];
}

export interface AsisteCompraTributo {
  tipoTributo: string | null;
  codigoTributo: string | null;
  nombreTributo: string | null;
  baseImponible: number;
  porcentaje: number;
  monto: number;
  numeroConstancia: string | null;
  periodoFiscal: string | null;
  fechaAplicacion: string | null;
  estado: string | null;
}

export interface AsisteComprasPeriodo {
  idPeriodo: number | null;
  idSucursal: number | null;
  estado: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
}

export async function consultarAsisteCompras(
  filters: AsisteComprasFilters,
  connectionFactory: typeof getConnection = getConnection,
) {
  const connection = await connectionFactory();

  try {
    const periodoResult = await connection.execute<{
      ID_PERIODO: number;
      ID_SUCURSAL: number;
      ESTADO: string;
      FECHA_INICIO: string;
      FECHA_FIN: string;
    }>(
      `
        SELECT
          p.ID_PERIODO,
          p.ID_SUCURSAL,
          p.ESTADO,
          TO_CHAR(p.FECHA_INICIO, 'YYYY-MM-DD') AS FECHA_INICIO,
          TO_CHAR(p.FECHA_FIN, 'YYYY-MM-DD') AS FECHA_FIN
        FROM CXP_PERIODO p
        WHERE p.FECHA_INICIO <= TO_DATE(:fechaInicio, 'YYYY-MM-DD')
          AND p.FECHA_FIN >= TO_DATE(:fechaFin, 'YYYY-MM-DD')
          ${filters.idSucursal ? 'AND p.ID_SUCURSAL = :idSucursal' : ''}
        ORDER BY p.ID_PERIODO
        FETCH FIRST 1 ROW ONLY
      `,
      {
        fechaInicio: filters.fechaInicio,
        fechaFin: filters.fechaFin,
        ...(filters.idSucursal
          ? { idSucursal: filters.idSucursal }
          : {}),
      },
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      },
    );

    const periodoRow = periodoResult.rows?.[0];

    const periodo: AsisteComprasPeriodo = periodoRow
      ? {
          idPeriodo: periodoRow.ID_PERIODO,
          idSucursal: periodoRow.ID_SUCURSAL,
          estado: periodoRow.ESTADO,
          fechaInicio: periodoRow.FECHA_INICIO ?? null,
          fechaFin: periodoRow.FECHA_FIN ?? null,
        }
      : {
          idPeriodo: null,
          idSucursal: filters.idSucursal ?? null,
          estado: null,
          fechaInicio: null,
          fechaFin: null,
        };

    const idSucursalDocumento = filters.idSucursal ?? periodo.idSucursal ?? undefined;
    const documentosResult = await connection.execute<{
      ID_DOCUMENTO: number;
      ID_PROVEEDOR: number | null;
      TIPO_DOCUMENTO: string | null;
      NUMERO_DOCUMENTO: string | null;
      FECHA_DOCUMENTO: string | null;
      MONEDA: string | null;
      TIPO_CAMBIO: number | null;
      SUBTOTAL: number | null;
      IMPUESTO_TOTAL: number | null;
      RETENCION_TOTAL: number | null;
      TOTAL_NETO: number | null;
      TOTAL_LOCAL: number | null;
      ESTADO: string | null;
      CENTRO_COSTO: string | null;
    }>(
      `
        SELECT
          d.ID_DOCUMENTO,
          d.ID_PROVEEDOR,
          d.TIPO_DOCUMENTO,
          d.NUMERO_DOCUMENTO,
          TO_CHAR(d.FECHA_DOCUMENTO, 'YYYY-MM-DD') AS FECHA_DOCUMENTO,
          d.MONEDA,
          d.TIPO_CAMBIO,
          NVL(d.SUBTOTAL, 0) AS SUBTOTAL,
          NVL(d.IMPUESTO_TOTAL, 0) AS IMPUESTO_TOTAL,
          NVL(d.RETENCION_TOTAL, 0) AS RETENCION_TOTAL,
          NVL(d.TOTAL_NETO, 0) AS TOTAL_NETO,
          NVL(d.TOTAL_LOCAL, 0) AS TOTAL_LOCAL,
          d.ESTADO,
          d.CENTRO_COSTO
        FROM CXP_DOCUMENTO d
        WHERE d.FECHA_DOCUMENTO >= TO_DATE(:fechaInicio, 'YYYY-MM-DD')
          AND d.FECHA_DOCUMENTO < TO_DATE(:fechaFin, 'YYYY-MM-DD') + 1
          AND d.ESTADO NOT IN ('BORRADOR', 'RECIBIDO', 'PENDIENTE_CLASIFICACION', 'PENDIENTE_REVISION', 'EN_VALIDACION', 'DUPLICADO', 'CON_DIFERENCIAS', 'PENDIENTE_APROBACION', 'RECHAZADA', 'BLOQUEADA', 'EN_DISPUTA', 'ANULADA')
          AND d.TIPO_DOCUMENTO NOT IN ('GASTO_CAJA_CHICA', 'REEMBOLSO')
          AND (d.TIPO_DOCUMENTO <> 'FACTURA_ESPECIAL' OR d.ESTADO <> 'APROBADA')
          ${idSucursalDocumento ? 'AND d.ID_SUCURSAL = :idSucursal' : ''}
        ORDER BY d.FECHA_DOCUMENTO, d.ID_DOCUMENTO
      `,
      {
        fechaInicio: filters.fechaInicio,
        fechaFin: filters.fechaFin,
        ...(idSucursalDocumento
          ? { idSucursal: idSucursalDocumento }
          : {}),
      },
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      },
    );

    const documentos = documentosResult.rows ?? [];

    const documentosIds = documentos.map((documento) => documento.ID_DOCUMENTO);

    const tributosPorDocumento = new Map<number, AsisteCompraTributo[]>();

    for (let offset = 0; offset < documentosIds.length; offset += 900) {
      const loteIds = documentosIds.slice(offset, offset + 900);
      const tributosResult = await connection.execute<{
        ID_DOCUMENTO: number;
        TIPO_TRIBUTO: string | null;
        CODIGO_TRIBUTO: string | null;
        NOMBRE_TRIBUTO: string | null;
        BASE_IMPONIBLE: number | null;
        PORCENTAJE: number | null;
        MONTO: number | null;
        NUMERO_CONSTANCIA: string | null;
        PERIODO_FISCAL: string | null;
        FECHA_APLICACION: string | null;
        ESTADO: string | null;
      }>(
        `
          SELECT
            t.ID_DOCUMENTO,
            t.TIPO_TRIBUTO,
            t.CODIGO_TRIBUTO,
            t.NOMBRE_TRIBUTO,
            NVL(t.BASE_IMPONIBLE, 0) AS BASE_IMPONIBLE,
            NVL(t.PORCENTAJE, 0) AS PORCENTAJE,
            NVL(t.MONTO, 0) AS MONTO,
            t.NUMERO_CONSTANCIA,
            t.PERIODO_FISCAL,
            TO_CHAR(t.FECHA_APLICACION, 'YYYY-MM-DD') AS FECHA_APLICACION,
            t.ESTADO
          FROM CXP_DOCUMENTO_TRIBUTO t
          WHERE t.ID_DOCUMENTO IN (${loteIds.map((_, index) => `:id${index}`).join(', ')})
            AND t.ESTADO <> 'ANULADO'
          ORDER BY t.ID_DOCUMENTO, t.FECHA_APLICACION
        `,
        Object.fromEntries(
          loteIds.map((id, index) => [`id${index}`, id]),
        ),
        {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        },
      );

      for (const tributo of tributosResult.rows ?? []) {
        const item: AsisteCompraTributo = {
        tipoTributo: tributo.TIPO_TRIBUTO,
        codigoTributo: tributo.CODIGO_TRIBUTO,
        nombreTributo: tributo.NOMBRE_TRIBUTO,
        baseImponible: Number(tributo.BASE_IMPONIBLE ?? 0),
        porcentaje: Number(tributo.PORCENTAJE ?? 0),
        monto: Number(tributo.MONTO ?? 0),
        numeroConstancia: tributo.NUMERO_CONSTANCIA,
        periodoFiscal: tributo.PERIODO_FISCAL,
        fechaAplicacion: tributo.FECHA_APLICACION ?? null,
        estado: tributo.ESTADO,
        };
        const asociados = tributosPorDocumento.get(tributo.ID_DOCUMENTO) ?? [];
        asociados.push(item);
        tributosPorDocumento.set(tributo.ID_DOCUMENTO, asociados);
      }
    }

    const documentosMap = new Map<number, AsisteCompraDocumento>();

    for (const documento of documentos) {
      documentosMap.set(documento.ID_DOCUMENTO, {
        idDocumento: documento.ID_DOCUMENTO,
        idProveedor: documento.ID_PROVEEDOR,
        tipoDocumento: documento.TIPO_DOCUMENTO,
        numeroDocumento: documento.NUMERO_DOCUMENTO,
        fechaDocumento: documento.FECHA_DOCUMENTO ?? null,
        moneda: documento.MONEDA,
        tipoCambio:
          documento.TIPO_CAMBIO !== null
            ? Number(documento.TIPO_CAMBIO)
            : null,
        subtotal: Number(documento.SUBTOTAL ?? 0),
        impuestoTotal: Number(documento.IMPUESTO_TOTAL ?? 0),
        retencionTotal: Number(documento.RETENCION_TOTAL ?? 0),
        totalNeto: Number(documento.TOTAL_NETO ?? 0),
        totalLocal: Number(documento.TOTAL_LOCAL ?? 0),
        estado: documento.ESTADO,
        centroCosto: documento.CENTRO_COSTO,
        tributos: tributosPorDocumento.get(documento.ID_DOCUMENTO) ?? [],
      });
    }

    return {
      periodo,
      documentos: Array.from(documentosMap.values()),
    };
  } finally {
    await connection.close();
  }
}
