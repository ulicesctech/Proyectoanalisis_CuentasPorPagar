import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { apiClient, buildQueryString } from '../api';
import { CXP_PENDIENTES } from './cxpHome.config';

type Conteos = Record<string, number | null>;
const NUMERO = new Intl.NumberFormat('es-GT');
const HORA = new Intl.DateTimeFormat('es-GT', { hour: 'numeric', minute: '2-digit' });

/** Documentos por estado en todo el módulo; cada conteo es un listado de documentos con limit=1. */
export function HomePendientes() {
  const [conteos, setConteos] = useState<Conteos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [actualizado, setActualizado] = useState<Date | null>(null);
  const turno = useRef(0);

  const cargar = useCallback(async () => {
    const actual = ++turno.current;
    setCargando(true);
    const resultados = await Promise.allSettled(CXP_PENDIENTES.map(({ estado }) =>
      apiClient.get<{ meta?: { total?: number } }>(`/cxp/documentos${buildQueryString({ estado, limit: 1 })}`)));
    if (actual !== turno.current) return;
    setConteos(Object.fromEntries(resultados.map((resultado, indice) => [
      CXP_PENDIENTES[indice].estado,
      resultado.status === 'fulfilled' && Number.isFinite(resultado.value.meta?.total) ? Number(resultado.value.meta?.total) : null,
    ])));
    setActualizado(new Date());
    setCargando(false);
  }, []);

  useEffect(() => {
    void cargar();
    return () => { turno.current += 1; };
  }, [cargar]);

  const sinDatos = conteos !== null && Object.values(conteos).every(valor => valor === null);
  return <section aria-labelledby="cxp-pendientes-titulo" aria-busy={cargando} className="cxp-home-reveal space-y-3"
    style={{ '--i': 1 } as React.CSSProperties}>
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 id="cxp-pendientes-titulo" className="text-base font-semibold text-slate-900">Documentos en curso</h2>
        <p className="text-sm text-slate-500">Conteo actual por estado en todo el módulo.</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500" aria-live="polite">
          {cargando ? 'Actualizando…' : actualizado ? `Actualizado a las ${HORA.format(actualizado)}` : ''}
        </span>
        <button type="button" onClick={() => void cargar()} disabled={cargando} aria-label="Actualizar conteos"
          title="Actualizar conteos"
          className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors duration-150 hover:border-slate-300 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait">
          <RefreshCw size={15} aria-hidden="true" className={cargando ? 'animate-spin motion-reduce:animate-none' : ''} />
        </button>
      </div>
    </div>
    {sinDatos
      ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        No se pudieron cargar los conteos de documentos.
        <button type="button" onClick={() => void cargar()} className="cursor-pointer font-semibold underline underline-offset-2">Reintentar</button>
      </div>
      : <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {CXP_PENDIENTES.map(({ estado, label, description, dot }) => {
          const valor = conteos?.[estado];
          return <li key={estado}>
            <Link to="/cxp/documentos"
              className="cxp-home-lift group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-600">{label}</span>
                <span aria-hidden="true" className={`size-2 rounded-full ${dot}`} />
              </span>
              <span className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
                {valor === undefined
                  ? <span aria-hidden="true" className="block h-9 w-12 animate-pulse rounded-md bg-slate-100 motion-reduce:animate-none" />
                  : valor === null ? <>—<span className="sr-only"> (no disponible)</span></> : NUMERO.format(valor)}
              </span>
              <span className="mt-1 text-xs text-slate-500">{description}</span>
            </Link>
          </li>;
        })}
      </ul>}
  </section>;
}
