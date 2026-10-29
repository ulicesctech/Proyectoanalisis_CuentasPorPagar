import { useState, type ChangeEvent } from 'react';
import { Bell, Search } from 'lucide-react';
import { useOperador } from '../operador/operador';

/**
 * Barra superior delgada (48px) con el buscador global, las notificaciones y el
 * selector "Operando como". El usuario elegido firma las operaciones de CXP
 * (identidad provisional, sin inicio de sesión).
 */
export function CxpTopBar() {
  const [query, setQuery] = useState('');
  const { actorId, actor, usuarios, loading, error, setActorId } = useOperador();
  return <div className="cxp-topbar h-12 shrink-0 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-end gap-3">
    <div className="relative flex items-center flex-1 sm:flex-none">
      <Search size={15} className="absolute left-3 text-slate-400 pointer-events-none" aria-hidden="true" />
      <input type="search" aria-label="Buscar solicitud" placeholder="Buscar solicitud..." value={query}
        onChange={event => setQuery(event.target.value)}
        className="h-8 w-full sm:w-64 pl-9 pr-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all duration-150" />
    </div>
    {error && <span className="hidden md:inline text-xs text-red-600" role="alert">{error}</span>}
    {!error && !loading && !actor && <span className="hidden md:inline text-xs text-amber-700">Elige con qué usuario operas para poder guardar.</span>}
    <select id="cxp-operando-como" aria-label="Operando como" value={actor ? actorId : ''} disabled={loading || !!error}
      onChange={(event: ChangeEvent<HTMLSelectElement>) => setActorId(event.target.value)}
      className="h-8 w-48 sm:w-64 px-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100">
      <option value="">{loading ? 'Cargando usuarios…' : 'Operando como: seleccionar…'}</option>
      {usuarios.map(usuario => <option key={usuario.id} value={String(usuario.id)}>{`Operando como: ${usuario.nombre}`}</option>)}
    </select>
    <button type="button" title="Notificaciones" aria-label="Notificaciones"
      className="relative p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
      <Bell size={18} />
      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white animate-pulse" />
    </button>
  </div>;
}
