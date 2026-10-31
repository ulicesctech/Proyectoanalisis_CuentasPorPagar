import { CxpStageMarker } from '../components/CxpSteps';
import { documentoProgress } from './documentoFlujo';

const specialStates = new Set([
  'CON_DIFERENCIAS', 'BLOQUEADA', 'VENCIDA', 'ANULADA',
  'RECHAZADA', 'DUPLICADO', 'EN_DISPUTA',
]);

export const isSpecialDocumentoState = (estado: string) => specialStates.has(estado);

export const readableState = (value: string | null | undefined) =>
  value ? value.replace(/_/g, ' ') : 'Sin estado';

export function DocumentoStatus({ estado }: { estado: string }) {
  const tone = ['APROBADA', 'PAGADA', 'APLICADA', 'CERRADA'].includes(estado) ? 'APROBADA'
    : ['BLOQUEADA', 'ANULADA', 'RECHAZADA', 'DUPLICADO', 'EN_DISPUTA'].includes(estado) ? 'RECHAZADA'
      : ['PROGRAMADA_PAGO', 'PARCIALMENTE_PAGADA', 'PARCIALMENTE_APLICADA'].includes(estado) ? 'PROGRAMADA' : 'EN_REVISION';
  return <span className={`cxp-workspace-status cxp-workspace-status--${tone}`}>{readableState(estado)}</span>;
}

export function formatDocumentoMoney(value: unknown, currency = 'GTQ') {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `${currency} ${new Intl.NumberFormat('es-GT', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(number)}`;
}

export function formatDocumentoDate(value: unknown) {
  if (!value) return '—';
  const text = String(value);
  return `${text.slice(8, 10)}/${text.slice(5, 7)}/${text.slice(0, 4)}`;
}

export function DocumentoFlow({ estado }: { estado: string }) {
  const special = isSpecialDocumentoState(estado);
  const progress = documentoProgress(estado);
  return <section className="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3" aria-label="Flujo principal del documento">
    <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Etapas del documento</h2>
    <ol className="grid grid-cols-2 sm:grid-cols-4 gap-5 py-3" aria-label="Avance del documento">
      {progress.steps.map(({ title, hint, completed, active }, index) => {
        return <li key={title} aria-current={active ? 'step' : undefined}
          data-step-state={completed ? 'completado' : active ? 'actual' : 'pendiente'}
          className="flex flex-col items-center text-center px-2">
          <CxpStageMarker number={index + 1} completed={completed} current={active} />
          <strong className={`mt-2 text-xs ${active ? 'text-blue-700' : completed ? 'text-emerald-700' : 'text-slate-700'}`}>{title}</strong>
          <small className="mt-1 text-[11px] text-slate-500">{hint}</small>
          <span className={`mt-1 text-[10px] font-semibold ${completed ? 'text-emerald-700' : 'text-slate-500'}`}>{completed ? 'Completado' : active ? 'Actual' : 'Pendiente'}</span>
        </li>;
      })}
    </ol>
    {special && <p role="status" className={`mt-3 text-xs rounded-lg border px-3 py-2 ${['RECHAZADA', 'ANULADA'].includes(estado) ? 'text-red-800 bg-red-50 border-red-200' : 'text-amber-800 bg-amber-50 border-amber-200'}`}>
      {estado === 'VENCIDA' ? 'Atención: el documento está vencido. Revisa el saldo y coordina su gestión.'
        : ['RECHAZADA', 'ANULADA'].includes(estado) ? `${readableState(estado)}: trámite interrumpido; no representa un avance exitoso.`
        : `${readableState(estado)} requiere atención fuera de estas etapas.`}
    </p>}
    {!special && progress.current === null && <p className="mt-3 text-xs text-slate-600">Consulta el estado actual y el siguiente paso.</p>}
  </section>;
}
