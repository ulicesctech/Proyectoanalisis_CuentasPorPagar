import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ActorProceso } from '@erp/contracts';
import { apiRequest } from '../../../shared/api';

/**
 * Usuario operativo de CXP ("Operando como"). Es la identidad PROVISIONAL que el
 * servidor recibe en X-CXP-Actor-Id: no es un inicio de sesión.
 * Se comparte entre todas las pantallas de CXP con la clave que ya usaba Procesos de pago.
 */
const KEY = 'cxp.actorId';
const EVENT = 'cxp:operador';

/** Los roles no se usan por ahora: `roles` llega vacío. */
export type UsuarioOperativo = ActorProceso;

let memoria = '';

export function getOperadorId(): string {
  try { return localStorage.getItem(KEY) ?? memoria; } catch { return memoria; }
}

export function setOperadorId(id: string): void {
  memoria = id;
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch { /* Sin almacenamiento: el valor se conserva en memoria. */ }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(listener: () => void) {
  window.addEventListener(EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}

export function useOperadorId(): [string, (id: string) => void] {
  return [useSyncExternalStore(subscribe, getOperadorId, () => ''), setOperadorId];
}

let usuariosCache: Promise<UsuarioOperativo[]> | null = null;

/** Lista de usuarios operativos (se carga una vez por sesión del navegador). */
export function cargarUsuariosOperativos(force = false): Promise<UsuarioOperativo[]> {
  if (!usuariosCache || force) {
    usuariosCache = apiRequest<UsuarioOperativo[]>('/cxp/procesos/usuarios-operativos')
      .catch(error => { usuariosCache = null; throw error; });
  }
  return usuariosCache;
}

export function useOperador() {
  const [actorId, setActorId] = useOperadorId();
  const [usuarios, setUsuarios] = useState<UsuarioOperativo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    cargarUsuariosOperativos()
      .then(rows => { if (active) { setUsuarios(rows); setError(''); } })
      .catch(() => { if (active) setError('No se pudieron cargar los usuarios operativos'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const actor = usuarios.find(usuario => String(usuario.id) === actorId) ?? null;
  return { actorId, actor, usuarios, loading, error, setActorId };
}
