import oracledb, { type Connection } from 'oracledb';
import argon2 from 'argon2';
import { getConnection } from '../../config/database';
import { config } from '../../config';
import { actorDesdeUsuario } from '../cxp/services/identidad';
import { findUsuarioOperativoWithConnection } from '../cxp/repositories/control/usuario.repository';
import { newSessionToken, sessionExpired, tokenMatches } from './session';

const OUT = { outFormat: oracledb.OUT_FORMAT_OBJECT } as const;
const INVALID = 'Usuario o contraseña incorrectos';
export const ARGON2_OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

type AccountRow = {
  ID_USUARIO: number; USERNAME: string; NOMBRE: string; PASSWORD_HASH: string;
  ESTADO: string; INTENTOS_FALLIDOS: number; BLOQUEADO_HASTA: Date | null;
  DEBE_CAMBIAR_CLAVE: string;
};
type SessionRow = AccountRow & {
  ID_SESION: string; TOKEN_HASH: string; FECHA_EXPIRA: Date;
  FECHA_ULTIMO_USO: Date; FECHA_REVOCADA: Date | null;
};

export type SessionIdentity = {
  accountId: number; username: string; name: string; mustChangePassword: boolean;
  actor: ReturnType<typeof actorDesdeUsuario> | null;
  roleName: string | null;
  sessionId: string; secret: string;
};

export class AuthFailure extends Error {
  constructor(message = INVALID, public status = 401) { super(message); }
}

async function linkedActor(connection: Connection, accountId: number) {
  const relation = await connection.execute<{ USU_ID_USUARIO: number }>(
    'SELECT USU_ID_USUARIO FROM CXP_CUENTA_USUARIO WHERE SEG_ID_USUARIO = :accountId',
    { accountId }, OUT);
  const id = relation.rows?.[0]?.USU_ID_USUARIO;
  if (!id) return { actor: null, roleName: null };
  const row = await findUsuarioOperativoWithConnection(connection, Number(id));
  if (!row || !row.rolActivo || row.idRol == null) return { actor: null, roleName: null };
  return { actor: actorDesdeUsuario(row), roleName: row.nombreRolNormalizado };
}

async function createSession(connection: Connection, accountId: number) {
  const token = newSessionToken();
  const expiry = new Date(Date.now() + config.auth.absoluteHours * 3_600_000);
  await connection.execute(
    `INSERT INTO SEG_SESIONES (ID_SESION, ID_USUARIO, TOKEN_HASH, FECHA_EXPIRA)
     VALUES (:id, :accountId, :hash, :expiry)`,
    { id: token.id, accountId, hash: token.hash, expiry });
  return token;
}

let dummyHash: Promise<string> | null = null;
function dummyPasswordHash() {
  dummyHash ??= argon2.hash('not-a-valid-password', ARGON2_OPTIONS);
  return dummyHash;
}

