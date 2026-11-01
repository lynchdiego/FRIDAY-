import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { z } from 'zod';
import { SKILLS, NEVER_RULES, GROUP_LABEL, PERMISSION_LABEL } from '@friday/shared';
import type { Deps } from './agent/run';
import { runTurn, conversationView } from './agent/run';
import { confirmAction, cancelAction } from './agent/actions';
import { spend } from './agent/usage';
import { login, logout, requireAuth, SESSION_COOKIE } from './security/auth';

export async function buildApp(deps: Deps) {
  const { db, config } = deps;
  const app = Fastify({ logger: config.NODE_ENV !== 'test' ? { level: 'info' } : false, bodyLimit: 256 * 1024 });
  await app.register(cookie);
  const auth = requireAuth(db);
  const secure = config.NODE_ENV === 'production';

  app.get('/api/health', async () => ({ ok: true, llm: deps.llm.name, integraciones: deps.integ.name }));

  app.post('/api/login', async (req, reply) => {
    const body = z.object({ password: z.string() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Falta la contraseña.' });
    const r = await login(db, body.data.password, config.FRIDAY_PASSWORD, req.ip);
    if (!r.ok) return reply.code(401).send({ error: r.error });
    reply.setCookie(SESSION_COOKIE, r.token, { httpOnly: true, secure, sameSite: 'strict', path: '/', expires: r.expires });
    return { ok: true };
  });
  app.post('/api/logout', async (req, reply) => {
    await logout(db, req.cookies[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });
  app.get('/api/me', { preHandler: auth }, async () => ({ name: config.OWNER_NAME, tz: config.FRIDAY_TZ }));

  // Conversación
  app.post('/api/chat', { preHandler: auth }, async (req, reply) => {
    const body = z.object({ text: z.string().min(1).max(8000), conversationId: z.string().optional(), channel: z.enum(['texto', 'voz']).optional(), heavy: z.boolean().optional() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Mensaje inválido.' });
    return runTurn(deps, { userId: req.userId!, ...body.data });
  });
  app.get('/api/conversations/:id', { preHandler: auth }, async (req, reply) => {
    const v = await conversationView(db, req.userId!, (req.params as any).id);
    return v ?? reply.code(404).send({ error: 'No existe.' });
  });

  // Confirmaciones (solo el servidor ejecuta, con token de un solo uso)
  app.post('/api/actions/:id/confirm', { preHandler: auth }, async (req, reply) => {
    const body = z.object({ token: z.string().min(20), edits: z.record(z.string(), z.string()).optional() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Falta el token de confirmación.' });
    const r = await confirmAction(db, deps.integ, { userId: req.userId!, id: (req.params as any).id, token: body.data.token, edits: body.data.edits, tz: config.FRIDAY_TZ, via: 'pantalla' });
    return r.ok ? { ok: true, text: `Listo. ${r.done}` } : reply.code(r.reason === 'fallo' ? 502 : 409).send({ ok: false, error: r.message });
  });
  app.post('/api/actions/:id/cancel', { preHandler: auth }, async (req) => ({ ok: await cancelAction(db, req.userId!, (req.params as any).id) }));

  // Habilidades y permisos (fuente única de verdad)
  app.get('/api/skills', { preHandler: auth }, async () => ({ skills: SKILLS.map(({ description, ...s }) => ({ ...s, description })), never: NEVER_RULES, groups: GROUP_LABEL, permissions: PERMISSION_LABEL }));

  // Ajustes y costos
  app.get('/api/settings', { preHandler: auth }, async (req) => {
    const s = await spend(db, req.userId!, config.FRIDAY_TZ);
    return { model: config.MODEL_DEFAULT, modelHeavy: config.MODEL_HEAVY, llm: deps.llm.name, integraciones: deps.integ.name, limiteDiarioUsd: config.DAILY_LIMIT_USD, costo: s };
  });
  app.get('/api/audit', { preHandler: auth }, async (req) => {
    const r = await db.query('SELECT at, event, tool, action_id, detail FROM audit_log WHERE user_id=$1 ORDER BY id DESC LIMIT 100', [req.userId]);
    return r.rows;
  });
  app.get('/api/memory/export', { preHandler: auth }, async (req) => {
    const q = (t: string) => db.query(`SELECT * FROM ${t} WHERE user_id=$1 ORDER BY id`, [req.userId]).then((r) => r.rows);
    return { exportado: new Date().toISOString(), memoria: await q('memories'), pendientes: await q('tasks'), recordatorios: await q('reminders') };
  });
  app.post('/api/memory/delete', { preHandler: auth }, async (req, reply) => {
    const body = z.object({ confirm: z.literal('BORRAR') }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Escribe BORRAR para confirmar.' });
    await db.query('DELETE FROM memories WHERE user_id=$1', [req.userId]);
    return { ok: true };
  });

  return app;
}
