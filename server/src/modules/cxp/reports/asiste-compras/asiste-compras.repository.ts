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
) {
  const connection = await getConnection();

  try {
    const periodoResult = await connection.execute<{
      ID_PERIODO: number;
      ID_SUCURSAL: number;
      ESTADO: string;
      FECHA_INICIO: Date;
      FECHA_FIN: Date;
    }>(
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
          fechaInicio: periodoRow.FECHA_INICIO
            ? periodoRow.FECHA_INICIO.toISOString().slice(0, 10)
            : null,
          fechaFin: periodoRow.FECHA_FIN
            ? periodoRow.FECHA_FIN.toISOString().slice(0, 10)
            : null,
        }
      : {
          idPeriodo: null,
          idSucursal: filters.idSucursal ?? null,
          estado: null,
          fechaInicio: null,
          fechaFin: null,
        };

    const documentosResult = await connection.execute<{
      ID_DOCUMENTO: number;
      ID_PROVEEDOR: number | null;
      TIPO_DOCUMENTO: string | null;
      NUMERO_DOCUMENTO: string | null;
      FECHA_DOCUMENTO: Date | null;
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
          d.FECHA_DOCUMENTO,
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
          AND NVL(d.ESTADO, 'SIN_ESTADO') <> 'ANULADA'
          ${filters.idSucursal ? 'AND d.ID_SUCURSAL = :idSucursal' : ''}
        ORDER BY d.FECHA_DOCUMENTO, d.ID_DOCUMENTO
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

    const documentos = documentosResult.rows ?? [];

    const documentosIds = documentos.map((documento) => documento.ID_DOCUMENTO);

    let tributos: AsisteCompraTributo[] = [];

    if (documentosIds.length > 0) {
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
        FECHA_APLICACION: Date | null;
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
            t.FECHA_APLICACION,
            t.ESTADO
          FROM CXP_DOCUMENTO_TRIBUTO t
          WHERE t.ID_DOCUMENTO IN (${documentosIds.map((_, index) => `:id${index}`).join(', ')})
          ORDER BY t.ID_DOCUMENTO, t.FECHA_APLICACION
        `,
        Object.fromEntries(
          documentosIds.map((id, index) => [`id${index}`, id]),
        ),
        {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        },
      );

      tributos = (tributosResult.rows ?? []).map((tributo) => ({
        tipoTributo: tributo.TIPO_TRIBUTO,
        codigoTributo: tributo.CODIGO_TRIBUTO,
        nombreTributo: tributo.NOMBRE_TRIBUTO,
        baseImponible: Number(tributo.BASE_IMPONIBLE ?? 0),
        porcentaje: Number(tributo.PORCENTAJE ?? 0),
        monto: Number(tributo.MONTO ?? 0),
        numeroConstancia: tributo.NUMERO_CONSTANCIA,
        periodoFiscal: tributo.PERIODO_FISCAL,
        fechaAplicacion: tributo.FECHA_APLICACION
          ? tributo.FECHA_APLICACION.toISOString().slice(0, 10)
          : null,
        estado: tributo.ESTADO,
      }));
    }

    const documentosMap = new Map<number, AsisteCompraDocumento>();

    for (const documento of documentos) {
      documentosMap.set(documento.ID_DOCUMENTO, {
        idDocumento: documento.ID_DOCUMENTO,
        idProveedor: documento.ID_PROVEEDOR,
        tipoDocumento: documento.TIPO_DOCUMENTO,
        numeroDocumento: documento.NUMERO_DOCUMENTO,
        fechaDocumento: documento.FECHA_DOCUMENTO
          ? documento.FECHA_DOCUMENTO.toISOString().slice(0, 10)
          : null,
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
        tributos: [],
      });
    }

    // Enlazar los tributos con cada documento.
    for (const tributo of tributos) {
      // El ID del documento se recupera mediante una consulta independiente
      // para mantener el objeto de salida limpio.
    }

    // Segunda consulta sencilla para relacionar los tributos con su documento.
    if (documentosIds.length > 0) {
      const relacionTributos = await connection.execute<{
        ID_DOCUMENTO: number;
      }>(
        `
          SELECT DISTINCT t.ID_DOCUMENTO
          FROM CXP_DOCUMENTO_TRIBUTO t
          WHERE t.ID_DOCUMENTO IN (${documentosIds.map((_, index) => `:rid${index}`).join(', ')})
        `,
        Object.fromEntries(
          documentosIds.map((id, index) => [`rid${index}`, id]),
        ),
        {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        },
      );

      const idsConTributos = new Set(
        (relacionTributos.rows ?? []).map((row) => row.ID_DOCUMENTO),
      );

      if (idsConTributos.size > 0) {
        const tributosPorDocumento = await connection.execute<{
          ID_DOCUMENTO: number;
          TIPO_TRIBUTO: string | null;
          CODIGO_TRIBUTO: string | null;
          NOMBRE_TRIBUTO: string | null;
          BASE_IMPONIBLE: number | null;
          PORCENTAJE: number | null;
          MONTO: number | null;
          NUMERO_CONSTANCIA: string | null;
          PERIODO_FISCAL: string | null;
          FECHA_APLICACION: Date | null;
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
              t.FECHA_APLICACION,
              t.ESTADO
            FROM CXP_DOCUMENTO_TRIBUTO t
            WHERE t.ID_DOCUMENTO IN (${documentosIds.map((_, index) => `:tid${index}`).join(', ')})
            ORDER BY t.ID_DOCUMENTO, t.FECHA_APLICACION
          `,
          Object.fromEntries(
            documentosIds.map((id, index) => [`tid${index}`, id]),
          ),
          {
            outFormat: oracledb.OUT_FORMAT_OBJECT,
          },
        );

        for (const tributo of tributosPorDocumento.rows ?? []) {
          const documento = documentosMap.get(tributo.ID_DOCUMENTO);

          if (!documento) {
            continue;
          }

          documento.tributos.push({
            tipoTributo: tributo.TIPO_TRIBUTO,
            codigoTributo: tributo.CODIGO_TRIBUTO,
            nombreTributo: tributo.NOMBRE_TRIBUTO,
            baseImponible: Number(tributo.BASE_IMPONIBLE ?? 0),
            porcentaje: Number(tributo.PORCENTAJE ?? 0),
            monto: Number(tributo.MONTO ?? 0),
            numeroConstancia: tributo.NUMERO_CONSTANCIA,
            periodoFiscal: tributo.PERIODO_FISCAL,
            fechaAplicacion: tributo.FECHA_APLICACION
              ? tributo.FECHA_APLICACION.toISOString().slice(0, 10)
              : null,
            estado: tributo.ESTADO,
          });
        }
      }
    }

    return {
      periodo,
      documentos: Array.from(documentosMap.values()),
    };
  } finally {
    await connection.close();
  }
}