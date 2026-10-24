import { FileDown, FileSpreadsheet } from 'lucide-react';
import { Button } from '../../../../shared/ui-kit';
import { formatoMonto } from '../../facturas-especiales/api';
import { etiquetaMes, serieColor, type FormatoExportacion } from '../api';

export function BotonesExportar({ disponible, exportando, onExportar }: {
  disponible: boolean; exportando: FormatoExportacion | null; onExportar: (formato: FormatoExportacion) => void;
}) {
  return <div className="flex flex-wrap gap-2">
    <Button variant="secondary" icon={FileSpreadsheet} disabled={!disponible || exportando !== null} onClick={() => onExportar('excel')}>
      {exportando === 'excel' ? 'Generando…' : 'Excel'}</Button>
    <Button variant="secondary" icon={FileDown} disabled={!disponible || exportando !== null} onClick={() => onExportar('pdf')}>
      {exportando === 'pdf' ? 'Generando…' : 'PDF'}</Button>
  </div>;
}

export interface Serie { clave: string; etiqueta: string }

/**
 * Una fila por mes con una barra apilada por serie, proporcional al mes de mayor total.
 * Funciona igual en teléfono: no depende del ancho para mostrar las cifras.
 */
export function TendenciaMensual({ periodos, series, valor, moneda }: {
  periodos: string[]; series: Serie[]; valor: (periodo: string, clave: string) => number; moneda: string;
}) {
  const totales = periodos.map(periodo => series.reduce((total, serie) => total + valor(periodo, serie.clave), 0));
  const mayor = Math.max(...totales, 0);
  return <div>
    {series.length > 1 && <ul className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-sm text-slate-700" aria-label="Series">
      {series.map((serie, indice) => <li key={serie.clave} className="inline-flex items-center gap-1.5">
        <span className={`h-2.5 w-2.5 rounded-full ${serieColor(indice)}`} aria-hidden="true" />{serie.etiqueta}</li>)}
    </ul>}
    <ul className="space-y-2.5">
      {periodos.map((periodo, fila) => <li key={periodo} className="grid grid-cols-[4.5rem_1fr] sm:grid-cols-[5.5rem_1fr_9rem] items-center gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-slate-700 capitalize">{etiquetaMes(periodo)}</span>
        <span className="flex h-3 rounded-full bg-slate-100 overflow-hidden" role="img"
          aria-label={series.map(serie => `${serie.etiqueta}: ${formatoMonto(valor(periodo, serie.clave), moneda)}`).join(', ')}>
          {series.map((serie, indice) => {
            const monto = valor(periodo, serie.clave);
            return monto > 0 && mayor > 0
              ? <span key={serie.clave} className={`h-full ${serieColor(indice)}`} style={{ width: `${(monto / mayor) * 100}%` }} />
              : null;
          })}
        </span>
        <span className="col-start-2 sm:col-start-auto text-sm text-right tabular-nums font-semibold text-slate-900">{formatoMonto(totales[fila], moneda)}</span>
      </li>)}
    </ul>
  </div>;
}

export function Paginacion({ pagina, paginas, onCambiar }: { pagina: number; paginas: number; onCambiar: (pagina: number) => void }) {
  if (paginas <= 1) return null;
  return <div className="flex items-center justify-between gap-3 px-5 py-3 bg-slate-50 text-sm">
    <span className="text-slate-600">Página {pagina} de {paginas}</span>
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" disabled={pagina === 1} onClick={() => onCambiar(pagina - 1)}>Anterior</Button>
      <Button variant="secondary" size="sm" disabled={pagina === paginas} onClick={() => onCambiar(pagina + 1)}>Siguiente</Button>
    </div>
  </div>;
}
