import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/** "Cuentas por Pagar › Grupo › Pantalla"; el primer tramo regresa a la página de inicio /cxp. */
export function CxpBreadcrumb({ group, current }: { group: string; current?: string }) {
  const trail = current && current !== group ? [group, current] : [group];
  return <nav aria-label="Ruta de navegación" className="mb-1">
    <ol className="flex flex-wrap items-center gap-1 text-xs font-semibold text-slate-500">
      <li><Link to="/cxp" className="text-blue-600 hover:text-blue-800 hover:underline underline-offset-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Cuentas por Pagar</Link></li>
      {trail.map((item, index) => <Fragment key={item}>
        <li aria-hidden="true"><ChevronRight size={14} className="text-slate-400" /></li>
        <li aria-current={index === trail.length - 1 ? 'page' : undefined}
          className={index === trail.length - 1 ? 'text-slate-700' : undefined}>{item}</li>
      </Fragment>)}
    </ol>
  </nav>;
}
