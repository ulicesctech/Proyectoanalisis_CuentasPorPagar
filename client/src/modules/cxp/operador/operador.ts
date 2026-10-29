import type { ActorProceso } from '@erp/contracts';
import { sessionActorId, useAuth } from '../auth/session';

export type UsuarioOperativo = ActorProceso & { nombreRol?: string | null };

/** Identidad de la sesión: este módulo ya no permite seleccionar otro usuario. */
export function getOperadorId(): string { return String(sessionActorId() ?? ''); }

export function useOperadorId(): [string, (id: string) => void] {
  const { session } = useAuth();
  return [String(session?.actor?.id ?? ''), () => { /* El actor solo lo fija el servidor. */ }];
}

export function useOperador() {
  const { session, loading } = useAuth();
  const actor = session?.actor ?? null;
  return {
    actorId: String(actor?.id ?? ''), actor,
    usuarios: actor ? [actor] : [], loading,
    error: session && !actor ? 'Tu cuenta no está vinculada a un usuario CXP activo.' : '',
    setActorId: () => { /* No existe selección provisional. */ },
  };
}
