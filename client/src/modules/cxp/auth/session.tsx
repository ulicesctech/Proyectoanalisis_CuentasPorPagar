import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ActorProceso } from '@erp/contracts';
import { API_BASE_URL } from '../../../shared/api/base';

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
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/session`, { credentials: 'include', cache: 'no-store' });
      if (response.status === 401) {
        currentSession = null; setSession(null);
        setError(null);
        return null;
      }
      if (!response.ok) throw new Error((await readJson(response)).error ?? 'No se pudo comprobar la sesión');
      const data = await response.json() as CxpSession;
      currentSession = data; setSession(data);
      setError(null);
      return data;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo conectar con el servidor');
      throw reason;
    } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh().catch(() => { currentSession = null; setSession(null); setLoading(false); });
    const expired = () => { currentSession = null; setSession(null); setError(null); };
    window.addEventListener('cxp:session-expired', expired);
    return () => window.removeEventListener('cxp:session-expired', expired);
  }, [refresh]);
  const login = useCallback(async (username: string, password: string) => {
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
    try {
      if (currentSession) {
        const response = await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST', credentials: 'include', headers: { 'X-CSRF-Token': currentSession.csrfToken },
        });
        if (!response.ok && response.status !== 401) throw new Error((await readJson(response)).error ?? 'No se pudo cerrar sesión');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo cerrar sesión en el servidor');
      throw reason;
    }
    currentSession = null; setSession(null); setError(null);
  }, []);
  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': currentSession?.csrfToken ?? '' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (response.status === 401) { currentSession = null; setSession(null); }
    if (!response.ok) throw new Error((await readJson(response)).error ?? 'No se pudo cambiar la contraseña');
    await refresh();
  }, [refresh]);
  return <AuthContext.Provider value={{ session, loading, error, refresh, login, logout, changePassword }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider no disponible');
  return value;
}
