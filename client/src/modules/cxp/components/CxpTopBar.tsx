import { useState } from 'react';
import { Bell, Search } from 'lucide-react';

/** Barra superior delgada (48px) con el buscador global y las notificaciones. */
export function CxpTopBar() {
  const [query, setQuery] = useState('');
  return <div className="cxp-topbar h-12 shrink-0 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-end gap-3">
    <div className="relative flex items-center flex-1 sm:flex-none">
      <Search size={15} className="absolute left-3 text-slate-400 pointer-events-none" aria-hidden="true" />
      <input type="search" aria-label="Buscar solicitud" placeholder="Buscar solicitud..." value={query}
        onChange={event => setQuery(event.target.value)}
        className="h-8 w-full sm:w-64 pl-9 pr-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all duration-150" />
    </div>
    <button type="button" title="Notificaciones" aria-label="Notificaciones"
      className="relative p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
      <Bell size={18} />
      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white animate-pulse" />
    </button>
  </div>;
}
