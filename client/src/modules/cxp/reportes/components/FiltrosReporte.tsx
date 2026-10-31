import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { CalendarRange, LoaderCircle, Search, SlidersHorizontal, X } from 'lucide-react';
import { Button, Select, TextInput } from '../../../../shared/ui-kit';
import { atajosCorte, atajosPeriodo, catalogoMonedas, hoyGuatemala, type Periodo } from '../api';

export interface ChipFiltro { clave: string; etiqueta: string; valor: string; onQuitar: () => void }

/** Nombres de proveedor ya vistos (id → nombre), para mostrarlos en los filtros aplicados. */
export function useNombresProveedor() {
  const [nombres, setNombres] = useState<Record<string, string>>({});
  const recordar = useCallback((id: string, nombre?: string) => {
    if (!id || !nombre) return;
    setNombres(actual => (actual[id] === nombre ? actual : { ...actual, [id]: nombre }));
  }, []);
  return [nombres, recordar] as const;
}

/**
 * Panel común de filtros de los reportes: atajos arriba, campos en una cuadrícula de 12 columnas
 * y, abajo, los filtros aplicados con el botón para consultar.
 */
export function PanelFiltros({ titulo = 'Filtros', atajos, children, chips, onLimpiar, pendientes, cargando, onSubmit,
  textoBoton = 'Consultar', errorValidacion }: {
  titulo?: string; atajos?: ReactNode; children: ReactNode; chips?: ChipFiltro[]; onLimpiar?: () => void;
  pendientes: boolean; cargando: boolean; onSubmit: () => void; textoBoton?: string; errorValidacion?: string | null;
}) {
  const enviar = (event: FormEvent) => { event.preventDefault(); onSubmit(); };
  return <form onSubmit={enviar} noValidate aria-label={titulo} aria-busy={cargando}
    className="rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <SlidersHorizontal size={16} aria-hidden="true" className="text-slate-400" />{titulo}
        </h2>
        {atajos}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-start">{children}</div>
      {errorValidacion && <p role="alert" className="sr-only">{errorValidacion}</p>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {!chips ? null : chips.length === 0
          ? <span className="text-xs text-slate-500">Sin filtros adicionales</span>
          : <>
            <span className="text-xs font-medium text-slate-500">Aplicados:</span>
            {chips.map(chip => <button key={chip.clave} type="button" onClick={chip.onQuitar} disabled={cargando}
              aria-label={`Quitar filtro ${chip.etiqueta}: ${chip.valor}`}
              className="inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 py-1 pl-3 pr-2 text-xs font-medium text-blue-800 transition-colors duration-150 hover:border-blue-300 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-60">
              <span className="truncate"><span className="text-blue-600">{chip.etiqueta}:</span> {chip.valor}</span>
              <X size={13} aria-hidden="true" className="shrink-0" />
            </button>)}
            {onLimpiar && chips.length > 1 && <button type="button" onClick={onLimpiar} disabled={cargando}
              className="cursor-pointer rounded px-1 text-xs font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait">
              Limpiar filtros
            </button>}
          </>}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <span role="status" className="text-xs font-medium text-amber-700">
          {pendientes && !cargando ? <><span aria-hidden="true" className="mr-1.5 inline-block size-1.5 rounded-full bg-amber-500 align-middle" />Cambios sin aplicar</> : ''}
        </span>
        <Button type="submit" icon={cargando ? LoaderCircle : Search} disabled={cargando} aria-busy={cargando}
          className={cargando ? '[&>svg]:animate-spin motion-reduce:[&>svg]:animate-none' : ''}>
          {cargando ? 'Consultando…' : pendientes ? 'Aplicar filtros' : textoBoton}
        </Button>
      </div>
    </div>
  </form>;
}

function Atajo({ etiqueta, activo, onClick, deshabilitado }: { etiqueta: string; activo: boolean; onClick: () => void; deshabilitado: boolean }) {
  return <button type="button" aria-pressed={activo} onClick={onClick} disabled={deshabilitado}
    className={`h-8 cursor-pointer rounded-full px-3 text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-60 ${activo
      ? 'bg-blue-600 text-white shadow-sm'
      : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900'}`}>
    {etiqueta}
  </button>;
}

/** Atajos de período: al elegir uno se consulta de inmediato. */
export function AtajosPeriodo({ periodo, onElegir, cargando }: { periodo: Periodo; onElegir: (periodo: Periodo) => void; cargando: boolean }) {
  return <div role="group" aria-label="Períodos rápidos" className="flex flex-wrap items-center gap-1.5">
    <CalendarRange size={15} aria-hidden="true" className="mr-0.5 text-slate-400" />
    {atajosPeriodo().map(atajo => <Atajo key={atajo.clave} etiqueta={atajo.etiqueta} deshabilitado={cargando}
      activo={atajo.periodo.fechaInicio === periodo.fechaInicio && atajo.periodo.fechaFin === periodo.fechaFin}
      onClick={() => onElegir(atajo.periodo)} />)}
  </div>;
}

/** Atajos de fecha de corte para la antigüedad de saldos. */
export function AtajosCorte({ fecha, onElegir, cargando }: { fecha: string; onElegir: (fecha: string) => void; cargando: boolean }) {
  return <div role="group" aria-label="Fechas de corte rápidas" className="flex flex-wrap items-center gap-1.5">
    <CalendarRange size={15} aria-hidden="true" className="mr-0.5 text-slate-400" />
    {atajosCorte().map(atajo => <Atajo key={atajo.clave} etiqueta={atajo.etiqueta} deshabilitado={cargando}
      activo={atajo.fecha === fecha} onClick={() => onElegir(atajo.fecha)} />)}
  </div>;
}

/** Valida Desde/Hasta y devuelve el mensaje de cada campo (o null). */
export function erroresPeriodo(periodo: Periodo): { desde: string | null; hasta: string | null } {
  const hoy = hoyGuatemala();
  return {
    desde: !periodo.fechaInicio ? 'Indica la fecha inicial.'
      : periodo.fechaFin && periodo.fechaInicio > periodo.fechaFin ? 'No puede ser posterior a Hasta.' : null,
    hasta: !periodo.fechaFin ? 'Indica la fecha final.' : periodo.fechaFin > hoy ? 'No puede ser posterior a hoy.' : null,
  };
}

/** Campos Desde/Hasta con límites en el calendario y el error junto a cada campo. */
export function CamposPeriodo({ prefijo, periodo, onCambiar, mostrarErrores, etiquetaHasta = 'Hasta', className = 'lg:col-span-2' }: {
  prefijo: string; periodo: Periodo; onCambiar: (periodo: Periodo) => void; mostrarErrores: boolean; etiquetaHasta?: string; className?: string;
}) {
  const errores = mostrarErrores ? erroresPeriodo(periodo) : { desde: null, hasta: null };
  const hoy = hoyGuatemala();
  return <>
    <div className={className}>
      <TextInput id={`${prefijo}-desde`} type="date" label="Desde" required value={periodo.fechaInicio}
        max={periodo.fechaFin && periodo.fechaFin < hoy ? periodo.fechaFin : hoy} error={errores.desde ?? undefined}
        aria-invalid={errores.desde ? true : undefined}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => onCambiar({ ...periodo, fechaInicio: event.target.value })} />
    </div>
    <div className={className}>
      <TextInput id={`${prefijo}-hasta`} type="date" label={etiquetaHasta} required value={periodo.fechaFin}
        min={periodo.fechaInicio || undefined} max={hoy} error={errores.hasta ?? undefined}
        aria-invalid={errores.hasta ? true : undefined}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => onCambiar({ ...periodo, fechaFin: event.target.value })} />
    </div>
  </>;
}

