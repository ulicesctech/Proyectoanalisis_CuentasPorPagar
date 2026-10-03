import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ban, ChevronLeft, ChevronRight, Eye, Pencil, RefreshCw, Search } from 'lucide-react';
import type { CxpFacturaEspecialDetalle, CxpFacturaEspecialResumen, PaginationMeta } from '@erp/contracts';
import { Modal } from '../../../../shared/components';
import { Button, DataTable, Select, TextInput } from '../../../../shared/ui-kit';
import { errorDe, facturasEspecialesApi, formatoFecha, formatoMonto } from '../api';
import { AccionDialog } from './AccionDialog';
import { ETAPAS, EtapaBadge } from './Etapa';
import { FacturaEspecialForm } from './FacturaEspecialForm';

// Mismo estilo que los botones de fila del resto de CXP (CxpCrudPage).
const ICONO = 'p-2 rounded-md disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent';
/** Etapas desde las que el flujo permite anular (en emitidas, el servidor exige que no haya pagos aplicados). */
const ANULABLE = ['PREPARACION', 'RECHAZADA', 'APROBADA', 'EMITIDA'];

export function useFacturasEspeciales(etapa: string, search: string, page: number) {
  const [data, setData] = useState<CxpFacturaEspecialResumen[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const refetch = useCallback(() => setRefresh(value => value + 1), []);
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    facturasEspecialesApi.list({ page, search, etapa: etapa || undefined })
      .then(result => { if (active) { setData(result.data); setMeta({ ...result.meta, totalPages: Math.max(1, result.meta.totalPages) }); setError(null); } })
      .catch(reason => { if (active) { setData([]); setError(errorDe(reason).mensaje); } })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [etapa, search, page, refresh]);
  return { data, meta, isLoading, error, refetch };
}

/**
 * Tabla de facturas especiales con las acciones estándar de CXP por fila (ver, editar,
 * anular) y enlaces debajo. `etapas` limita el filtro (p. ej. la bandeja de revisión)
 * y `acciones` agrega, debajo, los botones del flujo propios de esa pantalla.
 * Con `accionesEstandar={false}` se omiten los iconos y la fila abre el detalle.
 */
