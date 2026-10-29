import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Plus, Search, X } from 'lucide-react';

export interface SearchableOption {
  value: string;
  label: string;
}

export interface SearchableSelectProps {
  id?: string;
  label: string;
  value: string;
  /** Texto de la opción seleccionada; se conserva aunque no esté en los resultados de la búsqueda. */
  selectedLabel?: string;
  options: SearchableOption[];
  onChange: (value: string, label?: string) => void;
  search: string;
  onSearchChange: (search: string) => void;
  loading?: boolean;
  loadError?: string | null;
  onRetry?: () => void;
  /** La lista llegó recortada por el servidor. */
  truncated?: boolean;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  /** Acción en la línea de la etiqueta (ej. "+ Registrar proveedor"); no cambia la altura del campo. */
  labelAction?: ReactNode;
  /** Acción al pie de la lista cuando la búsqueda no da resultados. */
  emptyAction?: { label: string; onClick: () => void };
}

/** Separa "Usuario #1001 · CXP Demo - Ejecutor" en texto principal y secundario. */
function splitLabel(label: string): [string, string] {
  const index = label.indexOf(' · ');
  return index < 0 ? [label, ''] : [label.slice(0, index), label.slice(index)];
}

function OptionText({ label }: { label: string }) {
  const [main, secondary] = splitLabel(label);
  return <span className="block truncate" title={label}>
    <span className="text-slate-900">{main}</span>{secondary && <span className="text-slate-500">{secondary}</span>}
  </span>;
}

/**
 * Selección con búsqueda integrada: ocupa la altura de un input y la búsqueda vive dentro
 * del desplegable. Sigue el patrón combobox de WAI-ARIA (flechas, Enter, Esc y Tab).
 */
export function SearchableSelect({
  id, label, value, selectedLabel, options, onChange, search, onSearchChange, loading = false, loadError, onRetry,
  truncated = false, required, error, disabled, placeholder = 'Seleccionar…', labelAction, emptyAction,
}: SearchableSelectProps) {
  const autoId = useId();
  const baseId = id ?? `searchable-${autoId}`;
  const listId = `${baseId}-listbox`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const current = options.find(option => option.value === value)?.label ?? selectedLabel ?? (value ? `Registro #${value}` : '');

  useEffect(() => { if (open) searchInput.current?.focus(); }, [open]);
  useEffect(() => { setActive(options.length ? 0 : -1); }, [options]);
  useEffect(() => {
    if (active < 0) return;
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!wrapper.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const openList = () => { if (!disabled) setOpen(true); };
  const close = (returnFocus: boolean) => {
    setOpen(false);
    onSearchChange('');
    if (returnFocus) trigger.current?.focus();
  };
  const choose = (option: SearchableOption) => {
    onChange(option.value, option.label);
    close(true);
  };

  const onSearchKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(index => Math.min(options.length - 1, index + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => Math.max(0, index - 1)); }
    else if (event.key === 'Home') { event.preventDefault(); setActive(options.length ? 0 : -1); }
    else if (event.key === 'End') { event.preventDefault(); setActive(options.length - 1); }
    else if (event.key === 'Enter') { event.preventDefault(); if (options[active]) choose(options[active]); }
    // Esc cierra solo el desplegable, no el modal que lo contiene.
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
  };

  const borders = error
    ? 'border-red-500 focus-within:ring-2 focus-within:ring-red-100'
    : disabled ? 'border-slate-200' : 'border-slate-300 hover:border-slate-400 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100';
  const showClear = !required && !!value && !disabled;

  // Tab sale con el movimiento normal del foco; el desplegable se cierra cuando el foco deja el componente.
  const onBlur = (event: React.FocusEvent) => {
    if (open && !wrapper.current?.contains(event.relatedTarget as Node | null)) close(false);
  };

  return <div ref={wrapper} onBlur={onBlur} className="relative w-full min-w-0 flex flex-col gap-1.5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <label htmlFor={baseId} className="text-xs font-semibold text-slate-700 flex items-center">
        {label}{required && <span className="text-red-500 ml-0.5" title="Campo requerido">*</span>}
      </label>
      {labelAction}
    </div>
    <div className={`relative flex items-center h-10 rounded-lg border transition-all duration-150 ${disabled ? 'bg-slate-50' : 'bg-white'} ${borders}`}>
      <button ref={trigger} id={baseId} type="button" role="combobox" disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-required={required || undefined}
        aria-invalid={!!error || undefined} aria-describedby={error ? `${baseId}-error` : undefined}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={event => { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) { event.preventDefault(); openList(); } }}
        className={`h-full min-w-0 flex-1 pl-3 text-left text-sm outline-none rounded-lg disabled:cursor-not-allowed ${showClear ? 'pr-16' : 'pr-9'}`}>
        {current ? <OptionText label={current} /> : <span className="block truncate text-slate-400">{placeholder}</span>}
      </button>
      {showClear && <button type="button" aria-label={`Limpiar ${label}`} title={`Limpiar ${label}`}
        onClick={() => { onChange(''); trigger.current?.focus(); }}
        className="absolute right-8 p-1 rounded text-slate-400 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><X size={15} /></button>}
      <ChevronDown size={16} aria-hidden="true" className={`absolute right-3 pointer-events-none text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
    </div>
    {error && <span id={`${baseId}-error`} className="text-xs text-red-600 font-medium">{error}</span>}

    {open && <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-slate-200 bg-white shadow-lg">
      <div className="relative border-b border-slate-100 p-2">
        <Search size={15} aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input ref={searchInput} type="text" role="combobox" autoComplete="off" aria-label={`Buscar ${label.toLowerCase()}`}
          aria-expanded="true" aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={active >= 0 && options[active] ? `${baseId}-option-${active}` : undefined}
          placeholder={`Buscar ${label.toLowerCase()}…`} value={search}
          onChange={event => onSearchChange(event.target.value)} onKeyDown={onSearchKey}
          className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
      </div>
      <ul ref={list} id={listId} role="listbox" aria-label={label} aria-busy={loading || undefined} className="max-h-60 overflow-y-auto py-1">
        {options.map((option, index) => <li key={option.value} id={`${baseId}-option-${index}`} data-index={index} role="option"
          aria-selected={option.value === value}
          onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(option)}
          className={`cursor-pointer px-3 py-2 text-sm ${index === active ? 'bg-blue-50' : ''} ${option.value === value ? 'font-semibold' : ''}`}>
          <OptionText label={option.label} />
        </li>)}
      </ul>
      {loading && <p role="status" className="px-3 py-2 text-xs text-slate-500">Cargando…</p>}
      {!loading && loadError && <p role="alert" className="px-3 py-2 text-xs text-red-600">{loadError}{' '}
        {onRetry && <button type="button" className="underline font-semibold" onClick={onRetry}>Reintentar</button>}</p>}
      {!loading && !loadError && options.length === 0 && <p role="status" className="px-3 py-2 text-xs text-slate-500">Sin resultados{search ? ` para "${search}"` : ''}.</p>}
      {!loading && !loadError && truncated && <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
        Mostrando las primeras {options.length} {options.length === 1 ? 'opción' : 'opciones'}. Escribe para filtrar.</p>}
      {!loading && !loadError && options.length === 0 && emptyAction && <button type="button" onClick={() => { setOpen(false); emptyAction.onClick(); }}
        className="flex w-full items-center gap-1.5 border-t border-slate-100 px-3 py-2 text-left text-xs font-semibold text-blue-600 hover:bg-blue-50">
        <Plus size={14} aria-hidden="true" />{emptyAction.label}</button>}
    </div>}
  </div>;
}
