import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Search } from 'lucide-react';
import { CXP_HOME_SECTIONS } from '../home/cxpHome.config';

/**
 * Buscador y acceso al menú móvil. La identidad y el logout viven en el pie del menú.
 */
export function CxpTopBar({ searchQuery, onSearchChange, onOpenMenu }: {
  searchQuery?: string; onSearchChange?: (value: string) => void;
  onOpenMenu: () => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const results = CXP_HOME_SECTIONS.flatMap(section => section.cards).filter(card =>
    normalize(`${card.title} ${card.description}`).includes(normalize(query.trim())));
  const label = onSearchChange ? 'Buscar solicitud' : 'Buscar pantalla';
  return <div className="cxp-topbar h-12 shrink-0 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-end gap-3">
    <button type="button" className="cxp-menu-toggle rounded-lg p-2 text-slate-600 hover:bg-slate-100" title="Abrir menú" aria-label="Abrir menú" onClick={onOpenMenu}><Menu size={20} /></button>
    <div className="relative flex items-center min-w-0 flex-1 sm:flex-none"
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
      <Search size={15} className="absolute left-3 text-slate-400 pointer-events-none" aria-hidden="true" />
      <input type="search" aria-label={label} placeholder={`${label}...`} value={onSearchChange ? searchQuery ?? '' : query}
        onFocus={() => setOpen(true)} onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}
        onChange={event => { if (onSearchChange) onSearchChange(event.target.value); else { setQuery(event.target.value); setOpen(true); } }}
        className="h-8 w-full sm:w-64 pl-9 pr-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all duration-150" />
      {!onSearchChange && open && query.trim() && <nav aria-label="Resultados de búsqueda de pantallas"
        className="absolute left-0 right-0 top-full z-40 mt-2 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
        {results.length ? results.map(card => <Link key={card.path} to={card.path} onClick={() => { setQuery(''); setOpen(false); }}
          className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 focus:bg-blue-50">{card.title}</Link>)
          : <p role="status" className="p-2 text-sm text-slate-500">No se encontraron pantallas.</p>}
      </nav>}
    </div>
  </div>;
}
