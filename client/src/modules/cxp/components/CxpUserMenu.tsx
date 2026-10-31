import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, KeyRound, LogOut } from 'lucide-react';
import { useAuth } from '../auth/session';
import { useOperador } from '../operador/operador';
import { useCxpFormGuard } from './CxpFormGuard';
import { iniciales, nombreLegible, rolLegible } from '../operador/formato';
import './CxpCommandPalette.css';

const ITEM = 'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm outline-none transition-colors duration-150 focus-visible:bg-slate-100 hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60';

/** Menú de la cuenta: identidad de la sesión, cambio de contraseña y cierre de sesión. */
export function CxpUserMenu() {
  const { actor } = useOperador();
  const { logout } = useAuth();
  const { discard } = useCxpFormGuard();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const saliendoRef = useRef(false);
  const [error, setError] = useState('');
  const botonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const nombre = nombreLegible(actor?.nombre) || 'Usuario CXP';
  const rol = rolLegible(actor?.nombreRol);

  useEffect(() => {
    if (!open) return;
    const fuera = (event: PointerEvent) => {
      const destino = event.target as Node;
      // La confirmación se dibuja en un portal; conservar el menú para mostrar un fallo de logout.
      if (destino instanceof Element && destino.closest('[data-cxp-confirm]')) return;
      if (!menuRef.current?.contains(destino) && !botonRef.current?.contains(destino)) setOpen(false);
    };
    document.addEventListener('pointerdown', fuera);
    const foco = window.requestAnimationFrame(() => menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
    return () => {
      document.removeEventListener('pointerdown', fuera);
      window.cancelAnimationFrame(foco);
    };
  }, [open]);

  const cerrar = (devolverFoco = true) => {
    setOpen(false);
    if (devolverFoco) botonRef.current?.focus();
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
    if (!items.length) return;
    const actual = items.indexOf(document.activeElement as HTMLElement);
    const enfocar = (indice: number) => items[(indice + items.length) % items.length]?.focus();
    if (event.key === 'ArrowDown') { event.preventDefault(); enfocar(actual + 1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); enfocar(actual - 1); }
    else if (event.key === 'Home') { event.preventDefault(); enfocar(0); }
    else if (event.key === 'End') { event.preventDefault(); enfocar(items.length - 1); }
    else if (event.key === 'Escape') { event.preventDefault(); cerrar(); }
    else if (event.key === 'Tab') cerrar(false);
  };

  const cerrarSesion = async () => {
    if (saliendoRef.current) return;
    saliendoRef.current = true;
    setSaliendo(true);
    setError('');
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? `No se pudo cerrar sesión: ${reason.message}. Puedes reintentar.` : 'No se pudo cerrar sesión. Puedes reintentar.');
    } finally { saliendoRef.current = false; setSaliendo(false); }
  };

  return <div className="relative">
    <button ref={botonRef} type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
      aria-label={`Cuenta de ${nombre}, ${rol}`}
      onClick={() => setOpen(valor => !valor)}
      onKeyDown={event => { if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !open) { event.preventDefault(); setOpen(true); } }}
      className="flex h-11 cursor-pointer items-center gap-2.5 rounded-xl py-1 pl-1 pr-2 transition-colors duration-150 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
      <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white shadow-sm shadow-blue-600/30">
        {iniciales(actor?.nombre)}
      </span>
      <ChevronDown size={16} aria-hidden="true" className={`text-slate-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div ref={menuRef} id={menuId} role="menu" aria-label="Opciones de la cuenta" onKeyDown={onMenuKeyDown}
      className="cxp-menu-enter absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
      <div role="none" className="mb-1 border-b border-slate-100 px-3 pb-2.5 pt-2">
        <p className="truncate text-sm font-semibold text-slate-900">{nombre}</p>
        <p className="truncate text-xs text-slate-500">{rol}</p>
      </div>
      <Link role="menuitem" tabIndex={-1} to="/change-password" onClick={() => setOpen(false)} className={`${ITEM} text-slate-700`}>
        <KeyRound size={16} aria-hidden="true" className="text-slate-400" />Cambiar contraseña
      </Link>
      <button role="menuitem" type="button" tabIndex={-1} disabled={saliendo} aria-busy={saliendo} onClick={() => void discard(() => void cerrarSesion())}
        className={`${ITEM} text-red-700 hover:bg-red-50 focus-visible:bg-red-50`}>
        <LogOut size={16} aria-hidden="true" />{saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}
      </button>
      {error && <p role="alert" className="px-3 py-2 text-xs text-red-700">{error}</p>}
    </div>}
  </div>;
}
