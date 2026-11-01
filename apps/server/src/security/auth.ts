import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from '../db';
import { randomToken, safeEqual, sha256 } from './crypto';

export const SESSION_COOKIE = 'friday_session';
const SESSION_DAYS = 30;
const attempts = new Map<string, { n: number; until: number }>();

/** Inicio de sesión de un solo usuario (piloto). Bloquea 15 min tras 5 intentos fallidos. */
export async function login(db: Db, password: string, expected: string, ip: string) {
  const a = attempts.get(ip);
  if (a && a.n >= 5 && a.until > Date.now()) return { ok: false as const, error: 'Demasiados intentos. Espera 15 minutos.' };
  if (!safeEqual(password, expected)) {
    const n = (a && a.until > Date.now() ? a.n : 0) + 1;
    attempts.set(ip, { n, until: Date.now() + 15 * 60_000 });
    return { ok: false as const, error: 'Contraseña incorrecta.' };
  }
  attempts.delete(ip);
  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.query('INSERT INTO sessions(id, user_id, expires_at) VALUES ($1, 1, $2)', [sha256(token), expires.toISOString()]);
  return { ok: true as const, token, expires };
}

export async function sessionUser(db: Db, token: string | undefined) {
  if (!token) return null;
  const r = await db.query<{ user_id: number }>('SELECT user_id FROM sessions WHERE id=$1 AND expires_at > now()', [sha256(token)]);
  return r.rows[0]?.user_id ?? null;
}

export async function logout(db: Db, token: string | undefined) {
  if (token) await db.query('DELETE FROM sessions WHERE id=$1', [sha256(token)]);
}

declare module 'fastify' { interface FastifyRequest { userId?: number } }

export function requireAuth(db: Db) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const uid = await sessionUser(db, req.cookies[SESSION_COOKIE]);
    if (!uid) return reply.code(401).send({ error: 'Inicia sesión.' });
    req.userId = uid;
  };
}
