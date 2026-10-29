import 'dotenv/config';

const DEFAULT_CORS_ORIGINS = 'http://localhost:5173';
const DEFAULT_HOST = '127.0.0.1';

/** Lista de orígenes separados por coma; cada uno debe ser un origen exacto (sin ruta). */
export function parseCorsOrigins(raw: string | undefined): string[] {
  const values = (raw?.trim() ? raw : DEFAULT_CORS_ORIGINS).split(',').map(value => value.trim()).filter(Boolean);
  if (!values.length) throw new Error('CORS_ORIGINS debe indicar al menos un origen');
  for (const value of values) {
    let origin: string;
    try { origin = new URL(value).origin; }
    catch { throw new Error(`CORS_ORIGINS contiene un origen inválido: ${value}`); }
    if (origin !== value) throw new Error(`CORS_ORIGINS debe usar orígenes exactos como ${origin} (sin ruta ni barra final): ${value}`);
  }
  return values;
}

export function parsePositiveInteger(raw: string | undefined, fallback: number, name: string): number {
  const value = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} debe ser un entero positivo`);
  return value;
}

export function parsePort(raw: string | undefined): number {
  const port = raw?.trim() ? Number(raw) : 3000;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`PORT debe ser un entero entre 1 y 65535: ${raw}`);
  return port;
}

// Configuración global de variables de entorno y constantes del backend
export const config = {
  port: parsePort(process.env.PORT),
  /** 127.0.0.1 solo acepta conexiones del mismo equipo; usa 0.0.0.0 para la red local. */
  host: process.env.HOST?.trim() || DEFAULT_HOST,
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
  auth: {
    cookieSecure: process.env.AUTH_ALLOW_INSECURE_HTTP !== 'true',
    idleMinutes: parsePositiveInteger(process.env.AUTH_IDLE_MINUTES, 30, 'AUTH_IDLE_MINUTES'),
    absoluteHours: parsePositiveInteger(process.env.AUTH_ABSOLUTE_HOURS, 8, 'AUTH_ABSOLUTE_HOURS'),
    maxFailures: parsePositiveInteger(process.env.AUTH_MAX_FAILURES, 5, 'AUTH_MAX_FAILURES'),
    lockMinutes: parsePositiveInteger(process.env.AUTH_LOCK_MINUTES, 15, 'AUTH_LOCK_MINUTES'),
    ipMaxAttempts: parsePositiveInteger(process.env.AUTH_IP_MAX_ATTEMPTS, 20, 'AUTH_IP_MAX_ATTEMPTS'),
    ipWindowMinutes: parsePositiveInteger(process.env.AUTH_IP_WINDOW_MINUTES, 15, 'AUTH_IP_WINDOW_MINUTES'),
  },

  oracleConnection: {
    user: process.env.NODE_ORACLEDB_USER || '',
    password: process.env.NODE_ORACLEDB_PASSWORD || '',
    connectString: process.env.NODE_ORACLEDB_CONNECTIONSTRING || '',
  },
};

if (process.env.NODE_ENV === 'production' && !config.auth.cookieSecure) {
  throw new Error('AUTH_ALLOW_INSECURE_HTTP no está permitido en producción');
}
if (process.env.CXP_AUTH_MODE && process.env.CXP_AUTH_MODE !== 'session') {
  throw new Error('CXP_AUTH_MODE provisional fue retirado; CXP requiere sesiones');
}
if (!config.auth.cookieSecure && (
  !['127.0.0.1', 'localhost'].includes(config.host) ||
  config.corsOrigins.some(origin => !['localhost', '127.0.0.1'].includes(new URL(origin).hostname))
)) throw new Error('AUTH_ALLOW_INSECURE_HTTP solo se permite con HOST y CORS_ORIGINS locales');
