import { createContext, Fragment, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ActorProceso } from '@erp/contracts';
import { API_BASE_URL } from '../../../shared/api/base';
import { clearSessionScope } from './sessionScope';

export type CxpSession = {
  username: string; name: string; mustChangePassword: boolean;
  actor: (ActorProceso & { nombreRol: string | null }) | null;
  csrfToken: string;
};

let currentSession: CxpSession | null = null;
export const sessionActorId = () => currentSession?.actor?.id ?? null;
export const sessionCsrfToken = () => currentSession?.csrfToken ?? null;

type AuthContextValue = {
  session: CxpSession | null; loading: boolean; error: string | null;
  refresh: () => Promise<CxpSession | null>;
  login: (username: string, password: string) => Promise<CxpSession | null>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

async function readJson(response: Response): Promise<{ error?: string }> {
  return response.json().catch(() => ({}));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CxpSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const logoutTask = useRef<Promise<void> | null>(null);
  const install = useCallback((next: CxpSession | null) => {
    if (currentSession?.username !== next?.username || currentSession?.csrfToken !== next?.csrfToken || currentSession?.actor?.id !== next?.actor?.id) clearSessionScope();
    currentSession = next; setSession(next); setError(null);
  }, []);
  const refresh = useCallback(async () => {
    const requestGeneration = generation.current;
    try {
      const response = await fetch(`${API_BASE_URL}/auth/session`, { credentials: 'include', cache: 'no-store' });
      if (requestGeneration !== generation.current) return currentSession;
      if (response.status === 401) {
        install(null);
        return null;
      }
      if (!response.ok) throw new Error((await readJson(response)).error ?? 'No se pudo comprobar la sesión');
      const data = await response.json() as CxpSession;
      if (requestGeneration !== generation.current) return currentSession;
      install(data);
      return data;
    } catch (reason) {
      if (requestGeneration !== generation.current) return currentSession;
      setError(reason instanceof Error ? reason.message : 'No se pudo conectar con el servidor');
      throw reason;
    } finally { if (requestGeneration === generation.current) setLoading(false); }
  }, [install]);
  useEffect(() => {
    void refresh().catch(() => { currentSession = null; setSession(null); setLoading(false); });
    const expired = () => { generation.current += 1; clearSessionScope(); install(null); setLoading(false); };
    window.addEventListener('cxp:session-expired', expired);
    return () => window.removeEventListener('cxp:session-expired', expired);
  }, [refresh]);
  const login = useCallback(async (username: string, password: string) => {
    generation.current += 1; clearSessionScope();
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) throw new Error((await readJson(response)).error ?? 'No se pudo iniciar sesión');
    const verified = await refresh();
    if (!verified) throw new Error('El servidor no conservó la sesión. Comprueba HTTPS y la configuración de cookies.');
    return verified;
  }, [refresh]);
  const logout = useCallback(async () => {
    if (logoutTask.current) return logoutTask.current;
    generation.current += 1;
    const task = (async () => {
      if (currentSession) {
        const response = await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST', credentials: 'include', headers: { 'X-CSRF-Token': currentSession.csrfToken },
        });
        if (!response.ok && response.status !== 401) throw new Error((await readJson(response)).error ?? 'No se pudo cerrar sesión');
      }
      clearSessionScope(); install(null); setLoading(false);
    })();
    logoutTask.current = task;
    try { await task; } finally { logoutTask.current = null; }
  }, [install]);
  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': currentSession?.csrfToken ?? '' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (response.status === 401) { generation.current += 1; clearSessionScope(); install(null); }
    if (!response.ok) throw new Error((await readJson(response)).error ?? 'No se pudo cambiar la contraseña');
    await refresh();
  }, [refresh, install]);
  return <AuthContext.Provider value={{ session, loading, error, refresh, login, logout, changePassword }}><Fragment key={session?.csrfToken ?? 'sin-sesion'}>{children}</Fragment></AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider no disponible');
  return value;
}
