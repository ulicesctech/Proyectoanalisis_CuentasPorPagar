import { useEffect, useState, type ComponentType } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, LayoutGrid, Pencil, Plus, RefreshCw, Search, Trash2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getCxpEntity, type CxpRecord, type CxpResource, type CxpFieldDefinition } from '@erp/contracts';
import { Button, DataTable, Select, TextInput } from '../../../shared/ui-kit';
import { Modal } from '../../../shared/components';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { apiClient, ApiError } from '../../../shared/api';
import { CxpLayout } from '../CxpLayout';
import { CxpBreadcrumb } from './CxpBreadcrumb';
import { useCxpList } from '../hooks/useCxpList';
import { RelationSelect, clearCxpCatalogCache } from './RelationSelect';
import type { CxpFormProps } from './CxpEntityForm';
import { CxpButton, type CxpButtonProps } from './CxpButton';
import { CXP_MANAGEMENT_VIEWS, CxpManagementDialog, isCxpManagementResource } from './CxpManagementUI';

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
  const management = isCxpManagementResource(resource);
  const presentation = CXP_MANAGEMENT_VIEWS.find(view => view.resource === resource);
  const navigate = useNavigate();
  const PageButton: ComponentType<CxpButtonProps> = management ? CxpButton : Button;
  const RecordModal = management ? CxpManagementDialog : Modal;
  const [showViews, setShowViews] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
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
  const parentDocumento = ['documentos-detalle', 'documentos-tributos'].includes(resource) && filterField === 'idDocumento' && /^\d+$/.test(filterValue)
    ? filterValue : null;
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
  const resetFilters = () => {
    setSearchInput('');
    setSearch('');
    updateFilter('', '');
  };
  const open = async (row: CxpRecord, mode: 'edit' | 'view') => {
    setLoadingRecord(true);
    setActionError(null);
    try { setModal({ mode, record: await apiClient.get<CxpRecord>(`/cxp/${resource}/${row[entity.idField]}`) }); }
    catch (reason) { setActionError(reason instanceof ApiError ? reason.message : 'No se pudo abrir el registro'); }
    finally { setLoadingRecord(false); }
  };
  const close = () => {
    setFormBusy(false);
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
    const links = relations.map(([target, field, title]) => <Link key={target} className="text-xs text-blue-700 underline underline-offset-2"
      to={`/cxp/${target}?filterField=${field}&filterValue=${id}`}>{title}</Link>);
    // Las facturas especiales se editan, emiten y anulan desde su propio módulo.
    if (resource === 'documentos' && row.tipoDocumento === 'FACTURA_ESPECIAL') {
      links.unshift(<Link key="factura-especial" className="text-xs font-semibold text-blue-700 underline underline-offset-2" to={`/cxp/facturas-especiales/${id}`}>Factura especial</Link>);
    }
    return links;
  };

  return <CxpLayout resource={resource} searchQuery={searchInput} onSearchChange={setSearchInput}>
    <div className={management ? 'cxp-management-page' : 'space-y-5'}>
      {parentDocumento && <Link to={`/cxp/documentos/${parentDocumento}`}
        className="inline-flex items-center text-sm font-semibold text-blue-700 hover:text-blue-800">← Volver al expediente · Documento #{parentDocumento}</Link>}
      {management ? <header className="cxp-management-header">
        <div className="cxp-management-heading">
          <nav className="cxp-management-breadcrumb" aria-label="Ruta de navegación">
            <Link to="/cxp">Cuentas por Pagar</Link><span aria-hidden="true">/</span>
            <span>{entity.group}</span><span aria-hidden="true">/</span><span aria-current="page">{entity.title}</span>
          </nav>
          <h1>{entity.title}</h1><p className="cxp-management-description">{presentation?.description}</p>
        </div>
        <div className="cxp-management-header-actions">
          <PageButton icon={ArrowLeft} variant="ghost" onClick={() => navigate('/cxp')}>Volver al inicio</PageButton>
          <PageButton icon={LayoutGrid} variant="secondary" onClick={() => setShowViews(true)}>Otras vistas</PageButton>
          <PageButton icon={Plus} onClick={() => { setActionError(null); setNotice(null); setModal({ mode: 'create' }); }}>Nuevo registro</PageButton>
        </div>
      </header> : <div className="flex flex-wrap justify-between items-start gap-4">
        <div><CxpBreadcrumb group={entity.group} current={entity.title} />
          <h1 className="text-2xl font-bold text-slate-900">{entity.title}</h1>
          <p className="text-sm text-slate-500 mt-1">{parentDocumento ? `Trabajando en el documento #${parentDocumento}.` : resource === 'archivos' ? 'Registra los datos y la ubicación de tus archivos y evidencias.' : `Consulta y administra ${entity.title.toLowerCase()}.`}</p></div>
        <Button icon={Plus} onClick={() => { setActionError(null); setNotice(null); setModal({ mode: 'create' }); }}>Nuevo registro</Button>
      </div>}
      <section className={management ? 'cxp-management-filters' : 'bg-white border border-slate-200 rounded-xl p-4'} aria-label={`Filtros de ${entity.title.toLowerCase()}`}>
        <div className={management ? 'cxp-management-filter-grid' : 'flex flex-wrap items-end gap-3'}>
          <TextInput id="cxp-search" icon={management ? undefined : Search} label="Buscar" placeholder="Buscar por ID, código o descripción…" value={searchInput}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearchInput(event.target.value)} className={management ? 'cxp-management-search' : 'flex-1 min-w-56'} />
          {!parentDocumento && <Select id="cxp-filter-field" label="Filtrar por" value={filterField} placeholder="" className="sm:max-w-56"
            options={[{ value: '', label: 'Sin filtro' }, ...entity.fields.filter(field => field.lookup || field.options).map(field => ({ value: field.name, label: field.label }))]}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => updateFilter(event.target.value, '')} />}
          {!parentDocumento && filterDefinition?.lookup && <div className="w-full sm:w-72"><RelationSelect id="cxp-filter-value" label={filterDefinition.label} catalog={filterDefinition.lookup}
            placeholder="Todos" allowCreate={false} value={filterValue} onChange={value => updateFilter(filterField, value)} /></div>}
          {!parentDocumento && filterDefinition?.options && <Select id="cxp-filter-value" label={filterDefinition.label} value={filterValue} placeholder="" className="sm:max-w-56"
            options={[{ value: '', label: 'Todos' }, ...filterDefinition.options.map(value => ({ value, label: value.replace(/_/g, ' ') }))]}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => updateFilter(filterField, event.target.value)} />}
          {!management && <Button icon={RefreshCw} variant="secondary" onClick={() => { clearCxpCatalogCache(); refetch(); }} disabled={isLoading}>Actualizar</Button>}
        </div>
        {management && <div className="cxp-management-filter-footer">
          <p aria-live="polite">{isLoading ? 'Consultando registros…' : error ? 'Información no disponible' : `${meta.total} registros encontrados`}</p>
          <div className="cxp-management-filter-actions">
            <PageButton icon={X} variant="ghost" disabled={!searchInput && !filterField && !filterValue} onClick={resetFilters}>Limpiar filtros</PageButton>
            <PageButton icon={RefreshCw} variant="secondary" disabled={isLoading} onClick={() => { clearCxpCatalogCache(); refetch(); }}>Actualizar</PageButton>
          </div>
        </div>}
      </section>
      {(error || actionError) && <p role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{actionError || error}</p>}
      {notice && !actionError && <p role="status" className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm rounded-lg p-3">{notice}</p>}
      {loadingRecord && <p role="status" className="text-sm text-slate-500">Abriendo registro…</p>}
      <DataTable className={management ? 'cxp-management-table' : ''} data={data} isLoading={isLoading} emptyText={error ? 'La información no está disponible.' : 'No hay registros para mostrar.'}
        columns={[
          { header: 'ID', accessorKey: entity.idField },
          ...entity.columns.map(name => {
            const field = entity.fields.find(item => item.name === name)!;
            return { header: field.label, accessorKey: name, cell: ({ value }: { value: CxpRecord[string] }) => display(field, value) };
          }),
          { header: 'Acciones', align: 'right', cell: ({ row }: { row: CxpRecord }) => <div className="flex flex-col items-end gap-2">
            <div className={management ? 'cxp-management-row-actions' : 'flex gap-1'}>
              <PageButton icon={management ? Eye : undefined} size={management ? 'sm' : 'md'} variant="secondary" type="button" disabled={loadingRecord} title="Ver registro" aria-label={`Ver registro ${row[entity.idField]}`} onClick={() => open(row, 'view')} >{management ? 'Ver' : <Eye size={16} />}</PageButton>
              <PageButton icon={management ? Pencil : undefined} size={management ? 'sm' : 'md'} variant="secondary" type="button" disabled={loadingRecord} title="Editar registro" aria-label={`Editar registro ${row[entity.idField]}`} onClick={() => open(row, 'edit')} >{management ? 'Editar' : <Pencil size={16} />}</PageButton>
              <PageButton icon={management ? Trash2 : undefined} size={management ? 'sm' : 'md'} variant="danger" type="button" title="Eliminar registro" aria-label={`Eliminar registro ${row[entity.idField]}`} onClick={() => { setNotice(null); setDeleting(row); }} >{management ? 'Eliminar' : <Trash2 size={16} />}</PageButton>
            </div><div className="flex flex-wrap justify-end gap-2">{children(row)}</div>
          </div> },
        ]} />
      <div className={management ? 'cxp-management-pagination' : 'flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600'}>
        <span>{meta.total} registros · Página {page} de {meta.totalPages}</span>
        <div className="flex gap-2"><PageButton variant="secondary" icon={ChevronLeft} disabled={page <= 1 || isLoading} onClick={() => setPage(current => current - 1)}>Anterior</PageButton>
          <PageButton variant="secondary" icon={ChevronRight} disabled={page >= meta.totalPages || isLoading} onClick={() => setPage(current => current + 1)}>Siguiente</PageButton></div>
      </div>
      <RecordModal isOpen={!!modal} onClose={close} size="lg" {...(management ? { busy: formBusy } : {})} title={`${modal?.mode === 'create' ? 'Crear' : modal?.mode === 'edit' ? 'Editar' : 'Consultar'} · ${entity.singular}`}>
        {modal && <Form key={`${resource}-${modal.mode}-${modal.record?.[entity.idField] ?? 'new'}`} record={modal.record} readOnly={modal.mode === 'view'}
          onBusyChange={management ? setFormBusy : undefined}
          initialValues={filterDefinition?.lookup && filterValue ? { [filterField]: filterDefinition.type === 'number' ? Number(filterValue) : filterValue } : {}}
          onCancel={close} onSuccess={() => { close(); setNotice('Registro guardado.'); refetch(); }} />}
      </RecordModal>
      {management ? <CxpManagementDialog isOpen={!!deleting} onClose={() => setDeleting(null)} busy={busyDelete} size="sm" title={`Eliminar · ${entity.singular}`}>
        <p className="cxp-management-description">¿Deseas eliminar el registro #{deleting?.[entity.idField]}? Los registros utilizados por otros o ya confirmados se conservan.</p>
        <div className="cxp-management-confirm-actions">
          <PageButton icon={X} variant="secondary" disabled={busyDelete} onClick={() => setDeleting(null)}>Cancelar</PageButton>
          <PageButton icon={Trash2} variant="danger" disabled={busyDelete} onClick={() => void remove()}>{busyDelete ? 'Eliminando…' : 'Eliminar'}</PageButton>
        </div>
      </CxpManagementDialog> : <ConfirmDialog isOpen={!!deleting} onClose={() => { if (!busyDelete) setDeleting(null); }} onConfirm={remove}
        title={`Eliminar · ${entity.singular}`} description={`¿Deseas eliminar el registro #${deleting?.[entity.idField]}? Los registros utilizados por otros o ya confirmados se conservan.`}
        confirmLabel="Eliminar" isLoading={busyDelete} />}
      <CxpManagementDialog isOpen={management && showViews} onClose={() => setShowViews(false)} size="md"
        title={`Vistas de ${entity.group}`} description="Elegí la vista que necesitás consultar.">
        <div className="cxp-management-options">
          {CXP_MANAGEMENT_VIEWS.filter(view => view.group === entity.group).map(view =>
            <CxpButton key={view.resource} variant="secondary" className="cxp-management-option" aria-current={resource === view.resource ? 'page' : undefined}
              onClick={() => { setShowViews(false); if (resource !== view.resource) navigate(view.path); }}>
              <strong>{view.title}{resource === view.resource ? ' · Vista actual' : ''}</strong><small>{view.description}</small>
            </CxpButton>)}
        </div>
      </CxpManagementDialog>
    </div>
  </CxpLayout>;
}
