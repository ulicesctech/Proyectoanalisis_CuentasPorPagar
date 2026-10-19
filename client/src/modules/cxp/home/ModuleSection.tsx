import { ModuleCard } from './ModuleCard';
import type { ModuleSectionConfig } from './cxpHome.config';

export function ModuleSection({ id, title, subtitle, icon: Icon, countLabel, cards }: ModuleSectionConfig) {
  const headingId = `cxp-home-${id}`;
  return <section aria-labelledby={headingId} className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-600/30">
          <Icon size={20} aria-hidden="true" />
        </span>
        <div>
          <h2 id={headingId} className="text-lg font-bold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
        {cards.length} {cards.length === 1 ? countLabel[0] : countLabel[1]}
      </span>
    </div>
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cards.map(card => <li key={card.path}><ModuleCard {...card} /></li>)}
    </ul>
  </section>;
}
