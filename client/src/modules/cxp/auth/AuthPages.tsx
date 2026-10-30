import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, Loader2, LockKeyhole, LogIn, LogOut, RefreshCw, ShieldAlert, TriangleAlert, UserRound, WifiOff } from 'lucide-react';
import { CxpButton } from '../components/CxpButton';
import { AuthField } from './AuthField';
import { AuthAlert, AuthCard, AuthShell } from './AuthShell';
import { useAuth } from './session';

/** fetch() sin respuesta del servidor: cada navegador usa un texto distinto. */
const NETWORK_ERROR = /load failed|failed to fetch|networkerror/i;
const NETWORK_MESSAGE = 'No hay conexión con el servidor. Verifica que esté en ejecución e inténtalo de nuevo.';
const readableError = (message: string) => NETWORK_ERROR.test(message) ? NETWORK_MESSAGE : message;
const SPIN = '[&>svg]:animate-spin motion-reduce:[&>svg]:animate-none';

function SessionChecking() {
  return <div role="status" className="flex flex-col items-center gap-3 py-16 text-sm text-slate-500">
    <Loader2 size={24} aria-hidden="true" className="animate-spin text-blue-600 motion-reduce:animate-none" />
    Comprobando sesión…
  </div>;
}

function SessionError({ message, onRetry }: { message: string; onRetry: () => Promise<unknown> }) {
  const [retrying, setRetrying] = useState(false);
  const readable = readableError(message);
  async function retry() {
    if (retrying) return;
    setRetrying(true);
    try { await onRetry(); } catch { /* El error queda visible en esta misma tarjeta. */ } finally { setRetrying(false); }
  }
  return <AuthCard title="No se pudo comprobar la sesión" icon={readable === message ? TriangleAlert : WifiOff} tone="danger"
    description={<p role="alert">{readable}</p>}>
    {readable !== message && <p className="mb-5 rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500">Detalle técnico: {message}</p>}
    <CxpButton variant="secondary" size="lg" fullWidth icon={retrying ? Loader2 : RefreshCw}
      aria-disabled={retrying || undefined} className={retrying ? SPIN : ''} onClick={() => void retry()}>
      {retrying ? 'Reintentando…' : 'Reintentar'}
    </CxpButton>
  </AuthCard>;
}

export function RequireCxpSession({ children }: { children: ReactNode }) {
  const { session, loading, error, refresh, logout } = useAuth();
  const location = useLocation();
  if (loading) return <AuthShell><SessionChecking /></AuthShell>;
  if (error) return <AuthShell><SessionError message={error} onRetry={refresh} /></AuthShell>;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (session.mustChangePassword) return <Navigate to="/change-password" replace />;
  if (!session.actor) return <AuthShell>
    <AuthCard title="Acceso CXP denegado" icon={ShieldAlert} tone="warning"
      description="Tu cuenta no está vinculada a un usuario y rol CXP activos. Consulta al administrador.">
      <CxpButton variant="secondary" size="lg" fullWidth icon={LogOut} onClick={() => void logout().catch(() => {})}>Cerrar sesión</CxpButton>
    </AuthCard>
  </AuthShell>;
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
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const requested = (location.state as { from?: unknown } | null)?.from;
  const returnTo = typeof requested === 'string' && (requested === '/cxp' || requested.startsWith('/cxp/')) && !requested.startsWith('//') ? requested : '/cxp';
  if (loading) return <AuthShell><SessionChecking /></AuthShell>;
  if (sessionError) return <AuthShell><SessionError message={sessionError} onRetry={refresh} /></AuthShell>;
  if (session) return <Navigate to={session.mustChangePassword ? '/change-password' : returnTo} replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const missing = {
      username: username.trim() ? undefined : 'Ingresa tu usuario.',
      password: password ? undefined : 'Ingresa tu contraseña.',
    };
    setFieldErrors(missing);
    if (missing.username || missing.password) {
      (missing.username ? usernameRef : passwordRef).current?.focus();
      return;
    }
    setError(''); setBusy(true);
    try {
      const next = await login(username.trim(), password);
      navigate(next?.mustChangePassword ? '/change-password' : returnTo, { replace: true });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo iniciar sesión'); }
    finally { setBusy(false); }
  }
  return <AuthShell>
    <AuthCard title="Iniciar sesión" description="Ingresa con tu usuario del ERP para acceder a Cuentas por Pagar.">
      <form onSubmit={submit} noValidate aria-busy={busy} className="space-y-5">
        {error && <AuthAlert>{readableError(error)}</AuthAlert>}
        <AuthField ref={usernameRef} label="Usuario" icon={UserRound} required maxLength={50} autoFocus
          autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          value={username} error={fieldErrors.username}
          onChange={event => { setUsername(event.target.value); setFieldErrors(current => ({ ...current, username: undefined })); }} />
        <AuthField ref={passwordRef} label="Contraseña" icon={LockKeyhole} type="password" revealable required
          autoComplete="current-password" value={password} error={fieldErrors.password}
          onChange={event => { setPassword(event.target.value); setFieldErrors(current => ({ ...current, password: undefined })); }} />
        <CxpButton type="submit" size="lg" fullWidth icon={busy ? Loader2 : LogIn}
          aria-disabled={busy || undefined} className={busy ? SPIN : ''}>
          {busy ? 'Verificando…' : 'Entrar'}
        </CxpButton>
      </form>
      <p className="mt-6 border-t border-slate-100 pt-5 text-center text-xs leading-relaxed text-slate-500">
        ¿No puedes entrar? Solicita acceso o el cambio de tu contraseña al administrador del sistema.
      </p>
    </AuthCard>
  </AuthShell>;
}

