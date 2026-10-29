import assert from 'node:assert/strict';
import test from 'node:test';
import argon2 from 'argon2';
import type { Connection } from 'oracledb';
import type { Request, Response, NextFunction } from 'express';
import { changeAccountPassword, loginAccount, revokeSession, sessionIdentity } from './store';
import { csrfFor, csrfMatches, hashToken, newSessionToken, sessionExpired, tokenMatches } from './session';
import { requireAllowedOrigin, requireCsrf, requireCxpSession, requireSession } from './routes';
import { allowLoginAttempt, resetLimiterForTests } from './limiter';
import { config } from '../../config';

class FakeOracle {
  passwordHash = '';
  failures = 0;
  locked: Date | null = null;
  active = true;
  mustChange = 'S';
  link = 7;
  userActive = true;
  roleActive = true;
  sessions = new Map<string, { hash: string; expiry: Date; last: Date; revoked: Date | null }>();
  committed = 0;
  connection = {
    execute: async (sql: string, binds: Record<string, unknown> = {}) => {
      if (sql.includes('FROM SEG_USUARIOS WHERE UPPER(USERNAME)')) {
        return { rows: binds.username === 'test' ? [this.account()] : [] };
      }
      if (sql.includes('FROM SEG_SESIONES S JOIN SEG_USUARIOS')) {
        const item = this.sessions.get(String(binds.id));
        return { rows: item ? [{ ...this.account(), ID_SESION: binds.id, TOKEN_HASH: item.hash,
          FECHA_EXPIRA: item.expiry, FECHA_ULTIMO_USO: item.last, FECHA_REVOCADA: item.revoked }] : [] };
      }
      if (sql.includes('FROM CXP_CUENTA_USUARIO')) return { rows: this.link ? [{ USU_ID_USUARIO: this.link }] : [] };
      if (sql.includes('FROM USUARIO U')) return { rows: this.userActive ? [{ ID: 7, NOMBRE: 'Operadora', ID_ROL: 32,
        ROL_ACTIVO: this.roleActive ? 1 : 0, NOMBRE_ROL_NORMALIZADO: 'OPERADOR_CXP', COINCIDENCIAS_NOMBRE_ROL: 1 }] : [] };
      if (sql.includes('SELECT PASSWORD_HASH, ESTADO FROM SEG_USUARIOS')) return { rows: [{ PASSWORD_HASH: this.passwordHash, ESTADO: this.active ? 'ACTIVO' : 'INACTIVO' }] };
      if (sql.includes('SET INTENTOS_FALLIDOS = :failures')) { this.failures = Number(binds.failures); this.locked = binds.locked as Date | null; }
      if (sql.includes('SET INTENTOS_FALLIDOS = 0')) { this.failures = 0; this.locked = null; }
      if (sql.includes('SET PASSWORD_HASH = :hash')) { this.passwordHash = String(binds.hash); this.mustChange = 'N'; }
      if (sql.includes('INSERT INTO SEG_SESIONES')) this.sessions.set(String(binds.id), {
        hash: String(binds.hash), expiry: binds.expiry as Date, last: new Date(), revoked: null,
      });
      if (sql.includes('FECHA_ULTIMO_USO = SYSTIMESTAMP')) this.sessions.get(String(binds.id))!.last = new Date();
      if (sql.includes('FECHA_REVOCADA = SYSTIMESTAMP') && sql.includes('ID_USUARIO = :accountId')) {
        for (const item of this.sessions.values()) item.revoked = new Date();
      }
      if (sql.includes('FECHA_REVOCADA = SYSTIMESTAMP') && sql.includes('ID_USUARIO = :id')) {
        for (const item of this.sessions.values()) item.revoked = new Date();
      }
      if (sql.includes('FECHA_REVOCADA = SYSTIMESTAMP') && sql.includes('ID_SESION = :id')) {
        this.sessions.get(String(binds.id))!.revoked = new Date();
      }
      return { rows: [] };
    },
    commit: async () => { this.committed += 1; },
    rollback: async () => {}, close: async () => {},
  } as unknown as Connection;
  connect = async () => this.connection;
  account() { return { ID_USUARIO: 12, USERNAME: 'test', NOMBRE: 'Cuenta', PASSWORD_HASH: this.passwordHash,
    ESTADO: this.active ? 'ACTIVO' : 'INACTIVO', INTENTOS_FALLIDOS: this.failures,
    BLOQUEADO_HASTA: this.locked, DEBE_CAMBIAR_CLAVE: this.mustChange }; }
}

test('Argon2id: contraseña válida crea token nuevo; inválida aumenta contador y bloquea', async () => {
  const db = new FakeOracle();
  db.passwordHash = await argon2.hash('clave-inicial-larga', { type: argon2.argon2id });
  for (let i = 1; i <= config.auth.maxFailures; i += 1) {
    await assert.rejects(loginAccount('test', 'incorrecta', db.connect), { status: 401 });
    assert.equal(db.failures, i);
  }
  assert.ok(db.locked);
  await assert.rejects(loginAccount('test', 'clave-inicial-larga', db.connect), { status: 401 });
  db.locked = new Date(Date.now() - 1000);
  const token = await loginAccount('test', 'clave-inicial-larga', db.connect);
  assert.ok(db.sessions.has(token.id));
  assert.notEqual(db.sessions.get(token.id)!.hash, token.secret);
  assert.equal(db.failures, 0);
  assert.equal((await sessionIdentity(token.id, token.secret, db.connect))?.actor?.id, 7);
  assert.equal((await sessionIdentity(token.id, token.secret, db.connect))?.mustChangePassword, true);
});