export async function loginAccount(username: string, password: string, connect = getConnection) {
  if (!username || username.length > 50 || !password || password.length > 1024) throw new AuthFailure();
  const connection = await connect();
  try {
    const result = await connection.execute<AccountRow>(
      `SELECT ID_USUARIO, USERNAME, NOMBRE, PASSWORD_HASH, ESTADO, INTENTOS_FALLIDOS,
              BLOQUEADO_HASTA, DEBE_CAMBIAR_CLAVE
         FROM SEG_USUARIOS WHERE UPPER(USERNAME) = UPPER(:username) FOR UPDATE`,
      { username: username.trim() }, OUT);
    const account = result.rows?.[0];
    if (!account) {
      await argon2.verify(await dummyPasswordHash(), password);
      throw new AuthFailure();
    }
    if (account.ESTADO !== 'ACTIVO' || account.BLOQUEADO_HASTA && new Date(account.BLOQUEADO_HASTA).getTime() > Date.now()) {
      throw new AuthFailure();
    }
    const supportedHash = /^\$argon2id\$v=19\$/.test(account.PASSWORD_HASH);
    if (!supportedHash) await argon2.verify(await dummyPasswordHash(), password);
    const valid = supportedHash && await argon2.verify(account.PASSWORD_HASH, password).catch(() => false);
    if (!valid) {
      const failures = account.BLOQUEADO_HASTA && new Date(account.BLOQUEADO_HASTA).getTime() <= Date.now()
        ? 1 : Number(account.INTENTOS_FALLIDOS) + 1;
      const locked = failures >= config.auth.maxFailures
        ? new Date(Date.now() + config.auth.lockMinutes * 60_000) : null;
      await connection.execute(
        `UPDATE SEG_USUARIOS SET INTENTOS_FALLIDOS = :failures, BLOQUEADO_HASTA = :locked
          WHERE ID_USUARIO = :accountId`, { failures, locked, accountId: account.ID_USUARIO });
      await connection.commit();
      throw new AuthFailure();
    }
    await connection.execute(
      `UPDATE SEG_USUARIOS SET INTENTOS_FALLIDOS = 0, BLOQUEADO_HASTA = NULL,
              ULTIMO_LOGIN = SYSTIMESTAMP WHERE ID_USUARIO = :accountId`,
      { accountId: account.ID_USUARIO });
    await connection.execute(
      `UPDATE SEG_SESIONES SET FECHA_REVOCADA = SYSTIMESTAMP, MOTIVO_REVOCACION = 'NUEVO_LOGIN'
        WHERE ID_USUARIO = :accountId AND FECHA_REVOCADA IS NULL`,
      { accountId: account.ID_USUARIO });
    const token = await createSession(connection, account.ID_USUARIO);
    await connection.commit();
    return token;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { await connection.close(); }
}

export async function sessionIdentity(id: string, secret: string, connect = getConnection): Promise<SessionIdentity | null> {
  const connection = await connect();
  try {
    const result = await connection.execute<SessionRow>(
      `SELECT S.ID_SESION, S.TOKEN_HASH, S.FECHA_EXPIRA, S.FECHA_ULTIMO_USO, S.FECHA_REVOCADA,
              U.ID_USUARIO, U.USERNAME, U.NOMBRE, U.PASSWORD_HASH, U.ESTADO,
              U.INTENTOS_FALLIDOS, U.BLOQUEADO_HASTA, U.DEBE_CAMBIAR_CLAVE
         FROM SEG_SESIONES S JOIN SEG_USUARIOS U ON U.ID_USUARIO = S.ID_USUARIO
        WHERE S.ID_SESION = :id`, { id }, OUT);
    const row = result.rows?.[0];
    if (!row || !tokenMatches(secret, row.TOKEN_HASH) || row.FECHA_REVOCADA ||
        row.ESTADO !== 'ACTIVO' || sessionExpired(new Date(row.FECHA_EXPIRA), new Date(row.FECHA_ULTIMO_USO))) return null;
    const linked = await linkedActor(connection, Number(row.ID_USUARIO));
    await connection.execute('UPDATE SEG_SESIONES SET FECHA_ULTIMO_USO = SYSTIMESTAMP WHERE ID_SESION = :id', { id });
    await connection.commit();
    return {
      accountId: Number(row.ID_USUARIO), username: row.USERNAME, name: row.NOMBRE,
      mustChangePassword: row.DEBE_CAMBIAR_CLAVE === 'S', ...linked, sessionId: id, secret,
    };
  } catch (error) { await connection.rollback(); throw error; }
  finally { await connection.close(); }
}

export async function revokeSession(id: string, connect = getConnection): Promise<void> {
  const connection = await connect();
  try {
    await connection.execute(
      `UPDATE SEG_SESIONES SET FECHA_REVOCADA = SYSTIMESTAMP, MOTIVO_REVOCACION = 'LOGOUT'
        WHERE ID_SESION = :id AND FECHA_REVOCADA IS NULL`, { id });
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { await connection.close(); }
}

export async function changeAccountPassword(identity: SessionIdentity, current: string, next: string, connect = getConnection) {
  if (next.length < 12 || next.length > 128 || next === current) {
    throw new AuthFailure('La nueva contraseña debe tener entre 12 y 128 caracteres y ser diferente', 400);
  }
  const connection = await connect();
  try {
    const result = await connection.execute<AccountRow>(
      'SELECT PASSWORD_HASH, ESTADO FROM SEG_USUARIOS WHERE ID_USUARIO = :id FOR UPDATE',
      { id: identity.accountId }, OUT);
    const account = result.rows?.[0];
    const hash = account?.PASSWORD_HASH;
    if (account?.ESTADO !== 'ACTIVO' || !hash || !/^\$argon2id\$v=19\$/.test(hash) || !await argon2.verify(hash, current).catch(() => false)) {
      throw new AuthFailure('La contraseña actual no es correcta');
    }
    const newHash = await argon2.hash(next, ARGON2_OPTIONS);
    await connection.execute(
      `UPDATE SEG_USUARIOS SET PASSWORD_HASH = :hash, DEBE_CAMBIAR_CLAVE = 'N',
              FECHA_CLAVE = SYSTIMESTAMP, INTENTOS_FALLIDOS = 0, BLOQUEADO_HASTA = NULL
        WHERE ID_USUARIO = :id`, { hash: newHash, id: identity.accountId });
    await connection.execute(
      `UPDATE SEG_SESIONES SET FECHA_REVOCADA = SYSTIMESTAMP, MOTIVO_REVOCACION = 'CAMBIO_CLAVE'
        WHERE ID_USUARIO = :id AND FECHA_REVOCADA IS NULL`, { id: identity.accountId });
    const token = await createSession(connection, identity.accountId);
    await connection.commit();
    return token;
  } catch (error) { await connection.rollback(); throw error; }
  finally { await connection.close(); }
}
