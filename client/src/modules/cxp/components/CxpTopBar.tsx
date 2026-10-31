import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { CxpCommandPalette } from './CxpCommandPalette';
import { CxpUserMenu } from './CxpUserMenu';

/** No abrir el buscador con "/" mientras se escribe en un campo. */
function escribiendo(destino: EventTarget | null): boolean {
  if (!(destino instanceof HTMLElement)) return false;
  return destino.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(destino.tagName);
}

/**
 * Barra superior de CXP: buscador de pantallas (⌘K / Ctrl+K o "/") y menú de la cuenta.
 * En Procesos de pago también muestra la búsqueda de solicitudes de esa pantalla.
 */
export function CxpTopBar({ searchQuery, onSearchChange }: {
  searchQuery?: string; onSearchChange?: (value: string) => void;
}) {
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  const atajo = useMemo(() => (/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? '⌘K' : 'Ctrl K'), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setBuscadorAbierto(true);
      } else if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !escribiendo(event.target)) {
        event.preventDefault();
        setBuscadorAbierto(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const abrirBuscador = <button type="button" onClick={() => setBuscadorAbierto(true)} aria-haspopup="dialog"
    aria-keyshortcuts="Meta+K Control+K /" aria-label={`Buscar pantallas (${atajo})`}
    className={`group flex h-10 min-w-0 cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 transition-colors duration-150 hover:border-slate-300 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${onSearchChange ? 'shrink-0' : 'w-full max-w-md'}`}>
    <Search size={16} aria-hidden="true" className="shrink-0 text-slate-400 transition-colors group-hover:text-slate-600" />
    <span className={`flex-1 truncate text-left ${onSearchChange ? 'hidden lg:block' : ''}`}>Buscar pantallas…</span>
    <kbd aria-hidden="true" className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[11px] font-medium text-slate-500 sm:block">{atajo}</kbd>
  </button>;

  return <header className="cxp-topbar flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
    {abrirBuscador}
    {onSearchChange && <div className="relative flex min-w-0 max-w-sm flex-1 items-center">
      <Search size={15} className="pointer-events-none absolute left-3 text-slate-400" aria-hidden="true" />
      <input type="search" aria-label="Buscar solicitud" placeholder="Buscar solicitud…" value={searchQuery ?? ''}
        onChange={event => onSearchChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 transition-colors duration-150 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" />
    </div>}
    <div className="ml-auto flex items-center">
      <CxpUserMenu />
    </div>
    <CxpCommandPalette open={buscadorAbierto} onClose={() => setBuscadorAbierto(false)} />
  </header>;
}
