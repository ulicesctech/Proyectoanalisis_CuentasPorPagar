import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import type { CxpOption } from '@erp/contracts';
import { apiClient, buildQueryString } from '../../../../shared/api';

type Props = {
  id: string;
  label: string;
  catalog: string;
  value: string;
  onChange: (value: string, label?: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
};

export function DocumentoCatalogPicker({ id, label, catalog, value, onChange, placeholder = 'Buscar y seleccionar…', required, error }: Props) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<CxpOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const previousValue = useRef(value);
  const internalClear = useRef(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (previousValue.current && !value) {
      setSelectedLabel('');
      if (!internalClear.current) setQuery('');
      internalClear.current = false;
    }
    previousValue.current = value;
  }, [value]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setLoadError(false);
      apiClient.get<CxpOption[]>(`/cxp/catalogos/${catalog}${buildQueryString({ search: query, selected: value })}`)
        .then(result => {
          if (!active) return;
          setOptions(result);
          if (value && !selectedLabel) setSelectedLabel(result.find(item => String(item.id) === value)?.label ?? `Registro #${value}`);
        })
        .catch(() => { if (active) { setOptions([]); setLoadError(true); } })
        .finally(() => { if (active) setLoading(false); });
    }, query ? 250 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [catalog, query, value, selectedLabel]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!wrapper.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const choose = (option: CxpOption) => {
    setSelectedLabel(option.label);
    setQuery('');
    setOpen(false);
    onChange(String(option.id), option.label);
  };

  return <div ref={wrapper} className="relative min-w-0">
    <label htmlFor={id} className="block text-xs font-semibold text-slate-700 mb-1.5">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
    <div className={`flex items-center h-10 rounded-lg border bg-white ${error ? 'border-red-400' : 'border-slate-300 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100'}`}>
      <Search size={16} className="ml-3 shrink-0 text-slate-400" />
      <input id={id} type="text" autoComplete="off" value={value && !open ? selectedLabel : query}
        placeholder={placeholder} aria-invalid={!!error} aria-expanded={open} aria-controls={`${id}-options`}
        onFocus={() => { if (value) setQuery(''); setOpen(true); }}
        onChange={event => { if (value) { internalClear.current = true; onChange(''); setSelectedLabel(''); } setQuery(event.target.value); setOpen(true); }}
        className="min-w-0 flex-1 h-full px-2 text-sm text-slate-900 outline-none bg-transparent placeholder:text-slate-400" />
      {value ? <button type="button" aria-label={`Limpiar ${label}`} onClick={() => { internalClear.current = true; onChange(''); setSelectedLabel(''); setQuery(''); setOpen(true); document.getElementById(id)?.focus(); }} className="p-2 text-slate-400 hover:text-slate-700"><X size={15} /></button>
        : <ChevronDown size={16} className="mr-3 text-slate-400" />}
    </div>
    {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    {open && <div id={`${id}-options`} className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg py-1">
      {loading && <p className="px-3 py-2 text-xs text-slate-500">Buscando…</p>}
      {!loading && loadError && <p className="px-3 py-2 text-xs text-red-600">No se pudo consultar el catálogo.</p>}
      {!loading && !loadError && !options.length && <p className="px-3 py-2 text-xs text-slate-500">Sin coincidencias.</p>}
      {!loading && options.map(option => <button key={option.id} type="button" onClick={() => choose(option)}
        className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700">{option.label}</button>)}
    </div>}
  </div>;
}
