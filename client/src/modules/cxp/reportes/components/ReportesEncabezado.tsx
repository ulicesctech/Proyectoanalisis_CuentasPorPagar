import type { ReactNode } from 'react';
import { CxpBreadcrumb } from '../../components/CxpBreadcrumb';
import { parametrosPeriodo, type Periodo } from '../api';

export type PestanaReporte = 'resumen' | 'antiguedad' | 'retenciones' | 'estadistica';

const PANTALLAS: Record<PestanaReporte, { ruta: string; miga: string; titulo: string }> = {
  resumen: { ruta: '/cxp/reportes', miga: 'Resumen', titulo: 'Resumen de cuentas por pagar' },
  antiguedad: { ruta: '/cxp/reportes/antiguedad', miga: 'Antigüedad de saldos', titulo: 'Antigüedad de saldos' },
  retenciones: { ruta: '/cxp/reportes/retenciones', miga: 'Retenciones', titulo: 'Retenciones de IVA e ISR' },
  estadistica: { ruta: '/cxp/reportes/estadistica', miga: 'Estadística de compras', titulo: 'Estadística de compras' },
};

/** Ruta de un reporte con el período en la URL, para que el reporte abra con las mismas fechas. */
export const rutaReporte = (clave: PestanaReporte, periodo: Periodo) => `${PANTALLAS[clave].ruta}?${parametrosPeriodo(periodo)}`;

/**
 * Encabezado de cada reporte: ruta de navegación, título y descripción, con las acciones a la
 * derecha. Las pestañas entre reportes las dibuja CxpLayout.
 */
export function ReportesEncabezado({ actual, descripcion, children }: {
  actual: PestanaReporte; periodo?: Periodo; descripcion: ReactNode; children?: ReactNode;
}) {
  const pantalla = PANTALLAS[actual];
  // Ruta, título y descripción separados con aire suficiente; las acciones se alinean con el título.
  return <div className="flex flex-wrap justify-between items-end gap-x-6 gap-y-4 pb-2">
    <div className="min-w-0 max-w-3xl">
      <div className="mb-3"><CxpBreadcrumb group="Reportes" current={pantalla.miga} /></div>
      <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight text-slate-900">{pantalla.titulo}</h1>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-slate-600">{descripcion}</p>
    </div>
    {children && <div className="shrink-0">{children}</div>}
  </div>;
}
