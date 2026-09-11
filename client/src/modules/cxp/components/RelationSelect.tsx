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

  const selected = options.find(option => String(option.id) === value);
  if (readOnly) return <TextInput id={id} label={label} value={selected?.label ?? (value ? `#${value}` : '—')} isReadOnly />;
  const choices = options.map(option => ({ value: String(option.id), label: option.label }));
  if (value && !selected) choices.unshift({ value, label: `Registro #${value}` });
  return (
    <div className="space-y-1.5">
      <Select id={id} label={label} required={required} value={value} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}
        placeholder="" options={[{ value: '', label: loading ? 'Cargando opciones…' : 'Seleccionar…' }, ...choices]}
        error={error} />
      <TextInput id={`${id ?? catalog}-search`} aria-label={`Buscar en ${label}`} placeholder={`Buscar ${label.toLowerCase()}…`}
        value={search} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)} className="text-xs" />
      {loadError ? <p className="text-xs text-red-600">{loadError} <button type="button" className="underline font-semibold" onClick={() => setAttempt(current => current + 1)}>Reintentar</button></p>
        : <p className="text-xs text-slate-500">{loading ? 'Actualizando opciones…' : options.length === 0 ? 'No hay coincidencias; revisa la búsqueda o registra primero el dato relacionado.' : options.length >= 50 ? 'Se muestran 50 opciones. Usa la búsqueda para encontrar otra.' : `${options.length} opciones disponibles`}</p>}
    </div>
  );
}
