import 'dotenv/config';

/**
 * Modos de identidad de CXP. Solo existe el provisional: el usuario se declara con
 * X-CXP-Actor-Id y NO equivale a autenticación. Se agregará un modo con sesión
 * cuando el ERP defina el inicio de sesión.
 */
export const CXP_AUTH_MODES = ['provisional'] as const;
export type CxpAuthMode = (typeof CXP_AUTH_MODES)[number];

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

export function parseCxpAuthMode(raw: string | undefined, nodeEnv: string | undefined): CxpAuthMode {
  const mode = (raw?.trim() || 'provisional') as CxpAuthMode;
  if (!CXP_AUTH_MODES.includes(mode)) {
    throw new Error(`CXP_AUTH_MODE "${raw}" no es válido. Modos disponibles: ${CXP_AUTH_MODES.join(', ')}`);
  }
  if (mode === 'provisional' && nodeEnv === 'production') {
    throw new Error('CXP_AUTH_MODE=provisional no autentica usuarios y no puede usarse con NODE_ENV=production');
  }
  return mode;
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
  cxpAuthMode: parseCxpAuthMode(process.env.CXP_AUTH_MODE, process.env.NODE_ENV),

  oracleConnection: {
    user: process.env.NODE_ORACLEDB_USER || '',
    password: process.env.NODE_ORACLEDB_PASSWORD || '',
    connectString: process.env.NODE_ORACLEDB_CONNECTIONSTRING || '',
  },
};
