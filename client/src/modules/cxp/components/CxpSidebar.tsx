import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Sidebar } from '../../../shared/ui-kit';
import { useAuth } from '../auth/session';
import { useCxpFormGuard } from './CxpFormGuard';

/** Compone el menú común sin editar su footer, que solo contiene un SVG sin acción. */
export function CxpSidebar({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  const { discard } = useCxpFormGuard();
  const actor = session?.actor;
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const user = {name:actor?.nombre ?? session?.name ?? 'Sin usuario CXP',role:actor?.nombreRol ?? 'Rol activo',initials:actor?.nombre.split(/\s+/).slice(0,2).map(s=>s[0]).join('') || 'CP'};
  const exit = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try { await logout(); navigate('/login',{replace:true}); }
    catch (reason) { setError(reason instanceof Error ? `No se pudo cerrar sesión: ${reason.message}. Puedes reintentar.` : 'No se pudo cerrar sesión. Puedes reintentar.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  return <div className="cxp-sidebar-wrap" data-mobile={mobile || undefined}>
    <Sidebar className="cxp-sidebar-base" activeModule="cuentas_pagar" user={user} onSelectModule={(module: string) => {
      onNavigate?.(); navigate(module === 'cuentas_pagar' ? '/cxp' : module === 'cuentas_cobrar' ? '/cxc/organizacion/empresas' : '/');
    }} />
    <footer className="shrink-0 border-t border-slate-800 bg-slate-900 p-4" aria-label="Sesión autenticada">
      <div className="flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-800/70 p-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-600 bg-slate-700 text-xs font-semibold text-slate-200" aria-hidden="true">{user.initials}</span>
        <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white" title={user.name}>{user.name}</p><p className="mt-0.5 truncate text-[11px] text-slate-400" title={user.role}>{user.role}</p></div>
        <button type="button" aria-label="Cerrar sesión" title={busy ? 'Cerrando sesión…' : 'Cerrar sesión'} disabled={busy} aria-busy={busy}
          className="rounded-md p-2 text-slate-400 hover:bg-slate-700 hover:text-red-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 disabled:cursor-wait disabled:opacity-50"
          onClick={() => void discard(() => void exit())}><LogOut size={16} aria-hidden="true" /></button>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-200">{error}</p>}
    </footer>
  </div>;
}
