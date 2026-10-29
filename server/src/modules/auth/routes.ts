import { Router, type RequestHandler, type ErrorRequestHandler } from 'express';
import { config } from '../../config';
import { CxpError } from '../cxp/services/errors';
import { allowLoginAttempt } from './limiter';
import { changeAccountPassword, loginAccount, revokeSession, sessionIdentity, type SessionIdentity, AuthFailure } from './store';
import { clearSessionCookie, csrfFor, csrfMatches, readSessionCookie, setSessionCookie } from './session';

const router = Router();

export const requireAllowedOrigin: RequestHandler = (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.header('Origin');
  if (!origin || !config.corsOrigins.includes(origin)) return next(new CxpError('Origen de petición no permitido', 403));
  next();
};

export const requireSession: RequestHandler = async (req, res, next) => {
  try {
    const cookie = readSessionCookie(req);
    if (!cookie) throw new CxpError('Inicia sesión para continuar', 401);
    const identity = await sessionIdentity(cookie.id, cookie.secret);
    if (!identity) throw new CxpError('La sesión venció o fue revocada', 401);
    res.locals.authSession = identity;
    res.setHeader('Cache-Control', 'no-store');
    next();
  } catch (error) { next(error); }
};

export function authSession(res: { locals: Record<string, unknown> }): SessionIdentity {
  const identity = res.locals.authSession as SessionIdentity | undefined;
  if (!identity) throw new CxpError('Inicia sesión para continuar', 401);
  return identity;
}

export const requireCsrf: RequestHandler = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (!csrfMatches(authSession(res).secret, req.header('X-CSRF-Token'))) {
    return next(new CxpError('Token CSRF inválido', 403));
  }
  next();
};

export const requireCxpSession: RequestHandler = (req, res, next) => {
  try {
    if (req.header('X-CXP-Actor-Id') !== undefined || req.query.actorId !== undefined) {
      throw new CxpError('La identidad se obtiene exclusivamente de la sesión', 403);
    }
    const identity = authSession(res);
    if (identity.mustChangePassword) throw new CxpError('Debes cambiar tu contraseña antes de continuar', 403);
    if (!identity.actor || identity.actor.roles.length === 0) {
      throw new CxpError('La cuenta no está vinculada con un usuario y rol CXP activos', 403);
    }
    res.locals.cxpActor = identity.actor;
    next();
  } catch (error) { next(error); }
};

router.use(requireAllowedOrigin);
router.post('/login', async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    if (!allowLoginAttempt(req.socket.remoteAddress ?? 'unknown')) {
      throw new CxpError('Demasiados intentos. Inténtalo más tarde', 429);
    }
    const username = typeof req.body?.username === 'string' ? req.body.username : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const token = await loginAccount(username, password);
    setSessionCookie(res, token.value);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.use(requireSession);
router.get('/session', (_req, res) => {
  const identity = authSession(res);
  res.json({ username: identity.username, name: identity.name,
    mustChangePassword: identity.mustChangePassword,
    actor: identity.actor ? { ...identity.actor, nombreRol: identity.roleName } : null,
    csrfToken: csrfFor(identity.secret) });
});
router.post('/logout', requireCsrf, async (_req, res, next) => {
  try {
    await revokeSession(authSession(res).sessionId);
    clearSessionCookie(res);
    res.status(204).send();
  } catch (error) { next(error); }
});
router.post('/change-password', requireCsrf, async (req, res, next) => {
  try {
    if (!allowLoginAttempt(req.socket.remoteAddress ?? 'unknown')) {
      throw new CxpError('Demasiados intentos. Inténtalo más tarde', 429);
    }
    const current = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const nextPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    const token = await changeAccountPassword(authSession(res), current, nextPassword);
    setSessionCookie(res, token.value);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

export const authErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof AuthFailure || error instanceof CxpError) {
    res.status(error.status).json({ error: error.message });
  } else next(error);
};

export default router;
