import { useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../../../layouts/AuthLayout';
import { useAuth } from './session';

function Card({ title, children }: { title: string; children: ReactNode }) {
  return <AuthLayout><main className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
      <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Cuentas por pagar</p>
      <h1 className="mt-2 mb-6 text-2xl font-bold text-slate-900">{title}</h1>{children}
    </div>
  </main></AuthLayout>;
}

export function RequireCxpSession({ children }: { children: ReactNode }) {
  const { session, loading, error, refresh, logout } = useAuth();
  const location = useLocation();
  if (loading) return <Card title="Comprobando sesión"><p role="status">Un momento…</p></Card>;
  if (error) return <Card title="No se pudo comprobar la sesión"><p role="alert" className="text-sm text-red-700">{error}</p>
    <button className="mt-5 text-blue-700 underline" onClick={() => void refresh().catch(() => {})}>Reintentar</button>
  </Card>;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (session.mustChangePassword) return <Navigate to="/change-password" replace />;
  if (!session.actor) return <Card title="Acceso CXP denegado">
    <p className="text-sm text-slate-700">Tu cuenta no está vinculada a un usuario y rol CXP activos. Consulta al administrador.</p>
    <button className="mt-5 text-blue-700 underline" onClick={() => void logout().catch(() => {})}>Cerrar sesión</button>
  </Card>;
  return <>{children}</>;
}

export function LoginPage() {
  const { session, loading, error: sessionError, refresh, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requested = (location.state as { from?: unknown } | null)?.from;
  const returnTo = typeof requested === 'string' && (requested === '/cxp' || requested.startsWith('/cxp/')) && !requested.startsWith('//') ? requested : '/cxp';
  if (loading) return <Card title="Comprobando sesión"><p role="status">Un momento…</p></Card>;
  if (sessionError) return <Card title="No se pudo comprobar la sesión"><p role="alert" className="text-sm text-red-700">{sessionError}</p>
    <button className="mt-5 text-blue-700 underline" onClick={() => void refresh().catch(() => {})}>Reintentar</button>
  </Card>;
  if (session) return <Navigate to={session.mustChangePassword ? '/change-password' : returnTo} replace />;
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const next = await login(username.trim(), password);
      navigate(next?.mustChangePassword ? '/change-password' : returnTo, { replace: true });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo iniciar sesión'); }
    finally { setBusy(false); }
  }
  return <Card title="Iniciar sesión"><form onSubmit={submit} className="space-y-4">
    <label className="block text-sm font-medium">Usuario<input className="mt-1 w-full rounded-lg border border-slate-300 p-2" required maxLength={50}
      autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} /></label>
    <label className="block text-sm font-medium">Contraseña<input className="mt-1 w-full rounded-lg border border-slate-300 p-2" required type="password"
      autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></label>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <button disabled={busy} className="w-full rounded-lg bg-blue-700 p-2 font-semibold text-white disabled:opacity-60">{busy ? 'Verificando…' : 'Entrar'}</button>
  </form></Card>;
}

export function ChangePasswordPage() {
  const { session, loading, error: sessionError, refresh, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (loading) return <Card title="Comprobando sesión"><p role="status">Un momento…</p></Card>;
  if (sessionError) return <Card title="No se pudo comprobar la sesión"><p role="alert" className="text-sm text-red-700">{sessionError}</p>
    <button className="mt-5 text-blue-700 underline" onClick={() => void refresh().catch(() => {})}>Reintentar</button>
  </Card>;
  if (!session) return <Navigate to="/login" replace />;
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (next.length < 12 || next !== repeat) { setError('La nueva contraseña debe tener al menos 12 caracteres y coincidir.'); return; }
    setBusy(true);
    try { await changePassword(current, next); navigate('/cxp', { replace: true }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo cambiar la contraseña'); }
    finally { setBusy(false); }
  }
  return <Card title="Cambiar contraseña"><form onSubmit={submit} className="space-y-4">
    {session.mustChangePassword && <p className="text-sm text-slate-600">Debes cambiar la contraseña inicial antes de usar CXP.</p>}
    <label className="block text-sm">Contraseña actual<input className="mt-1 w-full rounded-lg border p-2" type="password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} /></label>
    <label className="block text-sm">Nueva contraseña<input className="mt-1 w-full rounded-lg border p-2" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={next} onChange={e => setNext(e.target.value)} /></label>
    <label className="block text-sm">Repetir contraseña<input className="mt-1 w-full rounded-lg border p-2" type="password" autoComplete="new-password" required value={repeat} onChange={e => setRepeat(e.target.value)} /></label>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <button disabled={busy} className="w-full rounded-lg bg-blue-700 p-2 font-semibold text-white disabled:opacity-60">Guardar contraseña</button>
    <button type="button" className="w-full text-sm text-slate-600 underline" onClick={() => void logout().then(() => navigate('/login', { replace: true })).catch(() => {})}>Cerrar sesión</button>
  </form></Card>;
}
