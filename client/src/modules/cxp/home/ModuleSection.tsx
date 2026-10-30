import type { CSSProperties, ReactNode } from 'react';

/** Bloque del inicio con título y descripción; el contenido lo define quien lo usa. */
export function ModuleSection({ id, title, subtitle, orden, children }: {
  id: string; title: string; subtitle: string; orden: number; children: ReactNode;
}) {
  const headingId = `cxp-home-${id}`;
  return <section aria-labelledby={headingId} className="cxp-home-reveal space-y-4" style={{ '--i': orden } as CSSProperties}>
    <div>
      <h2 id={headingId} className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-500">{subtitle}</p>
    </div>
    {children}
  </section>;
}
