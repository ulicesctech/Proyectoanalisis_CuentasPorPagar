import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  FileCheck2,
  RefreshCw,
  Search,
} from 'lucide-react';
import type { CxpRecord } from '@erp/contracts';
import { Button, Select, TextInput } from '../../../shared/ui-kit';
import { apiClient, ApiError } from '../../../shared/api';
import { CxpLayout } from '../CxpLayout';
import { useCxpList } from '../hooks/useCxpList';

const states = ['PENDIENTE', 'APLICADA', 'REVERTIDA', 'CANCELADA'] as const;

const flow = [
  { label: 'Reservada', hint: 'Saldo aún no afectado', states: ['PENDIENTE'] },
  { label: 'Aplicada', hint: 'Saldo actualizado', states: ['APLICADA'] },
  { label: 'Reversa / cierre', hint: 'Revertida o cancelada', states: ['REVERTIDA', 'CANCELADA'] },
] as const;

type CatalogOption = {
  id: string | number;
  label: string;
};

function catalogBusinessLabel(label: string, prefix: 'Pago' | 'Documento') {
  const parts = label.split(' · ');
  if (parts.length > 1 && parts[0].startsWith(`${prefix} #`)) {
    return parts.slice(1).join(' · ');
  }
  return label;
}

function text(value: unknown) {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown) {
  return new Intl.NumberFormat('es-GT', {
    style: 'currency',
    currency: 'GTQ',
  }).format(number(value));
}

function dateTime(value: unknown) {
  const raw = text(value);
  if (raw === '—' || raw.length < 10) return '—';
  const date = `${raw.slice(8, 10)}/${raw.slice(5, 7)}/${raw.slice(0, 4)}`;
  return raw.length >= 16 ? `${date} ${raw.slice(11, 16)}` : date;
}

