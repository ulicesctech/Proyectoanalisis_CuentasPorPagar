import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Layers3,
  RefreshCw,
  Search,
  WalletCards,
} from 'lucide-react';
import type { CxpRecord, PaginatedResponse } from '@erp/contracts';
import { Button, Select, TextInput } from '../../../shared/ui-kit';
import { apiClient, ApiError } from '../../../shared/api';
import { CxpLayout } from '../CxpLayout';
import { useCxpList } from '../hooks/useCxpList';

const states = [
  'BORRADOR',
  'PENDIENTE_APROBACION',
  'APROBADO',
  'ENVIADO',
  'EN_PROCESO',
  'EJECUTADO',
  'PARCIAL',
  'RECHAZADO',
  'ANULADO',
] as const;

const flow = [
  { label: 'Preparación', hint: 'Lote generado', states: ['BORRADOR'] },
  { label: 'Aprobación', hint: 'Validación del lote', states: ['PENDIENTE_APROBACION', 'APROBADO'] },
  { label: 'Envío', hint: 'Listo para ejecución', states: ['ENVIADO'] },
  { label: 'Proceso', hint: 'Pagos en curso', states: ['EN_PROCESO'] },
  { label: 'Ejecución', hint: 'Resultado del lote', states: ['EJECUTADO', 'PARCIAL'] },
  { label: 'Cierre', hint: 'Rechazado o anulado', states: ['RECHAZADO', 'ANULADO'] },
] as const;

function text(value: unknown) {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown, currency = 'GTQ') {
  return new Intl.NumberFormat('es-GT', {
    style: 'currency',
    currency,
  }).format(number(value));
}

function date(value: unknown) {
  const raw = text(value);
  if (raw === '—' || raw.length < 10) return '—';
  return `${raw.slice(8, 10)}/${raw.slice(5, 7)}/${raw.slice(0, 4)}`;
}

