import { useEffect, useMemo, useState } from 'react';
import type { CxpOption } from '@erp/contracts';
import { apiClient, buildQueryString } from '../api';
import { TextInput } from '../../../shared/ui-kit';
import { SearchableSelect } from './SearchableSelect';

const cache = new Map<string, { expires: number; result: Promise<CxpOption[]> }>();
export const clearCxpCatalogCache = () => cache.clear();

export interface RelationSelectProps {
  catalog: string;
  label: string;
  value: string;
  onChange: (value: string, label?: string) => void;
  required?: boolean;
  error?: string;
  readOnly?: boolean;
  id?: string;
  filterField?: string;
  filterValue?: string;
  placeholder?: string;
  /** Ofrece "+ Registrar proveedor" en el catálogo de proveedores; se desactiva en filtros. */
  allowCreate?: boolean;
}

/** El catálogo del servidor devuelve como máximo 50 filas. */
const CATALOG_LIMIT = 50;

export function RelationSelect({ catalog, label, value, onChange, required, error, readOnly, id, filterField, filterValue, placeholder, allowCreate = true }: RelationSelectProps) {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<CxpOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Texto de la opción elegida: se conserva aunque la búsqueda actual no la incluya.
  const [known, setKnown] = useState<{ value: string; label: string } | null>(null);

  // Estado para registro rápido de proveedor
  const [showModal, setShowModal] = useState(false);
  const [newNit, setNewNit] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (readOnly && !value) { setRows([]); return; }
    const timer = window.setTimeout(() => {
      setLoading(true);
      setLoadError(null);
      // Sin búsqueda se pide también la opción seleccionada para conocer su texto;
      // con búsqueda no, para que "Sin resultados" sea real.
      const path = `/cxp/catalogos/${catalog}${buildQueryString(search ? { search, filterField, filterValue } : { selected: value, filterField, filterValue })}`;
      const cached = cache.get(path);
      const result = cached && cached.expires > Date.now() ? cached.result : apiClient.get<CxpOption[]>(path);
      cache.set(path, { expires: Date.now() + 30000, result });
      result.then(next => { if (active) setRows(next); })
        .catch(() => {
          cache.delete(path);
          if (active) setLoadError('No se pudo cargar este catálogo.');
        })
        .finally(() => { if (active) setLoading(false); });
    }, search ? 300 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [catalog, search, value, filterField, filterValue, readOnly, attempt]);

  const options = useMemo(() => rows.map(row => ({ value: String(row.id), label: row.label })), [rows]);
  const found = options.find(option => option.value === value);
  useEffect(() => { if (found && known?.label !== found.label) setKnown(found); }, [found, known]);
  const selectedLabel = found?.label ?? (known?.value === value ? known.label : undefined);

  const handleCreateProveedor = async () => {
    if (!newNit.trim() || !newNombre.trim()) {
      setCreateError('El NIT y la Razón Social son obligatorios');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await apiClient.post<{ idProveedor: number; nit: string; nombreEntidad: string; mensaje: string }>('/cxp/proveedores', {
        nit: newNit.trim(),
        nombreEntidad: newNombre.trim(),
      });
      clearCxpCatalogCache();
      const newOpt: CxpOption = {
        id: res.idProveedor,
        label: `Proveedor #${res.idProveedor} · ${res.nombreEntidad} · ${res.nit}`,
      };
      setRows(prev => [newOpt, ...prev.filter(o => o.id !== res.idProveedor)]);
      setKnown({ value: String(res.idProveedor), label: newOpt.label });
      onChange(String(res.idProveedor), newOpt.label);
      setShowModal(false);
      setNewNit('');
      setNewNombre('');
    } catch (err: any) {
      setCreateError(err.message || 'Error al registrar el proveedor');
    } finally {
      setCreating(false);
    }
  };

  if (readOnly) return <TextInput id={id} label={label} value={selectedLabel ?? (value ? `#${value}` : '—')} isReadOnly />;
  const canCreate = allowCreate && catalog === 'proveedores';
  const openCreate = () => { setShowModal(true); setCreateError(null); setNewNombre(search); };
  return (
    <>
      <SearchableSelect id={id} label={label} value={value} selectedLabel={selectedLabel} options={options}
        onChange={(next, nextLabel) => { if (next && nextLabel) setKnown({ value: next, label: nextLabel }); onChange(next, nextLabel); }}
        search={search} onSearchChange={setSearch} loading={loading} loadError={loadError} onRetry={() => setAttempt(current => current + 1)}
        truncated={options.length >= CATALOG_LIMIT} required={required} error={error} placeholder={placeholder}
        labelAction={canCreate ? <button type="button" onClick={openCreate}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 underline">+ Registrar proveedor</button> : undefined}
        emptyAction={canCreate ? { label: 'Registrar proveedor', onClick: openCreate } : undefined} />

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">Registrar Proveedor (CxP)</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {createError && (
                <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
                  {createError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  NIT *
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej. 1234567-8"
                  value={newNit}
                  onChange={e => setNewNit(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Razón Social / Nombre Entidad *
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej. Comercial Distribuidora S.A."
                  value={newNombre}
                  onChange={e => setNewNombre(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                disabled={creating}
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                disabled={creating || !newNit.trim() || !newNombre.trim()}
                onClick={handleCreateProveedor}
              >
                {creating ? 'Guardando…' : 'Guardar y Seleccionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
