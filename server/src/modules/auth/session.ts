import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { config } from '../../config';

export const COOKIE_NAME = config.auth.cookieSecure ? '__Host-cxp_session' : 'cxp_session';
const TOKEN_PATTERN = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/;

export function newSessionToken() {
  const id = randomUUID();
  const secret = randomBytes(32).toString('base64url');
  return { id, secret, value: `${id}.${secret}`, hash: hashToken(secret) };
}

export function hashToken(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function readSessionCookie(req: Request): { id: string; secret: string } | null {
  const raw = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE_NAME}=`));
  if (!raw) return null;
  const match = TOKEN_PATTERN.exec(raw.slice(COOKIE_NAME.length + 1));
  return match ? { id: match[1], secret: match[2] } : null;
}

export function tokenMatches(secret: string, storedHash: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(storedHash)) return false;
  return timingSafeEqual(Buffer.from(hashToken(secret), 'hex'), Buffer.from(storedHash, 'hex'));
}

export function csrfFor(secret: string): string {
  return createHmac('sha256', Buffer.from(secret, 'base64url')).update('cxp-csrf-v1').digest('base64url');
}

export function csrfMatches(secret: string, supplied: string | undefined): boolean {
  if (!supplied || !/^[A-Za-z0-9_-]{43}$/.test(supplied)) return false;
  const expected = Buffer.from(csrfFor(secret));
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function sessionExpired(expiry: Date, lastUse: Date, now = new Date()): boolean {
  return expiry.getTime() <= now.getTime() || lastUse.getTime() + config.auth.idleMinutes * 60_000 <= now.getTime();
}

export function setSessionCookie(res: Response, value: string): void {
  res.cookie(COOKIE_NAME, value, {
    httpOnly: true, secure: config.auth.cookieSecure, sameSite: 'lax', path: '/',
    maxAge: config.auth.absoluteHours * 60 * 60_000,
  });
  res.setHeader('Cache-Control', 'no-store');
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: config.auth.cookieSecure, sameSite: 'lax', path: '/' });
  res.setHeader('Cache-Control', 'no-store');
}