test('cuenta sin vínculo, usuario o rol inactivo no produce actor CXP', async () => {
  const db = new FakeOracle();
  db.passwordHash = await argon2.hash('clave-inicial-larga', { type: argon2.argon2id });
  const token = await loginAccount('test', 'clave-inicial-larga', db.connect);
  db.link = 0;
  assert.equal((await sessionIdentity(token.id, token.secret, db.connect))?.actor, null);
  db.link = 7; db.userActive = false;
  assert.equal((await sessionIdentity(token.id, token.secret, db.connect))?.actor, null);
  db.userActive = true; db.roleActive = false;
  assert.equal((await sessionIdentity(token.id, token.secret, db.connect))?.actor, null);
  db.roleActive = true; db.active = false;
  assert.equal(await sessionIdentity(token.id, token.secret, db.connect), null);
});

test('hash desconocido y sesión vencida se rechazan', async () => {
  const db = new FakeOracle();
  db.passwordHash = 'texto-plano-no-permitido';
  await assert.rejects(loginAccount('test', 'texto-plano-no-permitido', db.connect), { status: 401 });
  db.passwordHash = await argon2.hash('clave-inicial-larga', { type: argon2.argon2id });
  const token = await loginAccount('test', 'clave-inicial-larga', db.connect);
  db.sessions.get(token.id)!.expiry = new Date(Date.now() - 1);
  assert.equal(await sessionIdentity(token.id, token.secret, db.connect), null);
});

test('cambio obligatorio rota la sesión y logout revoca el token', async () => {
  const db = new FakeOracle();
  db.passwordHash = await argon2.hash('clave-inicial-larga', { type: argon2.argon2id });
  const old = await loginAccount('test', 'clave-inicial-larga', db.connect);
  const identity = (await sessionIdentity(old.id, old.secret, db.connect))!;
  await assert.rejects(changeAccountPassword(identity, 'mala', 'otra-clave-muy-larga', db.connect), { status: 401 });
  const next = await changeAccountPassword(identity, 'clave-inicial-larga', 'otra-clave-muy-larga', db.connect);
  assert.notEqual(next.id, old.id);
  assert.equal(await sessionIdentity(old.id, old.secret, db.connect), null);
  assert.equal((await sessionIdentity(next.id, next.secret, db.connect))?.mustChangePassword, false);
  await revokeSession(next.id, db.connect);
  assert.equal(await sessionIdentity(next.id, next.secret, db.connect), null);
});

test('tokens, expiración, CSRF y límite por IP', () => {
  const token = newSessionToken();
  assert.equal(hashToken(token.secret), token.hash);
  assert.ok(tokenMatches(token.secret, token.hash));
  assert.equal(tokenMatches('otro', token.hash), false);
  assert.ok(csrfMatches(token.secret, csrfFor(token.secret)));
  assert.equal(csrfMatches(token.secret, csrfFor('otro')), false);
  assert.equal(sessionExpired(new Date(Date.now() - 1000), new Date()), true);
  assert.equal(sessionExpired(new Date(Date.now() + 60_000), new Date(Date.now() - (config.auth.idleMinutes + 1) * 60_000)), true);
  resetLimiterForTests();
  for (let n = 0; n < config.auth.ipMaxAttempts; n += 1) assert.equal(allowLoginAttempt('127.0.0.1'), true);
  assert.equal(allowLoginAttempt('127.0.0.1'), false);
  assert.equal(allowLoginAttempt('127.0.0.2'), true);
});

async function run(handler: (req: Request, res: Response, next: NextFunction) => unknown,
  request: Record<string, unknown>, locals: Record<string, unknown> = {}) {
  return new Promise<unknown>(resolve => {
    void handler(request as unknown as Request, { locals, setHeader() {} } as unknown as Response, error => resolve(error));
  });
}

test('sin cookie se deniega; CSRF, origen y suplantación se rechazan', async () => {
  const session = { secret: newSessionToken().secret, mustChangePassword: false,
    actor: { id: 7, roles: [32], permisos: ['CREAR'] } };
  assert.equal((await run(requireSession, { headers: {} }) as { status: number }).status, 401);
  assert.equal((await run(requireAllowedOrigin, { method: 'POST', header: () => 'https://otro.example' }) as { status: number }).status, 403);
  assert.equal((await run(requireCsrf, { method: 'POST', header: () => 'mal' }, { authSession: session }) as { status: number }).status, 403);
  assert.equal((await run(requireCsrf, { method: 'POST', header: () => csrfFor(session.secret) }, { authSession: session })), undefined);
  assert.equal((await run(requireCxpSession, { header: () => '99', query: {} }, { authSession: session }) as { status: number }).status, 403);
  assert.equal((await run(requireCxpSession, { header: () => undefined, query: { actorId: '99' } }, { authSession: session }) as { status: number }).status, 403);
  assert.equal((await run(requireCxpSession, { header: () => undefined, query: {} }, { authSession: { ...session, actor: null } }) as { status: number }).status, 403);
  assert.equal((await run(requireCxpSession, { header: () => undefined, query: {} }, { authSession: { ...session, mustChangePassword: true } }) as { status: number }).status, 403);
});
