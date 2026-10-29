import { UserRound } from 'lucide-react';
import { RelationSelect } from '../../components/RelationSelect';
import { useOperadorId } from '../../operador/operador';

/**
 * Usuario que realiza las operaciones del flujo. Es el mismo usuario operativo de CXP
 * ("Operando como" en la barra superior): elegirlo aquí o allí cambia ambos. El ERP aún
 * no tiene inicio de sesión; el servidor exige que coincida, valida la autorización de
 * cada operación y la registra en el historial.
 */
export function useUsuarioOperacion(): [string, (value: string) => void] {
  return useOperadorId();
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