export function ChangePasswordPage() {
  const { session, loading, error: sessionError, refresh, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (loading) return <AuthShell><SessionChecking /></AuthShell>;
  if (sessionError) return <AuthShell><SessionError message={sessionError} onRetry={refresh} /></AuthShell>;
  if (!session) return <Navigate to="/login" replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (next.length < 12 || next !== repeat) { setError('La nueva contraseña debe tener al menos 12 caracteres y coincidir.'); return; }
    setBusy(true);
    try { await changePassword(current, next); navigate('/cxp', { replace: true }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo cambiar la contraseña'); }
    finally { setBusy(false); }
  }
  return <AuthShell>
    <AuthCard title="Cambiar contraseña" description={session.mustChangePassword
      ? 'Debes cambiar la contraseña inicial antes de usar CXP.'
      : 'Actualiza la contraseña con la que ingresas al ERP.'}>
      <form onSubmit={submit} aria-busy={busy} className="space-y-5">
        {error && <AuthAlert>{readableError(error)}</AuthAlert>}
        <AuthField label="Contraseña actual" icon={LockKeyhole} type="password" revealable required
          autoComplete="current-password" value={current} onChange={event => setCurrent(event.target.value)} />
        <AuthField label="Nueva contraseña" icon={KeyRound} type="password" revealable required minLength={12} maxLength={128}
          autoComplete="new-password" helperText="Entre 12 y 128 caracteres, distinta de la actual."
          value={next} onChange={event => setNext(event.target.value)} />
        <AuthField label="Repetir contraseña" icon={KeyRound} type="password" revealable required
          autoComplete="new-password" value={repeat} onChange={event => setRepeat(event.target.value)} />
        <div className="space-y-2 pt-1">
          <CxpButton type="submit" size="lg" fullWidth icon={busy ? Loader2 : KeyRound}
            aria-disabled={busy || undefined} className={busy ? SPIN : ''}>
            {busy ? 'Guardando…' : 'Guardar contraseña'}
          </CxpButton>
          <CxpButton variant="ghost" size="lg" fullWidth icon={LogOut}
            onClick={() => void logout().then(() => navigate('/login', { replace: true })).catch(() => {})}>
            Cerrar sesión
          </CxpButton>
        </div>
      </form>
    </AuthCard>
  </AuthShell>;
}
