import { useEffect, useState } from 'react';
import type { OpcionesProceso } from '@erp/contracts';
import { apiRequest, buildQueryString } from '../api';
import { CxpButton } from '../components/CxpButton';
import { formatDocumentoMoney } from '../documentos/documentoView';

export type OpcionDocumentoProceso = OpcionesProceso['documentos'][number];
export const documentosCompatibles = (a: OpcionDocumentoProceso, b: OpcionDocumentoProceso) =>
  a.proveedor === b.proveedor && a.sucursal === b.sucursal && a.moneda === b.moneda;

export function DocumentoProcesoSearch({ proveedor, disabled, onSelect }: {
  proveedor: string; disabled: boolean; onSelect: (doc: OpcionDocumentoProceso, options: OpcionesProceso) => boolean;
}) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<OpcionesProceso | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [retry, setRetry] = useState(0);
  const [readyFor, setReadyFor] = useState('');
  const requestKey = `${proveedor}:${query.trim()}`;
  const rows = readyFor === requestKey ? options?.documentos ?? [] : [];
  useEffect(() => {
    if (open && rows[active]) document.getElementById(`cxp-document-option-${rows[active].id}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, readyFor, open]);
  useEffect(() => {
    setOptions(null); setActive(-1); setError(''); setReadyFor('');
    if (!query.trim() || disabled) { setLoading(false); return; }
    let current = true;
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(() => {
      apiRequest<OpcionesProceso>(`/cxp/procesos/opciones${buildQueryString({ search: query.trim(), proveedor: proveedor || undefined })}`, { signal: controller.signal })
        .then(result => { if (current) { setOptions(result); setReadyFor(requestKey); } })
        .catch(reason => { if (current) setError(reason instanceof Error ? reason.message : 'No se pudieron buscar documentos.'); })
        .finally(() => { if (current) setLoading(false); });
    }, 300);
    return () => { current = false; controller.abort(); window.clearTimeout(timer); };
  }, [query, proveedor, disabled, retry]);

  const select = (row: OpcionDocumentoProceso) => {
    if (!options || disabled || loading || readyFor !== requestKey) return;
    if (onSelect(row, options)) { setQuery(''); setOpen(false); setActive(-1); }
  };
  const expanded = open && !!query.trim();
  return <div className="relative min-w-0" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <label htmlFor="cxp-document-search" className="block text-xs font-semibold text-slate-700 mb-1.5">Buscar factura o documento por número</label>
    <input id="cxp-document-search" role="combobox" aria-autocomplete="list" aria-expanded={expanded}
      aria-controls={expanded ? 'cxp-document-suggestions' : undefined}
      aria-activedescendant={expanded && active >= 0 && rows[active] ? `cxp-document-option-${rows[active].id}` : undefined}
      aria-describedby="cxp-document-search-help" autoComplete="off" maxLength={80} disabled={disabled}
      value={query} placeholder={proveedor ? 'Buscar entre las facturas del proveedor…' : 'Escribe un número; puedes elegir el proveedor después'}
      className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
      onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setActive(-1); setOpen(true); }}
      onKeyDown={event => {
        if (event.key === 'Escape' && expanded) { event.preventDefault(); event.stopPropagation(); setOpen(false); return; }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); setOpen(true);
          if (rows.length) setActive(index => event.key === 'ArrowDown' ? (index + 1) % rows.length : (index <= 0 ? rows.length : index) - 1);
        }
        if (event.key === 'Enter') { event.preventDefault(); if (expanded && rows[active]) select(rows[active]); }
      }} />
    <p id="cxp-document-search-help" className="mt-1 text-xs text-slate-500">Selecciona una coincidencia explícitamente. Solo se sugieren documentos elegibles con saldo; máximo 20 resultados por búsqueda.</p>
    {expanded && <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
      {loading && <p role="status" className="p-2 text-sm text-slate-500">Buscando documentos…</p>}
      {error && <div role="alert" className="p-2 text-sm text-red-700">{error}<CxpButton variant="secondary" size="sm" onClick={() => setRetry(value => value + 1)}>Reintentar búsqueda</CxpButton></div>}
      {!loading && !error && readyFor === requestKey && !rows.length && <p role="status" className="p-2 text-sm text-slate-500">No hay documentos elegibles para ese número{proveedor ? ' y proveedor' : ''}.</p>}
      <ul id="cxp-document-suggestions" role="listbox" aria-label="Documentos elegibles" aria-busy={loading} className="max-h-64 overflow-y-auto">
        {!loading && rows.map((row, index) => <li key={row.id} id={`cxp-document-option-${row.id}`} role="option" aria-selected={active === index}
          className={`cursor-pointer rounded-md p-3 text-sm ${active === index ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50 text-slate-800'}`}
          onMouseDown={event => event.preventDefault()} onMouseMove={() => setActive(index)} onClick={() => select(row)}>
          <strong className="block">{row.nombre}</strong>
          <span className="block text-xs">{row.proveedorNombre || `Proveedor #${row.proveedor}`} · Sucursal #{row.sucursal} · {formatDocumentoMoney(row.saldo, row.moneda)} disponible</span>
        </li>)}
      </ul>
    </div>}
  </div>;
}
