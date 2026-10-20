import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, RefreshCw, TriangleAlert, type LucideIcon } from 'lucide-react';

/** Tono semántico: rojo vencido, naranja atención, verde positivo, azul informativo. */
export type Tono = 'neutro' | 'vencido' | 'atencion' | 'positivo' | 'info';

const TONO_ICONO: Record<Tono, string> = {
  neutro: 'bg-slate-100 text-slate-600',
  vencido: 'bg-red-50 text-red-600',
  atencion: 'bg-amber-50 text-amber-600',
  positivo: 'bg-emerald-50 text-emerald-600',
  info: 'bg-blue-50 text-blue-600',
};
const TONO_VALOR: Record<Tono, string> = {
  neutro: 'text-slate-900', vencido: 'text-red-700', atencion: 'text-amber-700', positivo: 'text-emerald-700', info: 'text-slate-900',
};
const TONO_ESTADO: Record<Tono, string> = {
  neutro: 'bg-slate-100 text-slate-700',
  vencido: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  atencion: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200',
  positivo: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  info: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
};

export function Insignia({ tono, children }: { tono: Tono; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${TONO_ESTADO[tono]}`}>{children}</span>;
}

export function TarjetaIndicador({ icono: Icono, etiqueta, valor, descripcion, tono = 'neutro', estado }: {
  icono: LucideIcon; etiqueta: string; valor: string; descripcion: ReactNode; tono?: Tono; estado?: string;
}) {
  return <div className="h-full bg-white border border-slate-200 rounded-xl shadow-sm p-4 min-w-0 flex flex-col">
    <div className="flex items-center gap-2.5">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONO_ICONO[tono]}`}><Icono size={17} aria-hidden="true" /></span>
      <p className="min-w-0 truncate text-sm font-medium text-slate-600">{etiqueta}</p>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
      <p className={`text-2xl font-bold tracking-tight tabular-nums whitespace-nowrap ${TONO_VALOR[tono]}`}>{valor}</p>
      {estado && <Insignia tono={tono}>{estado}</Insignia>}
    </div>
    <p className="text-xs text-slate-600 mt-1">{descripcion}</p>
  </div>;
}

export function TarjetaIndicadorCargando() {
  return <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 animate-pulse motion-reduce:animate-none" aria-hidden="true">
    <div className="flex items-center gap-2.5"><div className="h-8 w-8 rounded-lg bg-slate-100" /><div className="h-3 w-24 rounded bg-slate-100" /></div>
    <div className="h-6 w-32 rounded bg-slate-200 mt-2" />
    <div className="h-3 w-28 rounded bg-slate-100 mt-2" />
  </div>;
}

/** Cifra breve dentro de un panel: etiqueta, valor y nota opcional sobre un fondo tenue. */
export function Cifra({ etiqueta, valor, nota, tono = 'neutro' }: { etiqueta: string; valor: string; nota?: string; tono?: Tono }) {
  return <div className="rounded-lg bg-slate-50 px-3 py-2.5 min-w-0">
    <dt className="text-xs font-medium text-slate-600 truncate">{etiqueta}</dt>
    <dd className={`text-lg font-bold tracking-tight tabular-nums truncate ${TONO_VALOR[tono]}`}>{valor}</dd>
    {nota && <dd className="text-xs text-slate-600 truncate" title={nota}>{nota}</dd>}
  </div>;
}

