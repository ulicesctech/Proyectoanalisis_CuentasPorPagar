import {
  cxpMoneySum,
  type CxpRetencionResumenMes, type CxpRetencionResumenProveedor, type CxpRetencionesReporte,
} from '@erp/contracts';
import {
  consultarRetenciones,
  RetencionesFilters,
  RetencionesResult,
} from './retenciones.repository';

const SIN_MONEDA = 'SIN MONEDA';
const SIN_CODIGO = 'SIN_CODIGO';

/**
 * Tendencia mensual y retenciones por proveedor. Cada resumen se agrupa por moneda:
 * importes de monedas distintas no se suman. El mes sale de FECHA_APLICACION porque
 * PERIODO_FISCAL puede venir vacío.
 */
export function resumirRetenciones(base: RetencionesResult): CxpRetencionesReporte {
  const meses = new Map<string, CxpRetencionResumenMes>();
  const proveedores = new Map<string, CxpRetencionResumenProveedor>();

  for (const row of base.detalle) {
    const moneda = row.moneda ?? SIN_MONEDA;
    const codigoTributo = row.codigoTributo ?? SIN_CODIGO;
    const nombreTributo = row.nombreTributo ?? codigoTributo;
    const periodo = (row.fechaAplicacion ?? '').slice(0, 7) || 'SIN FECHA';

    const claveMes = `${periodo}|${moneda}|${codigoTributo}`;
    const mes = meses.get(claveMes) ?? {
      periodo, moneda, codigoTributo, nombreTributo, cantidad: 0, baseImponible: 0, monto: 0,
    };
    mes.cantidad += 1;
    mes.baseImponible = cxpMoneySum(mes.baseImponible, row.baseImponible);
    mes.monto = cxpMoneySum(mes.monto, row.monto);
    meses.set(claveMes, mes);

    const claveProveedor = `${moneda}|${row.idProveedor ?? ''}`;
    const proveedor = proveedores.get(claveProveedor) ?? {
      idProveedor: row.idProveedor, nombreProveedor: row.nombreProveedor, moneda,
      cantidad: 0, baseImponible: 0, monto: 0, conConstancia: 0, porTributo: [],
    };
    proveedor.cantidad += 1;
    proveedor.baseImponible = cxpMoneySum(proveedor.baseImponible, row.baseImponible);
    proveedor.monto = cxpMoneySum(proveedor.monto, row.monto);
    if (row.numeroConstancia) proveedor.conConstancia += 1;
    const tributo = proveedor.porTributo.find(item => item.codigoTributo === codigoTributo);
    if (tributo) tributo.monto = cxpMoneySum(tributo.monto, row.monto);
    else proveedor.porTributo.push({ codigoTributo, nombreTributo, monto: row.monto });
    proveedores.set(claveProveedor, proveedor);
  }

  return {
    ...base,
    resumenPorMes: [...meses.values()].sort((a, b) => a.periodo.localeCompare(b.periodo)
      || a.moneda.localeCompare(b.moneda) || a.codigoTributo.localeCompare(b.codigoTributo)),
    resumenPorProveedor: [...proveedores.values()]
      .map(item => ({ ...item, porTributo: item.porTributo.sort((a, b) => a.codigoTributo.localeCompare(b.codigoTributo)) }))
      .sort((a, b) => a.moneda.localeCompare(b.moneda) || b.monto - a.monto || (a.idProveedor ?? 0) - (b.idProveedor ?? 0)),
  };
}

export async function obtenerRetenciones(
  filters: RetencionesFilters,
): Promise<CxpRetencionesReporte> {
  if (!filters.fechaInicio || !filters.fechaFin) {
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

  if (filters.fechaInicio > filters.fechaFin) {
    throw new Error(
      'La fecha inicial no puede ser mayor que la fecha final.',
    );
  }

  if (
    filters.idProveedor !== undefined &&
    (!Number.isInteger(filters.idProveedor) ||
      filters.idProveedor <= 0)
  ) {
    throw new Error(
      'El idProveedor debe ser un número entero positivo.',
    );
  }

  if (
    filters.idDocumento !== undefined &&
    (!Number.isInteger(filters.idDocumento) ||
      filters.idDocumento <= 0)
  ) {
    throw new Error(
      'El idDocumento debe ser un número entero positivo.',
    );
  }

  if (
    filters.idSucursal !== undefined &&
    (!Number.isInteger(filters.idSucursal) ||
      filters.idSucursal <= 0)
  ) {
    throw new Error(
      'El idSucursal debe ser un número entero positivo.',
    );
  }

  return resumirRetenciones(await consultarRetenciones(filters));
}