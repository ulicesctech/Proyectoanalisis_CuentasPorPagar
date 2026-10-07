import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { RelationSelect } from '../../components/RelationSelect';

const KEY = 'cxp.facturasEspeciales.usuario';
const EVENT = 'cxp-usuario-operacion';

function leer(): string {
  try { return sessionStorage.getItem(KEY) ?? ''; } catch { return ''; }
}

/**
 * Usuario que realiza las operaciones del flujo. El ERP aún no tiene inicio de sesión,
 * así que se elige del catálogo común USUARIO (como en creadoPor/modificadoPor del resto
 * de CXP) y se recuerda durante la sesión del navegador. El servidor valida la
 * autorización de cada operación y la registra en el historial.
 */
export function useUsuarioOperacion(): [string, (value: string) => void] {
  const [usuario, setUsuario] = useState(leer);
  useEffect(() => {
    const sync = () => setUsuario(leer());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  const cambiar = (value: string) => {
    try { sessionStorage.setItem(KEY, value); } catch { /* el valor se conserva solo en memoria */ }
    setUsuario(value);
    window.dispatchEvent(new Event(EVENT));
  };
  return [usuario, cambiar];
}

export function UsuarioOperacion() {
  const [usuario, setUsuario] = useUsuarioOperacion();
  return <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-start gap-4">
    <div className="flex items-center gap-3 min-w-56 flex-1">
      <div className="p-2 bg-blue-50 text-blue-700 rounded-lg shrink-0"><UserRound size={18} /></div>
      <div>
        <p className="text-sm font-semibold text-slate-900">Usuario de la operación</p>
        <p className="text-xs text-slate-500">Queda registrado como responsable en el historial. La aprobación solo la pueden realizar usuarios autorizados.</p>
      </div>
    </div>
    <div className="w-full sm:w-96"><RelationSelect id="fe-usuario" catalog="usuarios" label="Usuario" required value={usuario} onChange={setUsuario} /></div>
  </div>;
}

/** Campo compacto para elegir el usuario desde un formulario o diálogo si aún no se eligió. */
export function UsuarioOperacionCampo() {
  const [usuario, setUsuario] = useUsuarioOperacion();
  if (usuario) return null;
  return <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
    <RelationSelect id="fe-usuario-campo" catalog="usuarios" label="Usuario que realiza la operación" required value={usuario} onChange={setUsuario} />
  </div>;
}
