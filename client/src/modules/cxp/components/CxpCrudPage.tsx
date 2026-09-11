import { useEffect, useState, type ComponentType } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Eye, Pencil, Plus, RefreshCw, Search, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { getCxpEntity, type CxpRecord, type CxpResource, type CxpFieldDefinition } from '@erp/contracts';
import { Button, DataTable, Select, TextInput } from '../../../shared/ui-kit';
import { Modal } from '../../../shared/components';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { apiClient, ApiError } from '../../../shared/api';
import { CxpLayout } from '../CxpLayout';
import { useCxpList } from '../hooks/useCxpList';
import { RelationSelect, clearCxpCatalogCache } from './RelationSelect';
import type { CxpFormProps } from './CxpEntityForm';

const badges = (value: string) => ['ACTIVA', 'ACTIVO', 'S', 'APROBADA', 'APROBADO', 'PAGADA', 'APLICADA', 'CONFIRMADO', 'CONCILIADA'].includes(value)
  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
  : ['ANULADA', 'ANULADO', 'RECHAZADA', 'RECHAZADO', 'BLOQUEADA', 'REVERTIDA', 'N'].includes(value)
    ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-800 border-amber-200';

function display(field: CxpFieldDefinition, value: CxpRecord[string]) {
  if (value === null || value === undefined || value === '') return <span className="text-slate-400">—</span>;
  if (field.name.startsWith('estado') || ['activo', 'activa', 'prioridad', 'esVersionActual'].includes(field.name)) {
    return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold border whitespace-nowrap ${badges(String(value))}`}>{value === 'S' ? 'Sí' : value === 'N' ? 'No' : String(value).replace(/_/g, ' ')}</span>;
  }
  if (field.type === 'number' && !field.lookup && !field.integer) return new Intl.NumberFormat('es-GT', { minimumFractionDigits: field.scale === 2 ? 2 : 0, maximumFractionDigits: field.scale ?? 6 }).format(Number(value));
  if (field.type === 'date' || field.type === 'datetime') {
    const text = String(value);
    return <span className="whitespace-nowrap">{`${text.slice(8, 10)}/${text.slice(5, 7)}/${text.slice(0, 4)}${field.type === 'datetime' ? ` ${text.slice(11, 16)}` : ''}`}</span>;
  }
  return <span className="block max-w-64 truncate" title={String(value)}>{field.lookup && field.type === 'number' ? `#${value}` : String(value)}</span>;
}

export function CxpCrudPage({ resource, Form }: { resource: CxpResource; Form: ComponentType<CxpFormProps> }) {
  const entity = getCxpEntity(resource)!;
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ mode: 'create' | 'edit' | 'view'; record?: CxpRecord } | null>(null);
  const [deleting, setDeleting] = useState<CxpRecord | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const filterField = params.get('filterField') ?? '';
  const filterValue = params.get('filterValue') ?? '';
  const filterDefinition = entity.fields.find(field => field.name === filterField);
  const { data, meta, isLoading, error, refetch } = useCxpList(resource, { page, search, filterField, filterValue });
  useEffect(() => { const timer = window.setTimeout(() => { setSearch(searchInput); setPage(1); }, 250); return () => window.clearTimeout(timer); }, [searchInput]);
  useEffect(() => { if (!isLoading && !error && page > meta.totalPages) setPage(meta.totalPages); }, [isLoading, error, page, meta.totalPages]);
  useEffect(() => {
    const id = params.get('registro');
    if (!id) return;
    let active = true;
    apiClient.get<CxpRecord>(`/cxp/${resource}/${id}`).then(record => { if (active) setModal({ mode: 'view', record }); })
      .catch(reason => { if (active) setActionError(reason instanceof ApiError ? reason.message : 'No se pudo abrir el registro'); });
    return () => { active = false; };
  }, [resource, params.get('registro')]);

  const updateFilter = (field: string, value: string) => {
    const next = new URLSearchParams();
    if (field) next.set('filterField', field);
    if (value) next.set('filterValue', value);
    setParams(next);
    setPage(1);
  };
  const open = async (row: CxpRecord, mode: 'edit' | 'view') => {
    setLoadingRecord(true);
    setActionError(null);
    try { setModal({ mode, record: await apiClient.get<CxpRecord>(`/cxp/${resource}/${row[entity.idField]}`) }); }
    catch (reason) { setActionError(reason instanceof ApiError ? reason.message : 'No se pudo abrir el registro'); }
    finally { setLoadingRecord(false); }
  };
  const close = () => {
    setModal(null);
    if (params.has('registro')) { const next = new URLSearchParams(params); next.delete('registro'); setParams(next, { replace: true }); }
  };
  const remove = async () => {
    if (!deleting) return;
    setBusyDelete(true);
    setActionError(null);
    try {
      await apiClient.delete(`/cxp/${resource}/${deleting[entity.idField]}`);
      clearCxpCatalogCache();
      setNotice('Registro eliminado.');
      refetch();
    } catch (reason) { setActionError(reason instanceof ApiError ? reason.message : 'No se pudo eliminar el registro'); }
    finally { setBusyDelete(false); setDeleting(null); }
  };

  const children = (row: CxpRecord) => {
    const id = row[entity.idField];
    const relations = resource === 'documentos' ? [
      ['documentos-detalle', 'idDocumento', 'Detalle'], ['documentos-tributos', 'idDocumento', 'Tributos'], ['aplicaciones', 'idDocumentoDestino', 'Aplicaciones'],
    ] : resource === 'lotes-pago' ? [['pagos', 'idLote', 'Pagos']]
      : resource === 'conciliaciones-proveedor' ? [['conciliaciones-proveedor-detalle', 'idConciliacionProv', 'Detalle']]
      : resource === 'pagos' ? [['aplicaciones', 'idPago', 'Aplicaciones']] : [];
    return relations.map(([target, field, title]) => <Link key={target} className="text-xs text-blue-700 underline underline-offset-2"
      to={`/cxp/${target}?filterField=${field}&filterValue=${id}`}>{title}</Link>);
  };

  return <CxpLayout resource={resource}>
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div><p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Cuentas por pagar · {entity.group}</p>
          <h1 className="text-2xl font-bold text-slate-900">{entity.title}</h1>
          <p className="text-sm text-slate-500 mt-1">{resource === 'archivos' ? 'Registra los datos y la ubicación de tus archivos y evidencias.' : `Consulta y administra ${entity.title.toLowerCase()}.`}</p></div>
        <Button icon={Plus} onClick={() => { setActionError(null); setNotice(null); setModal({ mode: 'create' }); }}>Nuevo registro</Button>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <TextInput id="cxp-search" icon={Search} label="Buscar" placeholder="Buscar por ID, código o descripción…" value={searchInput}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearchInput(event.target.value)} className="flex-1 min-w-56" />
          <Select id="cxp-filter-field" label="Filtrar por" value={filterField} placeholder="" className="sm:max-w-56"
            options={[{ value: '', label: 'Sin filtro' }, ...entity.fields.filter(field => field.lookup || field.options).map(field => ({ value: field.name, label: field.label }))]}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => updateFilter(event.target.value, '')} />
          <Button icon={RefreshCw} variant="secondary" onClick={() => { clearCxpCatalogCache(); refetch(); }} disabled={isLoading}>Actualizar</Button>
        </div>
        {filterDefinition?.lookup && <div className="max-w-lg"><RelationSelect id="cxp-filter-value" label={filterDefinition.label} catalog={filterDefinition.lookup}
          value={filterValue} onChange={value => updateFilter(filterField, value)} /></div>}
        {filterDefinition?.options && <Select id="cxp-filter-value" label={filterDefinition.label} value={filterValue} placeholder="" className="max-w-sm"
          options={[{ value: '', label: 'Todos' }, ...filterDefinition.options.map(value => ({ value, label: value.replace(/_/g, ' ') }))]}
          onChange={(event: React.ChangeEvent<HTMLSelectElement>) => updateFilter(filterField, event.target.value)} />}
      </div>
      {(error || actionError) && <p role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{actionError || error}</p>}
      {notice && !actionError && <p role="status" className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm rounded-lg p-3">{notice}</p>}
      {loadingRecord && <p role="status" className="text-sm text-slate-500">Abriendo registro…</p>}
      <DataTable data={data} isLoading={isLoading} emptyText={error ? 'La información no está disponible.' : 'No hay registros para mostrar.'}
        columns={[
          { header: 'ID', accessorKey: entity.idField },
          ...entity.columns.map(name => {
            const field = entity.fields.find(item => item.name === name)!;
            return { header: field.label, accessorKey: name, cell: ({ value }: { value: CxpRecord[string] }) => display(field, value) };
          }),
          { header: 'Acciones', align: 'right', cell: ({ row }: { row: CxpRecord }) => <div className="flex flex-col items-end gap-2">
            <div className="flex gap-1">
              <button type="button" disabled={loadingRecord} title="Ver registro" aria-label={`Ver registro ${row[entity.idField]}`} onClick={() => open(row, 'view')} className="p-2 text-slate-500 hover:bg-slate-100 rounded-md"><Eye size={16} /></button>
              <button type="button" disabled={loadingRecord} title="Editar registro" aria-label={`Editar registro ${row[entity.idField]}`} onClick={() => open(row, 'edit')} className="p-2 text-blue-600 hover:bg-blue-50 rounded-md"><Pencil size={16} /></button>
              <button type="button" title="Eliminar registro" aria-label={`Eliminar registro ${row[entity.idField]}`} onClick={() => { setNotice(null); setDeleting(row); }} className="p-2 text-red-600 hover:bg-red-50 rounded-md"><Trash2 size={16} /></button>
            </div><div className="flex flex-wrap justify-end gap-2">{children(row)}</div>
          </div> },
        ]} />
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <span>{meta.total} registros · Página {page} de {meta.totalPages}</span>
        <div className="flex gap-2"><Button variant="secondary" icon={ChevronLeft} disabled={page <= 1 || isLoading} onClick={() => setPage(current => current - 1)}>Anterior</Button>
          <Button variant="secondary" icon={ChevronRight} disabled={page >= meta.totalPages || isLoading} onClick={() => setPage(current => current + 1)}>Siguiente</Button></div>
      </div>
      <Modal isOpen={!!modal} onClose={close} size="lg" title={`${modal?.mode === 'create' ? 'Crear' : modal?.mode === 'edit' ? 'Editar' : 'Consultar'} · ${entity.singular}`}>
        {modal && <Form key={`${resource}-${modal.mode}-${modal.record?.[entity.idField] ?? 'new'}`} record={modal.record} readOnly={modal.mode === 'view'}
          initialValues={filterDefinition?.lookup && filterValue ? { [filterField]: filterDefinition.type === 'number' ? Number(filterValue) : filterValue } : {}}
          onCancel={close} onSuccess={() => { close(); setNotice('Registro guardado.'); refetch(); }} />}
      </Modal>
      <ConfirmDialog isOpen={!!deleting} onClose={() => { if (!busyDelete) setDeleting(null); }} onConfirm={remove}
        title={`Eliminar · ${entity.singular}`} description={`¿Deseas eliminar el registro #${deleting?.[entity.idField]}? Los registros utilizados por otros o ya confirmados se conservan.`}
        confirmLabel="Eliminar" isLoading={busyDelete} />
    </div>
  </CxpLayout>;
}
