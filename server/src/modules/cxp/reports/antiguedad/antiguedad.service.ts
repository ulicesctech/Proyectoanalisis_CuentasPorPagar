import {
  RANGOS_ANTIGUEDAD, RANGOS_ANTIGUEDAD_VENCIDOS, cxpMoneySum,
  type CxpAntiguedadProveedor, type CxpAntiguedadReporte, type CxpAntiguedadResumenMoneda,
  type CxpAntiguedadResumenRango, type CxpRangoAntiguedad,
} from '@erp/contracts';
import {
  AntiguedadFilters,
  AntiguedadResult,
  consultarAntiguedad,
} from './antiguedad.repository';

const SIN_MONEDA = 'SIN MONEDA';

/**
 * Deuda vencida, rangos y ranking de proveedores a partir del detalle al corte.
 * Cada resumen se agrupa por moneda: importes de monedas distintas no se suman.
 */
export function resumirAntiguedad(base: AntiguedadResult): CxpAntiguedadReporte {
  const vencido = (rango: string) => RANGOS_ANTIGUEDAD_VENCIDOS.includes(rango as CxpRangoAntiguedad);
  const monedas = new Map<string, CxpAntiguedadResumenMoneda>();
  const rangos = new Map<string, CxpAntiguedadResumenRango>();
  const proveedores = new Map<string, Omit<CxpAntiguedadProveedor, 'posicion' | 'participacion'>>();

  for (const row of base.detalle) {
    const moneda = row.moneda ?? SIN_MONEDA;
    const saldo = row.saldoHistorico;
    const saldoVencido = vencido(row.rangoAntiguedad) ? saldo : 0;

    const resumen = monedas.get(moneda) ?? {
      moneda, cantidadDocumentos: 0, saldoTotal: 0, saldoVencido: 0, saldoNoVencido: 0,
    };
    resumen.cantidadDocumentos += 1;
    resumen.saldoTotal = cxpMoneySum(resumen.saldoTotal, saldo);
    resumen.saldoVencido = cxpMoneySum(resumen.saldoVencido, saldoVencido);
    resumen.saldoNoVencido = cxpMoneySum(resumen.saldoTotal, -resumen.saldoVencido);
    monedas.set(moneda, resumen);

    const claveRango = `${moneda}|${row.rangoAntiguedad}`;
    const rango = rangos.get(claveRango) ?? {
      moneda, rango: row.rangoAntiguedad as CxpRangoAntiguedad, cantidadDocumentos: 0, saldo: 0,
    };
    rango.cantidadDocumentos += 1;
    rango.saldo = cxpMoneySum(rango.saldo, saldo);
    rangos.set(claveRango, rango);

    const claveProveedor = `${moneda}|${row.idProveedor}`;
    const proveedor = proveedores.get(claveProveedor) ?? {
      idProveedor: row.idProveedor, nombreProveedor: row.nombreProveedor, moneda,
      cantidadDocumentos: 0, saldoTotal: 0, saldoVencido: 0, diasMaximos: 0,
    };
    proveedor.cantidadDocumentos += 1;
    proveedor.saldoTotal = cxpMoneySum(proveedor.saldoTotal, saldo);
    proveedor.saldoVencido = cxpMoneySum(proveedor.saldoVencido, saldoVencido);
    proveedor.diasMaximos = Math.max(proveedor.diasMaximos, row.diasAntiguedad);
    proveedores.set(claveProveedor, proveedor);
  }

  const posiciones = new Map<string, number>();
  const rankingProveedores = [...proveedores.values()]
    .sort((a, b) => a.moneda.localeCompare(b.moneda) || b.saldoTotal - a.saldoTotal
      || b.saldoVencido - a.saldoVencido || a.idProveedor - b.idProveedor)
    .map(proveedor => {
      const posicion = (posiciones.get(proveedor.moneda) ?? 0) + 1;
      posiciones.set(proveedor.moneda, posicion);
      const total = monedas.get(proveedor.moneda)!.saldoTotal;
      const participacion = total > 0 ? Math.round((proveedor.saldoTotal / total) * 10000) / 100 : 0;
      return { posicion, ...proveedor, participacion };
    });

  const orden = (rango: string) => RANGOS_ANTIGUEDAD.indexOf(rango as CxpRangoAntiguedad);
  return {
    ...base,
    resumenPorMoneda: [...monedas.values()].sort((a, b) => a.moneda.localeCompare(b.moneda)),
    resumenPorRango: [...rangos.values()]
      .sort((a, b) => a.moneda.localeCompare(b.moneda) || orden(a.rango) - orden(b.rango)),
    rankingProveedores,
  };
}

export async function obtenerAntiguedad(
  filters: AntiguedadFilters,
): Promise<CxpAntiguedadReporte> {
  if (filters.clasificacion) throw new Error('La clasificación RF02 aún no tiene persistencia definida.');
  if (!filters.fechaCorte) {
    throw new Error('La fecha de corte es obligatoria.');
  }

  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(
    filters.fechaCorte,
  );

  if (!fechaValida) {
    throw new Error(
      'La fecha de corte debe tener el formato YYYY-MM-DD.',
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

  return resumirAntiguedad(await consultarAntiguedad(filters));
}
