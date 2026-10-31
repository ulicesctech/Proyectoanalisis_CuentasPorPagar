import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { AREA_COLORS, type AreaConfig } from './cxpHome.config';

/**
 * Tarjeta de un área: el título abre la pantalla principal y toda la tarjeta responde al clic;
 * los accesos de abajo abren directamente cada pantalla del área.
 */
export function ModuleCard({ area }: { area: AreaConfig }) {
  const { title, description, icon: Icon, color, path, links } = area;
  const styles = AREA_COLORS[color];
  return <article className={`cxp-home-lift group relative flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md ${styles.border}`}>
    <div className="flex items-start gap-4">
      <span aria-hidden="true" className={`flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition-colors duration-150 ${styles.icon}`}>
        <Icon size={21} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold text-slate-900">
          <Link to={path} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-blue-600">
            {title}
          </Link>
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>
      </div>
      <ArrowRight size={18} aria-hidden="true" className="mt-1 shrink-0 text-slate-300 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-slate-600" />
    </div>
    <div className="pointer-events-none relative z-10 mt-auto pt-5">
      <ul aria-label={`Pantallas de ${title}`} className="pointer-events-auto flex flex-wrap gap-1.5 border-t border-slate-100 pt-4">
        {links.map(link => <li key={link.path}>
          <Link to={link.path}
            className="inline-flex items-center rounded-md bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200 transition-colors duration-150 hover:bg-white hover:text-blue-700 hover:ring-blue-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
            {link.label}
          </Link>
        </li>)}
      </ul>
    </div>
  </article>;
}