function stateBadge(value: unknown) {
  const current = text(value);
  if (['EJECUTADO', 'APROBADO'].includes(current)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (['RECHAZADO', 'ANULADO'].includes(current)) {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  if (['ENVIADO', 'EN_PROCESO'].includes(current)) {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

function nextStep(record: CxpRecord) {
  switch (String(record.estado ?? '')) {
    case 'BORRADOR':
      return 'Pendiente de completar y enviar a aprobación.';
    case 'PENDIENTE_APROBACION':
      return 'Esperando aprobación del lote.';
    case 'APROBADO':
      return 'Aprobado. Puede continuar a envío y ejecución.';
    case 'ENVIADO':
      return 'Enviado. Pendiente de ejecución de sus pagos.';
    case 'EN_PROCESO':
      return 'El lote tiene pagos en proceso.';
    case 'PARCIAL':
      return 'Algunos pagos terminaron y otros siguen pendientes.';
    case 'EJECUTADO':
      return 'Lote ejecutado. Consulta los pagos asociados para detalle.';
    case 'RECHAZADO':
      return 'Lote rechazado. Se conserva su historial.';
    case 'ANULADO':
      return 'Lote anulado. Se conserva su historial.';
    default:
      return 'Consulta el estado y los pagos asociados.';
  }
}

export const CxpLotePagoPage = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<CxpRecord | null>(null);
  const [opening, setOpening] = useState(false);
  const [errorDetail, setErrorDetail] = useState('');
  const [associatedPayments, setAssociatedPayments] = useState<CxpRecord[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentsError, setPaymentsError] = useState('');
  const [showPayments, setShowPayments] = useState(false);

  const { data, meta, isLoading, error, refetch } = useCxpList('lotes-pago', {
    page,
    search,
    filterField: status ? 'estado' : '',
    filterValue: status,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [status]);

  const visibleAmount = useMemo(
    () => data.reduce((total, row) => total + number(row.montoTotal), 0),
    [data],
  );

  const visiblePayments = useMemo(
    () => data.reduce((total, row) => total + number(row.cantidadPagos), 0),
    [data],
  );

  const stage = status
    ? flow.findIndex(item => (item.states as readonly string[]).includes(status))
    : -1;

  function openPayment(id: unknown) {
    const paymentId = Number(id);
    if (!Number.isSafeInteger(paymentId) || paymentId < 1) return;

    sessionStorage.setItem('cxp.openProcessId', String(paymentId));
    setSelected(null);
    navigate('/cxp/pagos');
  }

  async function loadAssociatedPayments() {
    if (!selected?.idLote) return;

    setShowPayments(true);
    setLoadingPayments(true);
    setPaymentsError('');

    try {
      const result = await apiClient.get<PaginatedResponse<CxpRecord>>(
        `/cxp/pagos?page=1&limit=100&filterField=idLote&filterValue=${encodeURIComponent(String(selected.idLote))}`,
      );
      setAssociatedPayments(result.data);
    } catch (reason) {
      setAssociatedPayments([]);
      setPaymentsError(reason instanceof ApiError ? reason.message : 'No se pudieron cargar los pagos asociados.');
    } finally {
      setLoadingPayments(false);
    }
  }

  async function open(row: CxpRecord) {
    setOpening(true);
    setErrorDetail('');
    try {
      const detail = await apiClient.get<CxpRecord>(`/cxp/lotes-pago/${row.idLote}`);
      setAssociatedPayments([]);
      setPaymentsError('');
      setShowPayments(false);
      setSelected(detail);
    } catch (reason) {
      setErrorDetail(reason instanceof ApiError ? reason.message : 'No se pudo abrir el lote.');
    } finally {
      setOpening(false);
    }
  }

  return (
    <CxpLayout resource="lotes-pago">
      <div className="space-y-5">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-600">Cuentas por pagar · Pagos</p>
          <h1 className="text-2xl font-bold text-slate-900">Bandeja de lotes de pago</h1>
          <p className="mt-1 text-sm text-slate-500">
            Seguimiento operativo de los lotes generados por el flujo de pagos. Aquí no se editan registros manualmente.
          </p>
        </div>

        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lotes encontrados</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{meta.total}</p>
            <p className="mt-1 text-xs text-slate-500">Según búsqueda y estado seleccionado.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monto visible</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{money(visibleAmount)}</p>
            <p className="mt-1 text-xs text-slate-500">Suma de los lotes mostrados en esta página.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pagos agrupados</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{visiblePayments}</p>
            <p className="mt-1 text-xs text-slate-500">Pagos contenidos en los lotes visibles.</p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">Flujo del lote</h2>
              <p className="mt-1 text-xs text-slate-500">El lote acompaña al pago; no sustituye el flujo de autorización y ejecución.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">6 etapas</span>
          </div>
          <div className="grid gap-3 md:grid-cols-6">
            {flow.map((item, index) => {
              const active = stage === index;
              const passed = stage > index;
              return (
                <div key={item.label} className="relative text-center">
                  <div className={`mx-auto grid h-9 w-9 place-items-center rounded-full border text-sm font-semibold ${active ? 'border-blue-600 bg-blue-600 text-white' : passed ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-500'}`}>
                    {index + 1}
                  </div>
                  <p className={`mt-2 text-xs font-semibold ${active ? 'text-blue-700' : 'text-slate-700'}`}>{item.label}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{item.hint}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <TextInput
                icon={Search}
                label="Buscar lote"
                placeholder="Código, ID o descripción…"
                value={searchInput}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearchInput(event.target.value)}
                className="min-w-64 flex-1"
              />
              <Select
                label="Estado"
                value={status}
                className="min-w-56"
                options={[
                  { value: '', label: 'Todos los estados' },
                  ...states.map(value => ({ value, label: value.replace(/_/g, ' ') })),
                ]}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setStatus(event.target.value)}
              />
              <Button icon={RefreshCw} variant="secondary" disabled={isLoading} onClick={refetch}>Actualizar</Button>
            </div>
          </div>

          {(error || errorDetail) && (
            <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorDetail || error}</div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="p-3 text-left">Lote</th>
                  <th className="p-3 text-left">Ejecución</th>
                  <th className="p-3 text-left">Pagos</th>
                  <th className="p-3 text-left">Importe</th>
                  <th className="p-3 text-left">Estado</th>
                  <th className="p-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {data.map(row => (
                  <tr key={String(row.idLote)} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="p-3">
                      <p className="font-semibold text-blue-700">{text(row.codigoLote)}</p>
                      <p className="text-xs text-slate-400">ID #{text(row.idLote)}</p>
                    </td>
                    <td className="p-3">{date(row.fechaEjecucion)}</td>
                    <td className="p-3">{text(row.cantidadPagos)}</td>
                    <td className="p-3 font-medium">{money(row.montoTotal, text(row.moneda) === '—' ? 'GTQ' : text(row.moneda))}</td>
                    <td className="p-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${stateBadge(row.estado)}`}>{text(row.estado).replace(/_/g, ' ')}</span></td>
                    <td className="p-3 text-right">
                      <Button icon={Eye} variant="secondary" size="sm" disabled={opening} onClick={() => void open(row)}>Gestionar</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!isLoading && data.length === 0 && (
            <div className="p-10 text-center">
              <Layers3 className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 font-medium text-slate-700">No hay lotes para los filtros seleccionados.</p>
              <p className="mt-1 text-sm text-slate-400">Prueba cambiando la búsqueda o el estado.</p>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-200 p-3">
            <span className="text-xs text-slate-500">Página {meta.page} de {meta.totalPages} · {meta.total} registros</span>
            <div className="flex gap-2">
              <Button icon={ChevronLeft} variant="secondary" size="sm" disabled={page <= 1 || isLoading} onClick={() => setPage(value => Math.max(1, value - 1))}>Anterior</Button>
              <Button icon={ChevronRight} iconPosition="right" variant="secondary" size="sm" disabled={page >= meta.totalPages || isLoading} onClick={() => setPage(value => value + 1)}>Siguiente</Button>
            </div>
          </div>
        </section>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" onMouseDown={() => setSelected(null)}>
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onMouseDown={event => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-blue-100 bg-blue-50 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Lote de pago</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">{text(selected.codigoLote)}</h2>
                <p className="mt-1 text-sm text-slate-500">{nextStep(selected)}</p>
              </div>
              <Button variant="secondary" onClick={() => setSelected(null)}>Cerrar</Button>
            </div>

            <div className="max-h-[75vh] space-y-5 overflow-y-auto p-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">Estado</p><span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${stateBadge(selected.estado)}`}>{text(selected.estado).replace(/_/g, ' ')}</span></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">Fecha ejecución</p><p className="mt-2 font-semibold text-slate-900">{date(selected.fechaEjecucion)}</p></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">Pagos</p><p className="mt-2 font-semibold text-slate-900">{text(selected.cantidadPagos)}</p></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">Monto total</p><p className="mt-2 font-semibold text-slate-900">{money(selected.montoTotal, text(selected.moneda) === '—' ? 'GTQ' : text(selected.moneda))}</p></div>
              </div>

              <section className="rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900">Datos operativos</h3>
                <div className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                  <p><span className="text-slate-500">Tipo:</span> <strong>{text(selected.tipoLote).replace(/_/g, ' ')}</strong></p>
                  <p><span className="text-slate-500">Moneda:</span> <strong>{text(selected.moneda)}</strong></p>
                  <p><span className="text-slate-500">Sucursal:</span> <strong>#{text(selected.idSucursal)}</strong></p>
                  <p><span className="text-slate-500">Cuenta origen:</span> <strong>#{text(selected.idCuentaOrigen)}</strong></p>
                  <p><span className="text-slate-500">Creado por:</span> <strong>Usuario #{text(selected.creadoPor)}</strong></p>
                  <p><span className="text-slate-500">Fecha creación:</span> <strong>{date(selected.fechaCreacion)}</strong></p>
                  <p><span className="text-slate-500">Enviado por:</span> <strong>{selected.enviadoPor ? `Usuario #${text(selected.enviadoPor)}` : '—'}</strong></p>
                  <p><span className="text-slate-500">Fecha envío:</span> <strong>{date(selected.fechaEnvio)}</strong></p>
                </div>
              </section>

              {showPayments && (
                <section className="rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">Pagos asociados</h3>
                      <p className="mt-1 text-xs text-slate-500">Pagos que pertenecen a este lote. Abrir flujo lleva a la bandeja operativa correcta.</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{associatedPayments.length} pagos</span>
                  </div>

                  {loadingPayments && (
                    <p className="mt-4 text-sm text-slate-500">Cargando pagos asociados…</p>
                  )}

                  {paymentsError && (
                    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{paymentsError}</div>
                  )}

                  {!loadingPayments && !paymentsError && associatedPayments.length === 0 && (
                    <p className="mt-4 text-sm text-slate-500">Este lote no tiene pagos asociados actualmente.</p>
                  )}

                  {!loadingPayments && associatedPayments.length > 0 && (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="p-3 text-left">Pago</th>
                            <th className="p-3 text-left">Proveedor</th>
                            <th className="p-3 text-left">Fecha</th>
                            <th className="p-3 text-left">Importe</th>
                            <th className="p-3 text-left">Estado</th>
                            <th className="p-3 text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {associatedPayments.map(payment => (
                            <tr key={String(payment.idPago)} className="border-t border-slate-100">
                              <td className="p-3 font-semibold text-blue-700">{text(payment.codigoPago || payment.idPago)}</td>
                              <td className="p-3">#{text(payment.idProveedor)}</td>
                              <td className="p-3">{date(payment.fechaProgramada)}</td>
                              <td className="p-3 font-medium">{money(payment.montoObligacion, text(payment.moneda) === '—' ? 'GTQ' : text(payment.moneda))}</td>
                              <td className="p-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${stateBadge(payment.estado)}`}>{text(payment.estado).replace(/_/g, ' ')}</span></td>
                              <td className="p-3 text-right"><Button size="sm" onClick={() => openPayment(payment.idPago)}>Abrir flujo</Button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}

              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                <Button icon={WalletCards} onClick={() => void loadAssociatedPayments()}>
                  {showPayments ? 'Actualizar pagos asociados' : 'Ver pagos asociados'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </CxpLayout>
  );
};
