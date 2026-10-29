import { config } from '../../config';

/** Límite adicional por IP del socket. No se aceptan cabeceras X-Forwarded-For. */
const attempts = new Map<string, { count: number; until: number }>();

export function allowLoginAttempt(ip: string, now = Date.now()): boolean {
  const current = attempts.get(ip);
  if (!current || current.until <= now) {
    attempts.set(ip, { count: 1, until: now + config.auth.ipWindowMinutes * 60_000 });
  } else {
    current.count += 1;
  }
  if (attempts.size > 10_000) {
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  }
  return attempts.get(ip)!.count <= config.auth.ipMaxAttempts;
}

export function resetLimiterForTests(): void { attempts.clear(); }
