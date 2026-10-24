import {
  cxpMoneySum,
  type CxpEstadisticaMes, type CxpEstadisticaProveedor, type CxpEstadisticaResumen,
  type CxpEstadisticaTipoDocumento,
} from '@erp/contracts';
import {
  EstadisticaComprasFilters,
  EstadisticaComprasResult,
  EstadisticaDocumento,
  consultarEstadisticaCompras,
} from './estadistica.repository';

const porcentaje = (parte: number, total: number) => total > 0 ? Math.round((parte / total) * 10000) / 100 : 0;

/**
 * Compras por mes, proveedor y tipo de documento a partir de los documentos del período,
 * y la variación del total contra el período anterior. Usa TOTAL_LOCAL (moneda local).
 */
export function resumirEstadistica(
  base: EstadisticaComprasResult & { documentos: EstadisticaDocumento[] },
): EstadisticaComprasResult & { resumen: CxpEstadisticaResumen } {
  const { documentos, ...resultado } = base;
  const meses = new Map<string, CxpEstadisticaMes>();
  const proveedores = new Map<string, Omit<CxpEstadisticaProveedor, 'posicion' | 'participacion'>>();
  const tipos = new Map<string, Omit<CxpEstadisticaTipoDocumento, 'participacion'>>();
  let total = 0;

  for (const documento of documentos) {
    total = cxpMoneySum(total, documento.totalLocal);
    const mes = meses.get(documento.periodo) ?? { periodo: documento.periodo, cantidad: 0, totalLocal: 0 };
    mes.cantidad += 1;
    mes.totalLocal = cxpMoneySum(mes.totalLocal, documento.totalLocal);
    meses.set(documento.periodo, mes);

    const claveProveedor = String(documento.idProveedor ?? '');
    const proveedor = proveedores.get(claveProveedor) ?? {
      idProveedor: documento.idProveedor, nombreProveedor: documento.nombreProveedor, cantidad: 0, totalLocal: 0,
    };
    proveedor.cantidad += 1;
    proveedor.totalLocal = cxpMoneySum(proveedor.totalLocal, documento.totalLocal);
    proveedores.set(claveProveedor, proveedor);

    const tipoDocumento = documento.tipoDocumento ?? 'SIN_TIPO';
    const tipo = tipos.get(tipoDocumento) ?? { tipoDocumento, cantidad: 0, totalLocal: 0 };
    tipo.cantidad += 1;
    tipo.totalLocal = cxpMoneySum(tipo.totalLocal, documento.totalLocal);
    tipos.set(tipoDocumento, tipo);
  }

  const anterior = resultado.periodoComparable.totalLocal;
  return {
    ...resultado,
    resumen: {
      porMes: [...meses.values()].sort((a, b) => a.periodo.localeCompare(b.periodo)),
      porProveedor: [...proveedores.values()]
        .sort((a, b) => b.totalLocal - a.totalLocal || (a.idProveedor ?? 0) - (b.idProveedor ?? 0))
        .map((proveedor, indice) => ({ posicion: indice + 1, ...proveedor, participacion: porcentaje(proveedor.totalLocal, total) })),
      porTipoDocumento: [...tipos.values()]
        .sort((a, b) => b.totalLocal - a.totalLocal || a.tipoDocumento.localeCompare(b.tipoDocumento))
        .map(tipo => ({ ...tipo, participacion: porcentaje(tipo.totalLocal, total) })),
      variacionTotal: anterior > 0 ? Math.round(((total - anterior) / anterior) * 10000) / 100 : null,
    },
  };
}

export async function obtenerEstadisticaCompras(
  filters: EstadisticaComprasFilters,
) {
  if (filters.clasificacion || filters.agrupacion === 'CLASIFICACION') {
    throw new Error('La clasificación RF02 aún no tiene persistencia definida.');
  }
  if (
    !filters.fechaInicio ||
    !filters.fechaFin
  ) {
    throw new Error(
      'La fecha inicial y la fecha final son obligatorias.',
    );
  }

  const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (
    !fechaRegex.test(filters.fechaInicio) ||
    !fechaRegex.test(filters.fechaFin)
  ) {
    throw new Error(
      'Las fechas deben tener el formato YYYY-MM-DD.',
    );
  }

  if (
    filters.fechaInicio > filters.fechaFin
  ) {
    throw new Error(
      'La fecha inicial no puede ser mayor que la fecha final.',
    );
  }

  if (
    filters.idProveedor !== undefined &&
    (!Number.isInteger(
      filters.idProveedor,
    ) ||
      filters.idProveedor <= 0)
  ) {
    throw new Error(
      'El idProveedor debe ser un número entero positivo.',
    );
  }

  return resumirEstadistica(await consultarEstadisticaCompras(filters));
}
