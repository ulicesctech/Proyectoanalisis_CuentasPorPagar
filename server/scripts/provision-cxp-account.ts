/** Herramienta manual: no se ejecuta durante build, tests ni arranque. */
import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import argon2 from 'argon2';
import oracledb from 'oracledb';
import { config } from '../src/config';
import { initOraclePool, closeOraclePool, getConnection } from '../src/config/database';
import { actorDesdeUsuario } from '../src/modules/cxp/services/identidad';
import { findUsuarioOperativoWithConnection } from '../src/modules/cxp/repositories/control/usuario.repository';
import { ARGON2_OPTIONS } from '../src/modules/auth/store';
import { CxpError } from '../src/modules/cxp/services/errors';

class ProvisionError extends Error {}

async function hidden(label: string): Promise<string> {
  if (!stdin.isTTY || !stdin.setRawMode) throw new ProvisionError('La contraseña requiere una terminal interactiva');
  stdout.write(label);
  return new Promise((resolve, reject) => {
    let result = '';
    stdin.setRawMode(true);
    stdin.resume();
    const finish = (error?: Error) => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdout.write('\n');
      if (error) reject(error); else resolve(result);
    };
    const onData = (bytes: Buffer) => {
      for (const char of bytes.toString('utf8')) {
        if (char === '\r' || char === '\n') return finish();
        if (char === '\u0003') return finish(new ProvisionError('Cancelado'));
        if (char === '\u007f' || char === '\b') result = result.slice(0, -1);
        else if (char >= ' ' && result.length < 128) result += char;
      }
    };
    stdin.on('data', onData);
  });
}

async function main() {
  if (!stdin.isTTY || !stdout.isTTY) throw new ProvisionError('Ejecuta la herramienta en una terminal interactiva');
  if (!process.env.CXP_PROVISION_TARGET || process.env.CXP_PROVISION_TARGET !== config.oracleConnection.connectString) {
    throw new ProvisionError('CXP_PROVISION_TARGET debe coincidir exactamente con la base revisada por el administrador');
  }
  const rl = createInterface({ input: stdin, output: stdout });
  let username: string; let name: string; let userId: number; let securityRole: string;
  try {
    username = (await rl.question('USERNAME nuevo: ')).trim();
    name = (await rl.question('Nombre de la cuenta: ')).trim();
    userId = Number((await rl.question('USUARIO.USU_ID_USUARIO existente: ')).trim());
    securityRole = (await rl.question('SEG_USUARIOS.ROL (ADMIN, OPERADOR, CONSULTA): ')).trim().toUpperCase();
  } finally { rl.close(); }
  if (!/^[A-Za-z0-9._-]{1,50}$/.test(username) || !name || name.length > 120 ||
      !Number.isSafeInteger(userId) || userId <= 0 || !['ADMIN', 'OPERADOR', 'CONSULTA'].includes(securityRole)) {
    throw new ProvisionError('Datos de cuenta inválidos; no se ha conectado a Oracle');
  }
  const password = await hidden('Contraseña inicial (sin eco): ');
  const confirmation = await hidden('Repite la contraseña (sin eco): ');
  if (password.length < 12 || password.length > 128 || password !== confirmation) {
    throw new ProvisionError('Las contraseñas deben coincidir y tener entre 12 y 128 caracteres');
  }
  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);
  await initOraclePool();
  const connection = await getConnection();
  try {
    const oper = await findUsuarioOperativoWithConnection(connection, userId);
    if (!oper || !oper.rolActivo || oper.idRol == null) throw new ProvisionError('USUARIO inexistente, inactivo o sin rol activo');
    actorDesdeUsuario(oper); // detecta nombres de rol ambiguos
    const conflicts = await connection.execute<{ CUENTAS: number; VINCULOS: number }>(
      `SELECT (SELECT COUNT(*) FROM SEG_USUARIOS WHERE UPPER(TRIM(USERNAME)) = UPPER(TRIM(:username))) AS CUENTAS,
              (SELECT COUNT(*) FROM CXP_CUENTA_USUARIO WHERE USU_ID_USUARIO = :userId) AS VINCULOS FROM DUAL`,
      { username, userId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (Number(conflicts.rows?.[0]?.CUENTAS) !== 0 || Number(conflicts.rows?.[0]?.VINCULOS) !== 0) {
      throw new ProvisionError('El USERNAME o el USUARIO operativo ya tiene una asociación');
    }
    const inserted = await connection.execute<{ id: number[] }>(
      `INSERT INTO SEG_USUARIOS (USERNAME, NOMBRE, PASSWORD_HASH, ROL, ESTADO, DEBE_CAMBIAR_CLAVE)
       VALUES (:username, :name, :passwordHash, :securityRole, 'ACTIVO', 'S')
       RETURNING ID_USUARIO INTO :id`,
      { username, name, passwordHash, securityRole, id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } });
    const accountId = Number((inserted.outBinds as { id: number[] }).id[0]);
    await connection.execute(
      'INSERT INTO CXP_CUENTA_USUARIO (SEG_ID_USUARIO, USU_ID_USUARIO) VALUES (:accountId, :userId)',
      { accountId, userId });
    await connection.commit();
    stdout.write(`Cuenta creada y vinculada. SEG_ID_USUARIO=${accountId}; USU_ID_USUARIO=${userId}.\n`);
  } catch (error) { await connection.rollback(); throw error; }
  finally { await connection.close(); await closeOraclePool(); }
}

void main().catch(error => {
  console.error(error instanceof ProvisionError || error instanceof CxpError
    ? error.message : 'No se pudo aprovisionar; revisa estructura, datos y permisos en Oracle');
  process.exitCode = 1;
});