/** Tarjeta de sección con título, descripción y enlace al reporte completo. */
export function Panel({ titulo, descripcion, enlace, className = '', children }: {
  titulo: string; descripcion?: ReactNode; enlace?: string; className?: string; children: ReactNode;
}) {
  const id = `panel-${titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return <section aria-labelledby={id} className={`bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col min-w-0 ${className}`}>
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-5 pt-4 pb-3">
      <div className="min-w-0"><h2 id={id} className="text-base font-bold text-slate-900">{titulo}</h2>
        {descripcion && <p className="text-sm text-slate-600">{descripcion}</p>}</div>
      {enlace && <Link to={enlace} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-900 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        Ver reporte<ArrowRight size={15} aria-hidden="true" /></Link>}
    </div>
    <div className="px-5 pb-5 flex-1 min-w-0">{children}</div>
  </section>;
}

export function PanelCargando({ filas = 4 }: { filas?: number }) {
  return <div className="space-y-3 animate-pulse motion-reduce:animate-none" aria-label="Cargando" role="status">
    {Array.from({ length: filas }, (_, indice) => <div key={indice} className="h-4 rounded bg-slate-100" style={{ width: `${90 - indice * 12}%` }} />)}
  </div>;
}

export function PanelError({ mensaje, onReintentar }: { mensaje: string; onReintentar?: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
    <TriangleAlert size={16} aria-hidden="true" className="shrink-0" /><span className="flex-1 min-w-48">{mensaje}</span>
    {onReintentar && <button type="button" onClick={onReintentar}
      className="inline-flex items-center gap-1.5 font-semibold text-red-800 hover:text-red-950 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
      <RefreshCw size={14} aria-hidden="true" />Reintentar</button>}
  </div>;
}

export function PanelVacio({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">{children}</p>;
}

/** Globo con el detalle de un elemento; aparece al pasar el puntero o al enfocar con teclado. */
function Globo({ children, arriba = true }: { children: ReactNode; arriba?: boolean }) {
  return <span role="tooltip" className={`pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 ${arriba ? 'bottom-full mb-2' : 'top-full mt-2'} hidden group-hover:block group-focus-visible:block whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg`}>
    {children}</span>;
}

export interface Segmento { clave: string; etiqueta: string; valor: number; color: string; detalle?: string }

/** Barra horizontal dividida en segmentos proporcionales, con globo por segmento. */
export function BarraSegmentada({ segmentos, formato, alto = 'h-3' }: { segmentos: Segmento[]; formato: (valor: number) => string; alto?: string }) {
  const total = segmentos.reduce((suma, segmento) => suma + segmento.valor, 0);
  if (total <= 0) return <div className={`${alto} rounded-full bg-slate-100`} />;
  return <div className={`flex ${alto} rounded-full bg-slate-100`}>
    {segmentos.filter(segmento => segmento.valor > 0).map((segmento, indice, visibles) =>
      <span key={segmento.clave} tabIndex={0}
        aria-label={`${segmento.etiqueta}: ${formato(segmento.valor)}`}
        className={`group relative h-full ${segmento.color} ${indice === 0 ? 'rounded-l-full' : ''} ${indice === visibles.length - 1 ? 'rounded-r-full' : ''} focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500`}
        style={{ width: `${(segmento.valor / total) * 100}%` }}>
        <Globo>{segmento.etiqueta}: {formato(segmento.valor)}{segmento.detalle ? ` · ${segmento.detalle}` : ''}</Globo>
      </span>)}
  </div>;
}

export interface Columna { clave: string; etiqueta: string; valor: number; detalle?: string }

/** Columnas verticales con eje base y globo por columna; se desplaza en pantallas estrechas. */
export function GraficoColumnas({ columnas, formato, color = 'bg-blue-600' }: { columnas: Columna[]; formato: (valor: number) => string; color?: string }) {
  const mayor = Math.max(...columnas.map(columna => columna.valor), 0);
  return <figure className="overflow-x-auto">
    <div className="flex items-end gap-2 h-36 min-w-full pt-8 border-b border-slate-200" style={{ minWidth: `${columnas.length * 3}rem` }}>
      {columnas.map(columna => <div key={columna.clave} className="flex-1 h-full flex flex-col justify-end items-center min-w-10">
        <span tabIndex={0} aria-label={`${columna.etiqueta}: ${formato(columna.valor)}`}
          className={`group relative w-full max-w-14 rounded-t-md ${color} hover:opacity-85 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500`}
          style={{ height: `${mayor > 0 ? Math.max(2, (columna.valor / mayor) * 100) : 0}%` }}>
          <Globo>{columna.etiqueta}: {formato(columna.valor)}{columna.detalle ? ` · ${columna.detalle}` : ''}</Globo>
        </span>
      </div>)}
    </div>
    <div className="flex gap-2 pt-2" style={{ minWidth: `${columnas.length * 3}rem` }}>
      {columnas.map(columna => <span key={columna.clave} className="flex-1 min-w-10 text-center text-xs font-medium text-slate-600 capitalize">{columna.etiqueta}</span>)}
    </div>
  </figure>;
}

/** Fila de distribución: etiqueta, monto, barra proporcional y nota (documentos, porcentaje). */
export function FilaDistribucion({ etiqueta, valor, porcentaje, nota, color, marcador }: {
  etiqueta: ReactNode; valor: string; porcentaje: number; nota: string; color: string; marcador?: boolean;
}) {
  return <li>
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="inline-flex items-center gap-2 font-medium text-slate-800 min-w-0">
        {marcador && <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} aria-hidden="true" />}<span className="truncate">{etiqueta}</span></span>
      <span className="tabular-nums font-semibold text-slate-900 whitespace-nowrap">{valor}</span>
    </div>
    <div className="flex items-center gap-3 mt-1.5">
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${porcentaje > 0 ? Math.max(1.5, Math.min(100, porcentaje)) : 0}%` }} /></div>
      <span className="text-xs text-slate-600 tabular-nums whitespace-nowrap w-32 text-right">{nota}</span>
    </div>
  </li>;
}
