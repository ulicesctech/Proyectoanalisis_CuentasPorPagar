import { StatusBadge } from '../../../shared/ui-kit';

const specialStates = new Set([
  'CON_DIFERENCIAS', 'BLOQUEADA', 'VENCIDA', 'ANULADA',
  'RECHAZADA', 'DUPLICADO', 'EN_DISPUTA',
]);

const paymentStates = new Set([
  'CONTABILIZADA', 'PENDIENTE_PAGO', 'PROGRAMADA_PAGO',
  'PARCIALMENTE_PAGADA', 'PARCIALMENTE_APLICADA', 'PAGADA', 'APLICADA', 'CERRADA',
]);

const finalStates = new Set(['PAGADA', 'APLICADA', 'CERRADA']);

export const isSpecialDocumentoState = (estado: string) => specialStates.has(estado);

export const readableState = (value: string | null | undefined) =>
  value ? value.replace(/_/g, ' ') : 'Sin estado';

export function DocumentoStatus({ estado }: { estado: string }) {
  const tone = ['APROBADA', 'PAGADA', 'APLICADA', 'CERRADA'].includes(estado) ? 'aprobada'
    : ['BLOQUEADA', 'ANULADA', 'RECHAZADA', 'DUPLICADO', 'EN_DISPUTA'].includes(estado) ? 'rechazada'
      : estado === 'RECIBIDO' ? 'revision' : 'pendiente';
  return <StatusBadge status={tone} label={readableState(estado)} size="sm" />;
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

const steps = ['Recibido', 'Pendiente de aprobación', 'Aprobada', 'Pago o aplicación'];

export function DocumentoFlow({ estado }: { estado: string }) {
  const special = isSpecialDocumentoState(estado);
  const current = estado === 'RECIBIDO' ? 0 : estado === 'PENDIENTE_APROBACION' ? 1
    : estado === 'APROBADA' ? 2 : paymentStates.has(estado) ? 3 : -1;
  return <section className="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3" aria-label="Flujo principal del documento">
    <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Etapas del documento</h2>
    <ol className="grid grid-cols-1 sm:grid-cols-4 gap-2">
      {steps.map((title, index) => {
        const completed = !special && (current > index || index === 3 && finalStates.has(estado));
        const active = !special && current === index && !finalStates.has(estado);
        return <li key={title} aria-current={active ? 'step' : undefined}
          className={`rounded-lg border px-3 py-2 flex items-center gap-2.5 ${active ? 'border-blue-300 bg-blue-50' : completed ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
          <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${active ? 'bg-blue-600 text-white' : completed ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-300 text-slate-500'}`}>{index + 1}</span>
          <span className={`text-xs font-semibold ${active ? 'text-blue-800' : completed ? 'text-emerald-800' : 'text-slate-600'}`}>{title}</span>
        </li>;
      })}
    </ol>
    {special && <p className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
      {estado === 'VENCIDA' ? 'Atención: el documento está vencido. Revisa el saldo y coordina su gestión.'
        : `${readableState(estado)} requiere atención fuera de estas etapas.`}
    </p>}
    {!special && current < 0 && <p className="mt-3 text-xs text-slate-600">Consulta el estado actual y el siguiente paso.</p>}
  </section>;
}
