import type { BandejaProceso, ProcesoPago } from '@erp/contracts';
import { progresoFlujo, rutaEtapaFlujo } from './flujoPago';

type Props = {
  proceso: Pick<ProcesoPago, 'estado' | 'codigo'> | null;
  bandeja: BandejaProceso;
  counts?: number[];
  indiceNavegacion?: number | null;
  onNavigate?: (route: string) => void;
};

export function ProcesoPagoFlow({ proceso, bandeja, counts, indiceNavegacion, onNavigate }: Props) {
  return (
    <div className="overflow-x-auto pb-2">
      <ol className="cxp-flow-grid relative grid grid-cols-8 gap-0"
        aria-label={proceso ? `Avance de ${proceso.codigo}` : 'Bandejas del flujo de pago'}>
        {progresoFlujo(proceso, bandeja, indiceNavegacion).map((step, index) => {
          const completed = step.estado === 'completado';
          const content = <>
            <span className={[
              'grid h-9 w-9 place-items-center rounded-full border-2 bg-white text-xs font-bold transition',
              completed ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : step.actual ? 'border-blue-500 bg-blue-50 text-blue-700 ring-4 ring-blue-50'
                  : 'border-slate-300 text-slate-500',
            ].join(' ')}>{step.numero}</span>
            <strong className={[
              'mt-2 text-xs', completed ? 'text-emerald-700' : step.actual ? 'text-blue-700' : 'text-slate-700',
            ].join(' ')}>{step.label}</strong>
            <small className="mt-0.5 text-[11px] text-slate-400">{step.hint}</small>
            {completed && <span className="mt-1 text-[10px] font-semibold text-emerald-700">Completado</span>}
            {counts && <span className="mt-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {counts[index]} {index === 0 ? 'docs' : 'reg.'}
            </span>}
          </>;
          return <li key={step.label} data-step-state={step.estado}
            aria-current={step.actual ? 'step' : undefined}
            aria-label={`${step.numero}. ${step.label}: ${step.estado}`}>
            {onNavigate ? <button type="button" onClick={() => onNavigate(rutaEtapaFlujo(index))}
              className="cxp-flow-tile relative z-10 flex w-full flex-col items-center px-2 text-center">
              {content}
            </button> : <div className="cxp-flow-tile flex flex-col items-center px-2 text-center">{content}</div>}
          </li>;
        })}
      </ol>
    </div>
  );
}
