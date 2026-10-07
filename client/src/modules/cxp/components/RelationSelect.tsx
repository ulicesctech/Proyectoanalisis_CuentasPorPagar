import { useEffect, useState } from 'react';
import type { CxpOption } from '@erp/contracts';
import { apiClient, buildQueryString } from '../../../shared/api';
import { Select, TextInput } from '../../../shared/ui-kit';

const cache = new Map<string, { expires: number; result: Promise<CxpOption[]> }>();
export const clearCxpCatalogCache = () => cache.clear();

export interface RelationSelectProps {
  catalog: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  readOnly?: boolean;
  id?: string;
  filterField?: string;
  filterValue?: string;
}

export function RelationSelect({ catalog, label, value, onChange, required, error, readOnly, id, filterField, filterValue }: RelationSelectProps) {
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<CxpOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Estado para registro rápido de proveedor
  const [showModal, setShowModal] = useState(false);
  const [newNit, setNewNit] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (readOnly && !value) { setOptions([]); return; }
    const timer = window.setTimeout(() => {
      setLoading(true);
      setLoadError(null);
      const path = `/cxp/catalogos/${catalog}${buildQueryString({ search, selected: value, filterField, filterValue })}`;
      const cached = cache.get(path);
      const result = cached && cached.expires > Date.now() ? cached.result : apiClient.get<CxpOption[]>(path);
      cache.set(path, { expires: Date.now() + 30000, result });
      result.then(rows => { if (active) setOptions(rows); })
        .catch(() => {
          cache.delete(path);
          if (active) setLoadError('No se pudo cargar este catálogo.');
        })
        .finally(() => { if (active) setLoading(false); });
    }, search ? 250 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [catalog, search, value, filterField, filterValue, readOnly, attempt]);

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
      setOptions(prev => [newOpt, ...prev.filter(o => o.id !== res.idProveedor)]);
      onChange(String(res.idProveedor));
      setShowModal(false);
      setNewNit('');
      setNewNombre('');
    } catch (err: any) {
      setCreateError(err.message || 'Error al registrar el proveedor');
    } finally {
      setCreating(false);
    }
  };

  const selected = options.find(option => String(option.id) === value);
  if (readOnly) return <TextInput id={id} label={label} value={selected?.label ?? (value ? `#${value}` : '—')} isReadOnly />;
  const choices = options.map(option => ({ value: String(option.id), label: option.label }));
  if (value && !selected) choices.unshift({ value, label: `Registro #${value}` });
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="block text-xs font-semibold text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {catalog === 'proveedores' && !readOnly && (
          <button
            type="button"
            onClick={() => { setShowModal(true); setCreateError(null); }}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 underline"
          >
            + Registrar proveedor
          </button>
        )}
      </div>

      <Select id={id} label="" required={required} value={value} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}
        placeholder="" options={[{ value: '', label: loading ? 'Cargando opciones…' : 'Seleccionar…' }, ...choices]}
        error={error} />
      <TextInput id={`${id ?? catalog}-search`} aria-label={`Buscar en ${label}`} placeholder={`Buscar ${label.toLowerCase()}…`}
        value={search} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)} className="text-xs" />
      {loadError ? <p className="text-xs text-red-600">{loadError} <button type="button" className="underline font-semibold" onClick={() => setAttempt(current => current + 1)}>Reintentar</button></p>
        : <p className="text-xs text-slate-500">{loading ? 'Actualizando opciones…' : options.length === 0 ? 'No hay coincidencias; revisa la búsqueda o registra el dato relacionado.' : options.length >= 50 ? 'Se muestran 50 opciones. Usa la búsqueda para encontrar otra.' : `${options.length} opciones disponibles`}</p>}

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
    </div>
  );
}
