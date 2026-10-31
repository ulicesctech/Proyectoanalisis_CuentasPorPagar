import { Link } from 'react-router-dom';
import { useOperador } from '../operador/operador';
import { nombreLegible, rolLegible } from '../operador/formato';
import { CXP_CICLO, inicioPorRol, type PasoCiclo } from './cxpHome.config';

function saludo(hora: number): string {
  if (hora >= 5 && hora < 12) return 'Buenos días';
  if (hora >= 12 && hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

const FECHA = new Intl.DateTimeFormat('es-GT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Encabezado del inicio: saludo con la identidad de la sesión, accesos de su rol y el ciclo de pago. */
export function ModuleHeader() {
  const { actor } = useOperador();
  const ahora = new Date();
  const inicio = inicioPorRol(actor?.nombreRol);
  const fecha = FECHA.format(ahora);
  const nombre = nombreLegible(actor?.nombre);
  return <section aria-labelledby="cxp-inicio-titulo"
    className="cxp-home-reveal relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div aria-hidden="true" className="cxp-home-hero-pattern pointer-events-none absolute inset-0" />
    <div className="relative px-6 pb-6 pt-6 sm:px-8 sm:pt-7">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Cuentas por Pagar</p>
        <time dateTime={ahora.toISOString().slice(0, 10)} className="text-xs font-medium text-slate-500 first-letter:uppercase">{fecha}</time>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 id="cxp-inicio-titulo" className="text-2xl font-semibold tracking-tight text-balance text-slate-900 sm:text-3xl">
          {saludo(ahora.getHours())}{nombre ? `, ${nombre}` : ''}
        </h1>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-100">
          {rolLegible(actor?.nombreRol)}
        </span>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">{inicio.resumen}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {inicio.acciones.map(({ label, path, icon: Icon }, indice) => <Link key={label} to={path}
          className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${indice === 0
            ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
            : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'}`}>
          <Icon size={16} aria-hidden="true" className="shrink-0" />{label}
        </Link>)}
      </div>
    </div>
    <CicloPago propios={inicio.pasos} />
  </section>;
}

function CicloPago({ propios }: { propios: PasoCiclo[] }) {
  return <nav aria-labelledby="cxp-ciclo-titulo" className="relative border-t border-slate-200 bg-slate-50/80 px-6 py-5 sm:px-8">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="cxp-ciclo-titulo" className="text-sm font-semibold text-slate-900">Ciclo de pago</h2>
      {propios.length > 0 && <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <span aria-hidden="true" className="size-2 rounded-full bg-blue-600" />Tu parte del ciclo
      </p>}
    </div>
    <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {CXP_CICLO.map(({ id, label, detail, path, icon: Icon }, indice) => {
        const propio = propios.includes(id);
        return <li key={id} className="cxp-ciclo-paso relative">
          <Link to={path} className={`group flex h-full items-center gap-2.5 rounded-xl border px-2.5 py-2.5 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${propio
            ? 'border-blue-200 bg-white shadow-sm'
            : 'border-transparent hover:border-slate-200 hover:bg-white'}`}>
            <span aria-hidden="true" className={`hidden size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 sm:flex ${propio
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-500 ring-1 ring-inset ring-slate-200 group-hover:text-blue-600'}`}>
              <Icon size={16} />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Paso {indice + 1}</span>
              <span className="block truncate text-sm font-semibold text-slate-900">{label}</span>
              <span className="block text-xs text-slate-500">{detail}</span>
              {propio && <span className="sr-only">(tu parte del ciclo)</span>}
            </span>
          </Link>
        </li>;
      })}
    </ol>
  </nav>;
}
