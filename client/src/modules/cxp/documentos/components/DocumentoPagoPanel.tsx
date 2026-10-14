import { useEffect, useState } from 'react';
import type { CxpAplicacion, CxpDocumento, CxpPago } from '@erp/contracts';
import { apiClient, ApiError, buildQueryString } from '../../../../shared/api';
import { Button } from '../../../../shared/ui-kit';
import { DocumentoCatalogPicker } from './DocumentoCatalogPicker';
import { formatDocumentoMoney, readableState } from '../documentoView';

type Props = {
  documento: CxpDocumento;
  onApplied: (application: CxpAplicacion) => void;
};

export function DocumentoPagoPanel({ documento, onApplied }: Props) {
  const [search, setSearch] = useState('');
  const [payments, setPayments] = useState<CxpPago[]>([]);
  const [paymentId, setPaymentId] = useState('');
  const [amount, setAmount] = useState('');
  const [actorId, setActorId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      apiClient.get<CxpPago[]>(`/cxp/documentos/${documento.idDocumento}/pagos-disponibles${buildQueryString({ search: search || undefined })}`)
        .then(result => { if (active) { setPayments(result); setError(null); } })
        .catch(reason => { if (active) { setPayments([]); setError(reason instanceof ApiError ? reason.message : 'No se pudieron consultar los pagos.'); } })
        .finally(() => { if (active) setLoading(false); });
    }, search ? 250 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [documento.idDocumento, documento.saldoPendiente, search]);

  const selected = payments.find(payment => String(payment.idPago) === paymentId);
  const available = Number(selected?.montoNoAplicado ?? 0);
  const balance = Number(documento.saldoPendiente);
  const value = Number(amount);
  const amountError = amount && (!Number.isFinite(value) || value <= 0 || !Number.isInteger(Math.round(value * 100)) ||
    Math.abs(value * 100 - Math.round(value * 100)) > 1e-7 || value > Math.min(balance, available))
    ? `Ingresa un monto mayor a cero, con dos decimales como máximo y no mayor a ${formatDocumentoMoney(Math.min(balance, available), documento.moneda)}.` : null;

  async function apply() {
    if (!selected || !actorId || !amount || amountError || busy) return;
    if (!window.confirm(`¿Aplicar ${formatDocumentoMoney(value, documento.moneda)} del pago ${selected.codigoPago} a este documento?`)) return;
    setBusy(true); setError(null);
    try {
      const application = await apiClient.post<CxpAplicacion>(`/cxp/documentos/${documento.idDocumento}/aplicaciones/pago`, {
        idPago: selected.idPago, monto: value, aplicadoPor: Number(actorId),
      });
      setPaymentId(''); setAmount('');
      onApplied(application);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'No se pudo aplicar el pago. Actualiza el expediente y vuelve a intentarlo.');
    } finally { setBusy(false); }
  }

  return <div className="border-t border-slate-100 mt-4 pt-4 space-y-4">
    <div>
      <h3 className="text-sm font-bold text-slate-900">Aplicar un pago existente</h3>
      <p className="text-sm text-slate-600 mt-1">Selecciona un pago ordinario ejecutado o confirmado del mismo proveedor y moneda. El importe se descontará al confirmar.</p>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-4">
      <div className="space-y-2">
        <label htmlFor="payment-search" className="block text-xs font-semibold text-slate-700">Buscar pago por código o número</label>
        <input id="payment-search" value={search} onChange={event => setSearch(event.target.value)}
          placeholder="Buscar pago…" className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none" />
        <label htmlFor="payment-select" className="block text-xs font-semibold text-slate-700">Pago disponible</label>
        <select id="payment-select" value={paymentId} onChange={event => { setPaymentId(event.target.value); setAmount(''); }}
          disabled={loading} className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none">
          <option value="">{loading ? 'Cargando pagos…' : 'Selecciona un pago'}</option>
          {payments.map(payment => <option key={payment.idPago} value={payment.idPago}>
            {payment.codigoPago} · {formatDocumentoMoney(payment.montoNoAplicado, payment.moneda)} disponible
          </option>)}
        </select>
        {!loading && !payments.length && <p className="text-xs text-amber-800">No hay pagos disponibles. Confirma con Tesorería que el pago esté ejecutado y tenga saldo.</p>}
        {selected && <p className="text-xs text-slate-600">{readableState(selected.estado)} · Obligación {formatDocumentoMoney(selected.montoObligacion, selected.moneda)} · Disponible {formatDocumentoMoney(selected.montoNoAplicado, selected.moneda)}</p>}
      </div>
      <div className="space-y-3">
        <DocumentoCatalogPicker id="payment-actor" label="Usuario que registra la aplicación" catalog="usuarios"
          value={actorId} onChange={setActorId} placeholder="Seleccionar usuario…" required />
        <div>
          <label htmlFor="payment-amount" className="block text-xs font-semibold text-slate-700 mb-1.5">Importe a aplicar</label>
          <input id="payment-amount" type="number" min="0.01" step="0.01" value={amount}
            onChange={event => setAmount(event.target.value)} disabled={!selected}
            aria-invalid={!!amountError} className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none" />
          {amountError && <p className="text-xs text-red-700 mt-1">{amountError}</p>}
        </div>
      </div>
    </div>
    {selected && amount && !amountError && <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
      Saldo al confirmar: <strong>{formatDocumentoMoney(balance - value, documento.moneda)}</strong>
    </p>}
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
    <Button disabled={!selected || !actorId || !amount || !!amountError || busy} onClick={apply}>
      {busy ? 'Aplicando pago…' : 'Confirmar aplicación'}
    </Button>
  </div>;
}
