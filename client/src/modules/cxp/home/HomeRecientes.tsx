import { Link } from 'react-router-dom';
import { ArrowRight, History } from 'lucide-react';
import { buscarPantalla } from '../navegacion/pantallas';
import { tiempoRelativo, useRecientes } from '../navegacion/recientes';
import { useOperador } from '../operador/operador';

/** Últimas pantallas abiertas por este usuario en este navegador; no se muestra si no hay ninguna. */
export function HomeRecientes() {
  const { actorId } = useOperador();
  const visitas = useRecientes(actorId);
  const items = visitas
    .map(visita => ({ ...visita, pantalla: buscarPantalla(visita.path) }))
    .filter(item => item.pantalla)
    .slice(0, 4);
  if (!items.length) return null;
  return <section aria-labelledby="cxp-recientes-titulo" className="cxp-home-reveal" style={{ '--i': 2 } as React.CSSProperties}>
    <h2 id="cxp-recientes-titulo" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
      <History size={16} aria-hidden="true" className="text-slate-400" />Continuar donde lo dejaste
    </h2>
    <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ path, at, pantalla }) => {
        const Icon = pantalla!.icon;
        return <li key={path}>
          <Link to={path}
            className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition-colors duration-150 hover:border-blue-200 hover:bg-blue-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
            <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors duration-150 group-hover:bg-blue-600 group-hover:text-white">
              <Icon size={17} />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium text-slate-900">{pantalla!.title}</span>
              <span className="block truncate text-xs text-slate-500">{pantalla!.group} · {tiempoRelativo(at)}</span>
            </span>
            <ArrowRight size={15} aria-hidden="true" className="shrink-0 text-slate-300 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-blue-600" />
          </Link>
        </li>;
      })}
    </ul>
  </section>;
}
