import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { CARD_COLORS, type ModuleCardConfig } from './cxpHome.config';

/** Tarjeta completa como enlace: enfocable con Tab y se abre con Enter. */
export function ModuleCard({ title, description, icon: Icon, color, linkText, tag, path }: ModuleCardConfig) {
  const styles = CARD_COLORS[color];
  return <Link to={path}
    className={`group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-150 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${styles.hover}`}>
    <div className="flex items-start gap-4">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 ${styles.icon}`}>
        <Icon size={22} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
    </div>
    <div className="mt-auto flex items-end justify-between gap-3 pt-5">
      <span className={`inline-flex items-center gap-1 text-sm font-semibold ${styles.link}`}>
        {linkText}<ChevronRight size={16} aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5" />
      </span>
      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{tag}</span>
    </div>
  </Link>;
}
