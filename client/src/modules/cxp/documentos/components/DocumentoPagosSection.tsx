import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CxpAplicacion, CxpDocumento, CxpDocumentoPagosContexto } from '@erp/contracts';
import { RefreshCw } from 'lucide-react';
import { apiClient } from '../../api';
import { CxpButton } from '../../components/CxpButton';
import { DocumentoPagoPanel } from './DocumentoPagoPanel';
import { formatDocumentoMoney, readableState } from '../documentoView';

const payable = new Set(['APROBADA','CONTABILIZADA','PENDIENTE_PAGO','PROGRAMADA_PAGO','PARCIALMENTE_PAGADA','PARCIALMENTE_APLICADA','VENCIDA']);
export function DocumentoPagosSection({ documento, onApplied }: { documento: CxpDocumento; onApplied: (application: CxpAplicacion) => void }) {
  const [context, setContext] = useState<CxpDocumentoPagosContexto | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const paid = Number(documento.saldoPendiente)<=0;
  useEffect(() => {
    let active = true; setContext(null); setError('');
    apiClient.get<CxpDocumentoPagosContexto>(`/cxp/documentos/${documento.idDocumento}/contexto-pagos`)
      .then(next => { if (active) setContext(next); }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'No se pudo consultar el contexto de pagos.'); });
    return () => { active = false; };
  }, [documento.idDocumento, documento.saldoPendiente, documento.estado, attempt]);
  return <section className="mt-4 border-t border-slate-100 pt-4 space-y-4" aria-label="Pagos del documento">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold text-slate-900">{paid?'Historial de pagos y procesos':'Pagos y procesos relacionados'}</h3>
      <CxpButton size="sm" variant="secondary" icon={RefreshCw} onClick={() => setAttempt(n => n + 1)}>Consultar pagos</CxpButton>
    </div>
    <p className="text-sm text-slate-600">{paid?'Consulta las aplicaciones registradas y el historial de sus procesos.':payable.has(documento.estado)?'Aplica un pago ordinario disponible o continúa en el proceso relacionado.':'Consulta los procesos vinculados a este documento.'}</p>
    <details className="text-xs text-slate-600"><summary className="cursor-pointer font-semibold">¿Qué pagos se aplican desde Documentos?</summary>
      <div className="mt-2 space-y-2"><p>Un pago ordinario conserva un saldo sin aplicar. Este panel admite el mismo proveedor y moneda, estados ejecutado o confirmado y sus estados de aplicación, siempre que queden fondos y el documento admita el pago.</p>
        <p>Una contraseña CP-* agrupa documentos y reserva sus importes al crearla. Se aplica al ejecutar el cheque o transferencia desde su proceso, con sus autorizaciones y responsables. Puede aparecer relacionada sin ser un pago libre para el selector.</p>
        <p>Confirmar o conciliar un proceso ya ejecutado conserva la aplicación existente; no descuenta el saldo otra vez.</p></div>
    </details>
    {!context && !error && <p role="status" className="text-sm text-slate-500">Consultando saldos y reservas…</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {context?.motivos.map(reason => <p key={reason} role="status" className="text-sm text-slate-600">{reason}</p>)}
    {context && context.reservadoDocumento > 0 && <p className="text-sm text-amber-800">Reservado en este documento: <strong>{formatDocumentoMoney(context.reservadoDocumento,documento.moneda)}</strong>.</p>}
    {context?.procesos.map(process => <div key={process.idPago} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2"><strong>{process.codigo} · {readableState(process.estado)}</strong>
        <Link className="font-semibold text-blue-700 hover:underline" to="/cxp/pagos" onClick={() => sessionStorage.setItem('cxp.openProcessId',String(process.idPago))}>Abrir proceso de pago</Link>
      </div>
      <p>Aplicado a este documento: {formatDocumentoMoney(process.aplicado,documento.moneda)} · Reserva pendiente: {formatDocumentoMoney(process.reservado,documento.moneda)}.</p>
      <p className="text-xs text-slate-500">Saldo sin aplicar del proceso: {formatDocumentoMoney(process.saldoSinAplicar,documento.moneda)}. Ese importe no es un pago libre para reutilizar en este panel.</p>
      {['APLICADO','CONCILIADO'].includes(process.estado) && <p className="text-xs text-slate-600">La aplicación ya está registrada. Abre el proceso para consultar su historial; no se vuelve a aplicar.</p>}
    </div>)}
    {payable.has(documento.estado) && !paid && context && context.ordinariosDisponibles>0 && context.reservadoDocumento===0 && <DocumentoPagoPanel documento={documento} onApplied={onApplied} />}
  </section>;
}
