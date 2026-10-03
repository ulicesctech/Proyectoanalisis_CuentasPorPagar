import { Ban, CheckCircle2, ClipboardCheck, FilePen, FileCheck2, Stamp } from 'lucide-react';
import type { CxpEtapaFacturaEspecial } from '@erp/contracts';

export const ETAPAS: Record<CxpEtapaFacturaEspecial, { label: string; className: string }> = {
  PREPARACION: { label: 'Preparación', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  REVISION: { label: 'En revisión', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  APROBACION: { label: 'Pendiente de aprobación', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  APROBADA: { label: 'Aprobada', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  EMITIDA: { label: 'Emitida', className: 'bg-emerald-600 text-white border-emerald-600' },
  RECHAZADA: { label: 'Rechazada', className: 'bg-red-50 text-red-700 border-red-200' },
  ANULADA: { label: 'Anulada', className: 'bg-red-600 text-white border-red-600' },
};

export function EtapaBadge({ etapa }: { etapa: CxpEtapaFacturaEspecial }) {
  const config = ETAPAS[etapa];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold border whitespace-nowrap ${config.className}`}>{config.label}</span>;
}

const PASOS = [
  { id: 'PREPARACION', label: 'Preparación', icon: FilePen },
  { id: 'REVISION', label: 'Revisión', icon: ClipboardCheck },
  { id: 'APROBACION', label: 'Aprobación', icon: CheckCircle2 },
  { id: 'EMITIDA', label: 'Emisión', icon: Stamp },
] as const;
const ORDEN: Record<CxpEtapaFacturaEspecial, number> = { PREPARACION: 0, RECHAZADA: 0, REVISION: 1, APROBACION: 2, APROBADA: 3, EMITIDA: 4, ANULADA: -1 };

/** PREPARACIÓN → REVISIÓN → APROBACIÓN → EMISIÓN, con la anulación como estado final. */
export function FlujoFactura({ etapa, emitida }: { etapa: CxpEtapaFacturaEspecial; emitida: boolean }) {
  const actual = etapa === 'ANULADA' ? (emitida ? 4 : 0) : ORDEN[etapa];
  return <div className="bg-white border border-slate-200 rounded-xl p-5">
    <ol className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {PASOS.map((paso, index) => {
        const completo = index < actual;
        const activo = index === actual && etapa !== 'ANULADA';
        const Icon = completo ? FileCheck2 : paso.icon;
        return <li key={paso.id} className="flex items-center gap-2.5">
          <span className={`w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0 ${completo ? 'bg-emerald-50 border-emerald-500 text-emerald-600'
            : activo ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-slate-400'}`}><Icon size={16} /></span>
          <span className={`text-xs font-semibold ${activo ? 'text-blue-700' : completo ? 'text-slate-800' : 'text-slate-500'}`}>{paso.label}</span>
        </li>;
      })}
      <li className="flex items-center gap-2.5">
        <span className={`w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0 ${etapa === 'ANULADA' ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-slate-200 text-slate-300'}`}><Ban size={16} /></span>
        <span className={`text-xs font-semibold ${etapa === 'ANULADA' ? 'text-red-700' : 'text-slate-400'}`}>Anulación</span>
      </li>
    </ol>
    {etapa === 'RECHAZADA' && <p className="text-xs text-red-700 mt-3">Rechazada: reábrela para corregirla y volver a enviarla a revisión.</p>}
  </div>;
}