/** Moneda desde el catálogo del ERP; si el catálogo no responde, se escribe el código. */
export function SelectorMoneda({ id, value, onChange, className = 'lg:col-span-2' }: {
  id: string; value: string; onChange: (moneda: string) => void; className?: string;
}) {
  const [opciones, setOpciones] = useState<{ codigo: string; nombre: string }[] | null>(null);
  const [fallo, setFallo] = useState(false);
  useEffect(() => {
    let vigente = true;
    catalogoMonedas().then(lista => { if (vigente) setOpciones(lista); }).catch(() => { if (vigente) setFallo(true); });
    return () => { vigente = false; };
  }, []);
  if (fallo) return <div className={className}>
    <TextInput id={id} label="Moneda" placeholder="Todas" maxLength={3} value={value} helperText="Código de 3 letras"
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value.toUpperCase())} />
  </div>;
  const lista = opciones ?? [];
  const conActual = value && !lista.some(item => item.codigo === value) ? [...lista, { codigo: value, nombre: value }] : lista;
  return <div className={className}>
    <Select id={id} label="Moneda" value={value} placeholder="" isReadOnly={opciones === null}
      options={[{ value: '', label: opciones === null ? 'Cargando…' : 'Todas' },
        ...conActual.map(item => ({ value: item.codigo, label: item.nombre && item.nombre !== item.codigo ? `${item.codigo} · ${item.nombre}` : item.codigo }))]}
      onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)} />
  </div>;
}
