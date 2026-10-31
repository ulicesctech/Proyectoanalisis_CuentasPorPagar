/** Pasos de captura: informan la posición del formulario, sin representar estados del servidor. */
export function CxpCaptureSteps({ steps, current, label }: { steps: readonly string[]; current: number; label: string }) {
  return <ol className="cxp-wizard-progress" aria-label={label}>
    {steps.map((title, index) => <li key={title} aria-label={title}
      aria-current={index === current ? 'step' : undefined} data-completed={index < current || undefined}>
      <span>{index + 1}</span> {title}
    </li>)}
  </ol>;
}

/** Marca informativa compartida por los indicadores de proceso de documentos y pagos. */
export function CxpStageMarker({ number, completed, current }: { number: number; completed: boolean; current: boolean }) {
  return <span className={[
    'grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 bg-white text-xs font-bold transition',
    completed ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
      : current ? 'border-blue-500 bg-blue-50 text-blue-700 ring-4 ring-blue-50' : 'border-slate-300 text-slate-500',
  ].join(' ')}>{number}</span>;
}
