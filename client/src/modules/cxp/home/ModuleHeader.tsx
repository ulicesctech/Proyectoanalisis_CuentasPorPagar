import type { LucideIcon } from 'lucide-react';

export function ModuleHeader({ badge, icon: Icon, title, description }: {
  badge: string; icon: LucideIcon; title: string; description: string;
}) {
  return <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 sm:p-8">
    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
      <Icon size={14} aria-hidden="true" />{badge}
    </span>
    <h1 className="mt-4 text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{title}</h1>
    <p className="mt-2 max-w-3xl text-sm sm:text-base text-slate-500">{description}</p>
  </section>;
}
