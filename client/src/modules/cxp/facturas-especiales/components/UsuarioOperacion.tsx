import { UserRound } from 'lucide-react';
import { useOperador, useOperadorId } from '../../operador/operador';

export function useUsuarioOperacion(): [string, (value: string) => void] { return useOperadorId(); }

export function UsuarioOperacion() {
  const { actor } = useOperador();
  return <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
    <div className="p-2 bg-blue-50 text-blue-700 rounded-lg"><UserRound size={18} /></div>
    <div><p className="text-sm font-semibold text-slate-900">Usuario de la operación</p>
      <p className="text-sm text-slate-600">{actor?.nombre ?? 'Sin identidad CXP'} · {actor?.nombreRol ?? 'Rol activo'}</p></div>
  </div>;
}

export function UsuarioOperacionCampo() {
  const { actor } = useOperador();
  return <p className="text-sm text-slate-600">Registra: {actor?.nombre ?? 'Sin identidad CXP'}</p>;
}