export function ListadoFacturas({ etapas, etapaInicial = '', acciones, accionesEstandar = true, recarga = 0 }: {
  etapas: string[]; etapaInicial?: string; recarga?: number; accionesEstandar?: boolean;
  acciones?: (factura: CxpFacturaEspecialResumen) => React.ReactNode;
}) {
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState(etapaInicial);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, meta, isLoading, error, refetch } = useFacturasEspeciales(etapa, search, page);
  const [editando, setEditando] = useState<CxpFacturaEspecialDetalle | null>(null);
  const [abriendo, setAbriendo] = useState(false);
  const [anulando, setAnulando] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const editar = async (id: number) => {
    setAbriendo(true); setAviso(null); setErrorAccion(null);
    try { setEditando(await facturasEspecialesApi.get(id)); }
    catch (reason) { setErrorAccion(errorDe(reason).mensaje); }
    finally { setAbriendo(false); }
  };
  const descargar = async (id: number) => {
    setErrorAccion(null);
    try { await facturasEspecialesApi.descargarConstancia(id); }
    catch (reason) { setErrorAccion(errorDe(reason).mensaje); }
  };
  useEffect(() => { const timer = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 250); return () => window.clearTimeout(timer); }, [searchInput]);
  useEffect(() => { if (recarga) refetch(); }, [recarga, refetch]);

  return <div className="space-y-4">
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-end gap-3">
      <TextInput id="fe-buscar" icon={Search} label="Buscar" placeholder="Número, proveedor, NIT, constancia o referencia…" value={searchInput}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearchInput(event.target.value)} className="flex-1 min-w-56" />
      <Select id="fe-etapa" label="Etapa" value={etapa} placeholder="" className="sm:max-w-64"
        options={etapas.map(value => ({ value, label: value === '' ? 'Todas' : value === 'BANDEJA' ? 'Revisión y aprobación' : ETAPAS[value as keyof typeof ETAPAS].label }))}
        onChange={(event: React.ChangeEvent<HTMLSelectElement>) => { setEtapa(event.target.value); setPage(1); }} />
      <Button icon={RefreshCw} variant="secondary" onClick={refetch} disabled={isLoading}>Actualizar</Button>
    </div>
    {(error || errorAccion) && <p role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{errorAccion || error}</p>}
    {aviso && !errorAccion && <p role="status" className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm rounded-lg p-3">{aviso}</p>}
    {abriendo && <p role="status" className="text-sm text-slate-500">Abriendo factura…</p>}
    <DataTable data={data} isLoading={isLoading}
      onRowClick={accionesEstandar ? undefined : (row: CxpFacturaEspecialResumen) => navigate(`/cxp/facturas-especiales/${row.idDocumento}`)} emptyText={error ? 'La información no está disponible.' : 'No hay facturas especiales para mostrar.'}
      columns={[
        { header: 'Factura', cell: ({ row }: { row: CxpFacturaEspecialResumen }) => <span className="font-semibold text-slate-900">{row.serie}-{row.numeroDocumento}</span> },
        { header: 'Proveedor', cell: ({ row }: { row: CxpFacturaEspecialResumen }) => <div className="max-w-64">
          <p className="truncate font-medium" title={row.proveedorNombre}>{row.proveedorNombre}</p>
          <p className="text-xs text-slate-500">{row.proveedorNit ? `NIT ${row.proveedorNit}` : `CUI ${row.proveedorCui}`}</p></div> },
        { header: 'Fecha', cell: ({ row }: { row: CxpFacturaEspecialResumen }) => formatoFecha(row.fechaDocumento) },
        { header: 'Monto operación', align: 'right', cell: ({ row }: { row: CxpFacturaEspecialResumen }) => formatoMonto(row.subtotal, row.moneda) },
        { header: 'Retenciones', align: 'right', cell: ({ row }: { row: CxpFacturaEspecialResumen }) => formatoMonto(row.retencionTotal, row.moneda) },
        { header: 'Total a pagar', align: 'right', cell: ({ row }: { row: CxpFacturaEspecialResumen }) => <span className="font-semibold">{formatoMonto(row.totalNeto, row.moneda)}</span> },
        { header: 'Etapa', cell: ({ row }: { row: CxpFacturaEspecialResumen }) => <div>
          <EtapaBadge etapa={row.etapa} />
          {row.numeroConstancia && <p className="text-xs text-slate-500 mt-1">{row.numeroConstancia}</p>}</div> },
        { header: 'Acciones', align: 'right', cell: ({ row }: { row: CxpFacturaEspecialResumen }) => {
          const numero = `${row.serie}-${row.numeroDocumento}`;
          const editable = row.etapa === 'PREPARACION' && row.estado === 'BORRADOR';
          const anulable = ANULABLE.includes(row.etapa);
          return <div className="flex flex-col items-end gap-2" onClick={event => event.stopPropagation()}>
            {accionesEstandar && <div className="flex gap-1">
              <button type="button" title="Ver factura" aria-label={`Ver factura ${numero}`} onClick={() => navigate(`/cxp/facturas-especiales/${row.idDocumento}`)}
                className={`${ICONO} text-slate-500 hover:bg-slate-100`}><Eye size={16} /></button>
              <button type="button" disabled={!editable || abriendo} title={editable ? 'Editar factura' : 'Solo se editan facturas en preparación'} aria-label={`Editar factura ${numero}`}
                onClick={() => editar(row.idDocumento)} className={`${ICONO} text-blue-600 hover:bg-blue-50`}><Pencil size={16} /></button>
              <button type="button" disabled={!anulable} title={anulable ? 'Anular factura' : 'No se puede anular en esta etapa'} aria-label={`Anular factura ${numero}`}
                onClick={() => { setAviso(null); setErrorAccion(null); setAnulando(row.idDocumento); }} className={`${ICONO} text-red-600 hover:bg-red-50`}><Ban size={16} /></button>
            </div>}
            {row.numeroConstancia && <button type="button" onClick={() => descargar(row.idDocumento)} className="text-xs text-blue-700 underline underline-offset-2">Constancia PDF</button>}
            {acciones && <div className="inline-flex flex-col items-stretch gap-1.5">{acciones(row)}</div>}
          </div>;
        } },
      ]} />
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
      <span>{meta.total} facturas · Página {page} de {meta.totalPages}</span>
      <div className="flex gap-2">
        <Button variant="secondary" icon={ChevronLeft} disabled={page <= 1 || isLoading} onClick={() => setPage(value => value - 1)}>Anterior</Button>
        <Button variant="secondary" icon={ChevronRight} disabled={page >= meta.totalPages || isLoading} onClick={() => setPage(value => value + 1)}>Siguiente</Button>
      </div>
    </div>
    <Modal isOpen={!!editando} onClose={() => setEditando(null)} size="lg" title={`Editar · ${editando?.serie}-${editando?.numeroDocumento}`}
      description="Los tributos se recalculan con las reglas vigentes en la fecha de la operación.">
      {editando && <FacturaEspecialForm factura={editando} onCancel={() => setEditando(null)}
        onSuccess={resultado => { setEditando(null); setAviso(`${resultado.factura.serie}-${resultado.factura.numeroDocumento}: ${resultado.mensaje}`); refetch(); }} />}
    </Modal>
    <AccionDialog idDocumento={anulando ?? 0} accion={anulando ? 'anular' : null} onClose={() => setAnulando(null)}
      onDone={resultado => { setAnulando(null); setAviso(`${resultado.factura.serie}-${resultado.factura.numeroDocumento}: ${resultado.mensaje}`); refetch(); }} />
  </div>;
}
