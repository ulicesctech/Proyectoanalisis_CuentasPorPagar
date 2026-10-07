import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Search } from 'lucide-react';
import { getCxpEntity, type CxpDocumento, type PaginatedResponse, type PaginationMeta } from '@erp/contracts';
import { apiClient, ApiError, buildQueryString } from '../../../shared/api';
import { Button, DataTable, Select, TextInput } from '../../../shared/ui-kit';
import { CxpLayout } from '../CxpLayout';
import { DocumentoCatalogPicker } from './components/DocumentoCatalogPicker';
import { DocumentoStatus, formatDocumentoDate, formatDocumentoMoney, readableState } from './documentoView';

type DocumentoListRow = CxpDocumento & { proveedorNombre?: string | null };

const estados = getCxpEntity('documentos')!.fields.find(field => field.name === 'estado')?.options ?? [];
const emptyMeta: PaginationMeta = { page: 1, limit: 10, total: 0, totalPages: 1 };

export function CxpDocumentoPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('');
  const [idProveedor, setIdProveedor] = useState('');
  const [venceHasta, setVenceHasta] = useState('');
  const [rows, setRows] = useState<DocumentoListRow[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const query = buildQueryString({ page, limit: 10, search, estado, idProveedor, venceHasta });
    apiClient.get<PaginatedResponse<DocumentoListRow>>(`/cxp/documentos${query}`)
      .then(result => {
        if (!active) return;
        setRows(result.data);
        setMeta({ ...result.meta, totalPages: Math.max(1, result.meta.totalPages) });
        if (page > result.meta.totalPages) setPage(Math.max(1, result.meta.totalPages));
      })
      .catch(reason => {
        if (!active) return;
        setRows([]);
        setError(reason instanceof ApiError ? reason.message : 'No se pudo cargar la lista de documentos.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, search, estado, idProveedor, venceHasta, refresh]);

  const resetFilters = () => {
    setSearchInput(''); setSearch(''); setEstado(''); setIdProveedor(''); setVenceHasta(''); setPage(1);
  };

  return <CxpLayout resource="documentos">
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Cuentas por pagar · Documentos</p>
          <h1 className="text-2xl font-bold text-slate-900">Documentos y saldos</h1>
          <p className="text-sm text-slate-500 mt-1">Consulta vencimientos y saldos, y continúa el trámite de cada documento.</p>
        </div>
        <Button icon={Plus} onClick={() => navigate('/cxp/documentos/nuevo')}>Nuevo documento</Button>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-4" aria-label="Filtros de documentos">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          <TextInput id="documento-search" icon={Search} label="Buscar documento" value={searchInput}
            placeholder="ID, serie, número o UUID"
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearchInput(event.target.value)} />
          <DocumentoCatalogPicker id="documento-proveedor" label="Proveedor" catalog="proveedores" value={idProveedor}
            placeholder="Buscar proveedor…" onChange={value => { setIdProveedor(value); setPage(1); }} />
          <Select id="documento-estado" label="Estado" value={estado} placeholder="" options={[
            { value: '', label: 'Todos los estados' },
            ...estados.map(value => ({ value, label: readableState(value) })),
          ]} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => { setEstado(event.target.value); setPage(1); }} />
          <TextInput id="documento-vence-hasta" label="Vence hasta" type="date" value={venceHasta}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => { setVenceHasta(event.target.value); setPage(1); }} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-500">{meta.total} documentos encontrados</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={resetFilters}>Limpiar filtros</Button>
            <Button variant="secondary" icon={RefreshCw} disabled={loading} onClick={() => setRefresh(value => value + 1)}>Actualizar</Button>
          </div>
        </div>
      </section>

      {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
        {error} <button type="button" className="underline font-semibold ml-2" onClick={() => setRefresh(value => value + 1)}>Reintentar</button>
      </div>}

      <DataTable className="cxp-documentos-table" data={rows} isLoading={loading} emptyText={error ? 'La lista no está disponible.' : 'No hay documentos para estos filtros.'}
        columns={[
          { header: 'Documento', cell: ({ row }: { row: DocumentoListRow }) => <div className="min-w-36">
            <p className="font-semibold text-slate-900">{[row.serie, row.numeroDocumento].filter(Boolean).join(' · ') || `Documento #${row.idDocumento}`}</p>
            <p className="text-xs text-slate-500">#{row.idDocumento} · {readableState(row.tipoDocumento)}</p>
          </div> },
          { header: 'Proveedor', cell: ({ row }: { row: DocumentoListRow }) =>
            row.idProveedor ? <span title={`Proveedor #${row.idProveedor}`}>{row.proveedorNombre || `Proveedor #${row.idProveedor}`}</span> : '—' },
          { header: 'Vencimiento', cell: ({ row }: { row: DocumentoListRow }) => formatDocumentoDate(row.fechaVencimiento) },
          { header: 'Importe', align: 'right', cell: ({ row }: { row: DocumentoListRow }) => <span className="font-medium">{formatDocumentoMoney(row.totalNeto, row.moneda)}</span> },
          { header: 'Saldo', align: 'right', cell: ({ row }: { row: DocumentoListRow }) => <span className="font-bold text-slate-900">{formatDocumentoMoney(row.saldoPendiente, row.moneda)}</span> },
          { header: 'Estado', cell: ({ row }: { row: DocumentoListRow }) => <DocumentoStatus estado={row.estado} /> },
          { header: '', align: 'right', cell: ({ row }: { row: DocumentoListRow }) =>
            <Link to={row.tipoDocumento === 'FACTURA_ESPECIAL'
              ? `/cxp/facturas-especiales/${row.idDocumento}` : `/cxp/documentos/${row.idDocumento}`}
              className="inline-flex items-center rounded-lg px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 whitespace-nowrap">
              {row.tipoDocumento === 'FACTURA_ESPECIAL' ? 'Ver factura especial' : 'Ver expediente'}
            </Link> },
        ]} />
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <span>{meta.total} documentos · Página {page} de {meta.totalPages}</span>
        <div className="flex gap-2">
          <Button variant="secondary" icon={ChevronLeft} disabled={page <= 1 || loading} onClick={() => setPage(current => current - 1)}>Anterior</Button>
          <Button variant="secondary" icon={ChevronRight} disabled={page >= meta.totalPages || loading} onClick={() => setPage(current => current + 1)}>Siguiente</Button>
        </div>
      </div>

    </div>
  </CxpLayout>;
}