function stateBadge(value: unknown) {
  const current = text(value);
  if (current === 'APLICADA') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (['REVERTIDA', 'CANCELADA'].includes(current)) return 'border-red-200 bg-red-50 text-red-700';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

function nextStep(record: CxpRecord) {
  switch (String(record.estado ?? '')) {
    case 'PENDIENTE':
      return 'La aplicación está reservada; todavía no debe disminuir el saldo del documento.';
    case 'APLICADA':
      return 'Aplicación confirmada. El saldo del documento ya fue actualizado.';
    case 'REVERTIDA':
      return 'La aplicación fue revertida y conserva la trazabilidad del reverso.';
    case 'CANCELADA':
      return 'La aplicación fue cancelada sin afectar nuevamente el saldo.';
    default:
      return 'Consulta el origen, el documento destino y los importes aplicados.';
  }
}

export const CxpAplicacionPage = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<CxpRecord | null>(null);
  const [opening, setOpening] = useState(false);
  const [errorDetail, setErrorDetail] = useState('');
  const [paymentLabels, setPaymentLabels] = useState<Record<string, string>>({});
  const [documentLabels, setDocumentLabels] = useState<Record<string, string>>({});

  const { data, meta, isLoading, error, refetch } = useCxpList('aplicaciones', {
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

  useEffect(() => {
    let active = true;

    async function loadReferenceLabels() {
      const paymentIds = Array.from(
        new Set(
          data
            .map(row => Number(row.idPago))
            .filter(id => Number.isSafeInteger(id) && id > 0),
        ),
      );

      const documentIds = Array.from(
        new Set(
          data
            .flatMap(row => [
              Number(row.idDocumentoDestino),
              Number(row.idDocumentoOrigen),
            ])
            .filter(id => Number.isSafeInteger(id) && id > 0),
        ),
      );

      const [payments, documents] = await Promise.all([
        Promise.all(
          paymentIds.map(async id => {
            try {
              const options = await apiClient.get<CatalogOption[]>(
                `/cxp/catalogos/pagos?selected=${id}`,
              );
              const option = options.find(item => String(item.id) === String(id));
              return [
                String(id),
                option
                  ? catalogBusinessLabel(option.label, 'Pago')
                  : `Pago #${id}`,
              ] as const;
            } catch {
              return [String(id), `Pago #${id}`] as const;
            }
          }),
        ),
        Promise.all(
          documentIds.map(async id => {
            try {
              const options = await apiClient.get<CatalogOption[]>(
                `/cxp/catalogos/documentos?selected=${id}`,
              );
              const option = options.find(item => String(item.id) === String(id));
              return [
                String(id),
                option
                  ? catalogBusinessLabel(option.label, 'Documento')
                  : `Documento #${id}`,
              ] as const;
            } catch {
              return [String(id), `Documento #${id}`] as const;
            }
          }),
        ),
      ]);

      if (!active) return;

      setPaymentLabels(Object.fromEntries(payments));
      setDocumentLabels(Object.fromEntries(documents));
    }

    void loadReferenceLabels();

    return () => {
      active = false;
    };
  }, [data]);

  const visibleAmount = useMemo(
    () => data.reduce((total, row) => total + number(row.montoTotalAplicado), 0),
    [data],
  );

  const visiblePending = useMemo(
    () => data.filter(row => row.estado === 'PENDIENTE').length,
    [data],
  );

  const visibleApplied = useMemo(
    () => data.filter(row => row.estado === 'APLICADA').length,
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

  async function open(row: CxpRecord) {
    setOpening(true);
    setErrorDetail('');
    try {
      const detail = await apiClient.get<CxpRecord>(`/cxp/aplicaciones/${row.idAplicacion}`);
      setSelected(detail);
    } catch (reason) {
      setErrorDetail(reason instanceof ApiError ? reason.message : 'No se pudo abrir la aplicación.');
    } finally {
      setOpening(false);
    }
  }

  return (
    <CxpLayout resource="aplicaciones">
      <div className="space-y-5">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-600">Cuentas por pagar · Pagos</p>
          <h1 className="text-2xl font-bold text-slate-900">Bandeja de aplicaciones</h1>
          <p className="mt-1 text-sm text-slate-500">
            Trazabilidad de cómo cada pago afecta a sus documentos. Las aplicaciones se generan desde el flujo de pago, no como un CRUD independiente.
          </p>
        </div>

        <section className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aplicaciones encontradas</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{meta.total}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monto visible</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{money(visibleAmount)}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Pendientes visibles</p>
            <p className="mt-2 text-2xl font-bold text-amber-900">{visiblePending}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Aplicadas visibles</p>
            <p className="mt-2 text-2xl font-bold text-emerald-900">{visibleApplied}</p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">Ciclo de aplicación</h2>
              <p className="mt-1 text-xs text-slate-500">La reserva no disminuye saldo; el efecto definitivo ocurre al pasar a APLICADA.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">3 etapas</span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {flow.map((item, index) => {
              const active = stage === index;
              const passed = stage > index;
              return (
                <div key={item.label} className={`rounded-xl border p-4 ${active ? 'border-blue-300 bg-blue-50' : passed ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`grid h-9 w-9 place-items-center rounded-full text-sm font-semibold ${active ? 'bg-blue-600 text-white' : passed ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-500 ring-1 ring-slate-300'}`}>{index + 1}</div>
                    <div>
                      <p className="font-semibold text-slate-800">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.hint}</p>
                    </div>
                  </div>
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
                label="Buscar aplicación"
                placeholder="ID, pago o documento…"
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
                  <th className="p-3 text-left">Aplicación</th>
                  <th className="p-3 text-left">Pago</th>
                  <th className="p-3 text-left">Documento</th>
                  <th className="p-3 text-left">Tipo</th>
                  <th className="p-3 text-left">Importe aplicado</th>
                  <th className="p-3 text-left">Estado</th>
                  <th className="p-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {data.map(row => (
                  <tr key={String(row.idAplicacion)} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="p-3">
                      <p className="font-semibold text-blue-700">
                        {text(row.tipoAplicacion).replace(/_/g, ' ')}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Aplicación #{text(row.idAplicacion)}
                      </p>
                    </td>
                    <td className="p-3">
                      {row.idPago ? (
                        <>
                          <p className="font-medium text-slate-800">
                            {paymentLabels[String(row.idPago)] ?? `Pago #${text(row.idPago)}`}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            ID #{text(row.idPago)}
                          </p>
                        </>
                      ) : '—'}
                    </td>
                    <td className="p-3">
                      <p className="font-medium text-slate-800">
                        {documentLabels[String(row.idDocumentoDestino)] ??
                          `Documento #${text(row.idDocumentoDestino)}`}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        ID #{text(row.idDocumentoDestino)}
                      </p>
                    </td>
                    <td className="p-3">{text(row.tipoAplicacion).replace(/_/g, ' ')}</td>
                    <td className="p-3 font-medium">{money(row.montoTotalAplicado)}</td>
                    <td className="p-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${stateBadge(row.estado)}`}>{text(row.estado).replace(/_/g, ' ')}</span></td>
                    <td className="p-3 text-right"><Button icon={Eye} variant="secondary" size="sm" disabled={opening} onClick={() => void open(row)}>Gestionar</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!isLoading && data.length === 0 && (
            <div className="p-10 text-center">
              <FileCheck2 className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 font-medium text-slate-700">No hay aplicaciones para los filtros seleccionados.</p>
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
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Aplicación #{text(selected.idAplicacion)}</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {text(selected.tipoAplicacion).replace(/_/g, ' ')} · {text(selected.estado).replace(/_/g, ' ')}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{nextStep(selected)}</p>
              </div>
              <Button variant="secondary" onClick={() => setSelected(null)}>Cerrar</Button>
            </div>

            <div className="max-h-[75vh] space-y-5 overflow-y-auto p-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">Estado</p><span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${stateBadge(selected.estado)}`}>{text(selected.estado).replace(/_/g, ' ')}</span></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">Monto aplicado</p><p className="mt-2 font-semibold text-slate-900">{money(selected.montoTotalAplicado)}</p></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">Fecha aplicación</p><p className="mt-2 font-semibold text-slate-900">{dateTime(selected.fechaAplicacion)}</p></div>
              </div>

              <section className="rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900">Origen y destino</h3>
                <div className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                  <p>
                    <span className="text-slate-500">Pago:</span>{' '}
                    <strong>
                      {selected.idPago
                        ? paymentLabels[String(selected.idPago)] ?? `Pago #${text(selected.idPago)}`
                        : '—'}
                    </strong>
                  </p>
                  <p>
                    <span className="text-slate-500">Documento destino:</span>{' '}
                    <strong>
                      {documentLabels[String(selected.idDocumentoDestino)] ??
                        `Documento #${text(selected.idDocumentoDestino)}`}
                    </strong>
                  </p>
                  <p>
                    <span className="text-slate-500">Documento origen:</span>{' '}
                    <strong>
                      {selected.idDocumentoOrigen
                        ? documentLabels[String(selected.idDocumentoOrigen)] ??
                          `Documento #${text(selected.idDocumentoOrigen)}`
                        : '—'}
                    </strong>
                  </p>
                  <p><span className="text-slate-500">Documento CxC:</span> <strong>{selected.idDocumentoCxc ? `#${text(selected.idDocumentoCxc)}` : '—'}</strong></p>
                  <p><span className="text-slate-500">Aplicado por:</span> <strong>Usuario #{text(selected.aplicadoPor)}</strong></p>
                  <p><span className="text-slate-500">Estado CxC:</span> <strong>{text(selected.estadoCxc).replace(/_/g, ' ')}</strong></p>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900">Detalle de importes</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ['Principal', selected.montoPrincipal],
                    ['Descuento', selected.montoDescuento],
                    ['Retención', selected.montoRetencion],
                    ['Diferencia cambiaria', selected.diferenciaCambiaria],
                    ['Saldo anterior', selected.saldoAnterior],
                    ['Saldo posterior', selected.saldoPosterior],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="mt-1 font-semibold text-slate-900">{value === null || value === undefined ? '—' : money(value)}</p>
                    </div>
                  ))}
                </div>
              </section>

              {selected.estado === 'REVERTIDA' && (
                <section className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
                  <h3 className="font-semibold">Datos del reverso</h3>
                  <p className="mt-3">Revertido por: {selected.revertidoPor ? `Usuario #${text(selected.revertidoPor)}` : '—'}</p>
                  <p>Fecha: {dateTime(selected.fechaReverso)}</p>
                  <p className="mt-2">Motivo: {text(selected.motivoReverso)}</p>
                </section>
              )}

              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                {selected.idPago && (
                  <Button variant="secondary" onClick={() => openPayment(selected.idPago)}>Ver pago</Button>
                )}
                <Link to={`/cxp/documentos?registro=${selected.idDocumentoDestino}`}><Button>Ver documento</Button></Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </CxpLayout>
  );
};
