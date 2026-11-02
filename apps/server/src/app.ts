import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { z } from 'zod';
import { SKILLS, NEVER_RULES, GROUP_LABEL, PERMISSION_LABEL } from '@friday/shared';
import type { Deps } from './agent/run';
import { runTurn, conversationView } from './agent/run';
import { confirmAction, cancelAction } from './agent/actions';
import { spend } from './agent/usage';
import { audit } from './agent/audit';
import { registerVoice, voiceEnabled } from './voice';
import { vapidKeys, webPushSender, type PushSender } from './notify';
import { runReminders, runBriefing } from './scheduler';
import { safeEqual } from './security/crypto';
import { login, logout, requireAuth, SESSION_COOKIE } from './security/auth';
import { randomToken } from './security/crypto';
import { today } from './agent/today';
import { authUrl, saveConnection, connectionStatus, disconnect, googleConfigured } from './integrations/google';

export async function buildApp(deps: Deps, opts: { push?: PushSender; webDir?: string } = {}) {
  const { db, config } = deps;
  const app = Fastify({
    // Los registros nunca incluyen parámetros de la dirección (p. ej. el código de Google) ni cookies.
    logger: config.NODE_ENV !== 'test' ? { level: 'info', serializers: { req: (r: any) => ({ method: r.method, url: String(r.url).split('?')[0] }) } } : false,
    bodyLimit: 256 * 1024,
    trustProxy: config.NODE_ENV === 'production', // detrás de Caddy (HTTPS)
  });
  await app.register(cookie);

  // Encabezados de seguridad para todas las respuestas.
  const CSP = [
    "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com", "img-src 'self' data: blob:", "media-src 'self' blob: data:",
    "connect-src 'self'", "worker-src 'self'", "manifest-src 'self'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'",
  ].join('; ');
  app.addHook('onSend', async (req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Permissions-Policy', 'microphone=(self), camera=(), geolocation=(), payment=()');
    reply.header('Content-Security-Policy', CSP);
    if (secure) reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    if (req.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
  });
  const auth = requireAuth(db);
  const secure = config.NODE_ENV === 'production';

  // Pública: en producción no revela qué modelo ni qué integraciones se usan.
  app.get('/api/health', async () => (secure ? { ok: true } : { ok: true, llm: deps.llm.name, integraciones: deps.integ.name }));

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

  // Resumen del día (agenda, correos, pendientes, recordatorios y una prioridad)
  app.get('/api/today', { preHandler: auth }, async (req) => today(deps, req.userId!, (req.query as any)?.refrescar === '1'));

  // Google: conexión OAuth (permisos mínimos; tokens cifrados)
  app.get('/api/google/status', { preHandler: auth }, async (req) => ({
    configured: googleConfigured(config), mode: deps.integ.name, ...(await connectionStatus(db, req.userId!)),
  }));
  app.get('/api/google/connect', { preHandler: auth }, async (req, reply) => {
    if (!googleConfigured(config)) return reply.code(400).send({ error: 'Google todavía no está configurado en el servidor.' });
    const state = randomToken(32);
    await db.query(`INSERT INTO oauth_states(state, user_id, expires_at) VALUES ($1,$2, now() + interval '10 minutes')`, [state, req.userId]);
    return reply.redirect(authUrl(config, state));
  });
  // Regreso desde Google: se valida con el "state" de un solo uso (la cookie estricta no viaja en este salto).
  app.get('/api/google/callback', async (req, reply) => {
    const q = req.query as { code?: string; state?: string; error?: string };
    const back = (r: string) => reply.redirect(`${config.PUBLIC_URL}/?google=${r}#ajustes`);
    if (q.error || !q.code || !q.state) return back('cancelado');
    const r = await db.query<any>('DELETE FROM oauth_states WHERE state=$1 AND expires_at > now() RETURNING user_id', [q.state]);
    if (!r.rows[0]) return back('vencido');
    try {
      await saveConnection(db, config, r.rows[0].user_id, q.code);
      await audit(db, r.rows[0].user_id, 'ejecutada', 'google_connect', null);
      return back('ok');
    } catch (e) {
      app.log.warn({ err: (e as Error).message }, 'google callback');
      return back('error');
    }
  });
  app.post('/api/google/disconnect', { preHandler: auth }, async (req) => {
    await disconnect(db, config, req.userId!);
    await audit(db, req.userId!, 'ejecutada', 'google_disconnect', null);
    return { ok: true };
  });

  registerVoice(app, deps, auth);

  // Avisos y notificaciones push
  const push = opts.push ?? webPushSender(db, config);
  app.get('/api/notifications', { preHandler: auth }, async (req) =>
    (await db.query('SELECT id, kind, title, body, url, created_at FROM notifications WHERE user_id=$1 AND read_at IS NULL ORDER BY id DESC LIMIT 20', [req.userId])).rows);
  app.post('/api/notifications/read', { preHandler: auth }, async (req) => {
    const body = z.object({ ids: z.array(z.number().int()).max(100) }).safeParse(req.body);
    if (body.success) await db.query('UPDATE notifications SET read_at=now() WHERE user_id=$1 AND id = ANY($2::int[])', [req.userId, body.data.ids]);
    return { ok: true };
  });
  app.get('/api/push/key', { preHandler: auth }, async () => ({ publicKey: (await vapidKeys(db, config)).publicKey }));
  app.post('/api/push/subscribe', { preHandler: auth }, async (req, reply) => {
    const body = z.object({ endpoint: z.string().url().startsWith('https://'), keys: z.object({ p256dh: z.string(), auth: z.string() }), device: z.string().max(80).optional() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Suscripción inválida.' });
    await db.query(`INSERT INTO push_subscriptions(endpoint, user_id, keys, device) VALUES ($1,$2,$3,$4) ON CONFLICT (endpoint) DO UPDATE SET keys=$3, device=$4`,
      [body.data.endpoint, req.userId, JSON.stringify(body.data.keys), body.data.device ?? null]);
    return { ok: true };
  });
  app.post('/api/push/unsubscribe', { preHandler: auth }, async (req) => {
    const body = z.object({ endpoint: z.string() }).safeParse(req.body);
    if (body.success) await db.query('DELETE FROM push_subscriptions WHERE endpoint=$1 AND user_id=$2', [body.data.endpoint, req.userId]);
    return { ok: true };
  });
  app.post('/api/push/test', { preHandler: auth }, async (req) => {
    const { notify } = await import('./notify');
    const n = await notify(db, push, req.userId!, { kind: 'aviso', title: 'FRIDAY', body: 'Así se verán mis avisos.', url: '/#inicio' });
    return { ok: true, dispositivos: n };
  });

  // Webhooks para n8n (o cualquier programador externo). Requieren HOOKS_SECRET.
  const hookAuth = async (req: any, reply: any) => {
    const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    if (!config.HOOKS_SECRET || !token || !safeEqual(token, config.HOOKS_SECRET)) return reply.code(401).send({ error: 'No autorizado.' });
  };
  app.post('/api/hooks/reminders', { preHandler: hookAuth }, async () => ({ enviados: await runReminders(deps, push) }));
  app.post('/api/hooks/briefing', { preHandler: hookAuth }, async () => ({ enviado: await runBriefing(deps, push, 1, { force: true }) }));

  // Habilidades y permisos (fuente única de verdad)
  app.get('/api/skills', { preHandler: auth }, async () => ({ skills: SKILLS.map(({ description, ...s }) => ({ ...s, description })), never: NEVER_RULES, groups: GROUP_LABEL, permissions: PERMISSION_LABEL }));

  // Ajustes y costos
  app.get('/api/settings', { preHandler: auth }, async (req) => {
    const s = await spend(db, req.userId!, config.FRIDAY_TZ);
    const d = await db.query<any>(
      `SELECT CASE WHEN model LIKE 'elevenlabs:%' THEN 'Voz' ELSE 'Claude' END AS servicio, SUM(cost_usd) AS usd FROM usage_log
       WHERE user_id=$1 AND date_trunc('month', at AT TIME ZONE $2) = date_trunc('month', now() AT TIME ZONE $2) GROUP BY 1 ORDER BY 1`, [req.userId, config.FRIDAY_TZ]);
    return { desglose: d.rows.map((r) => ({ servicio: r.servicio, usd: Number(r.usd) })), model: config.MODEL_DEFAULT, modelHeavy: config.MODEL_HEAVY, llm: deps.llm.name, integraciones: deps.integ.name, voz: voiceEnabled(config) ? 'elevenlabs' : 'navegador', limiteDiarioUsd: config.DAILY_LIMIT_USD, costo: s };
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

  // Producción: el mismo servidor entrega la app (apps/web/dist). Rutas desconocidas → la app.
  if (opts.webDir) {
    const { default: fastifyStatic } = await import('@fastify/static');
    await app.register(fastifyStatic, {
      root: opts.webDir, prefix: '/', index: ['index.html'], wildcard: false,
      setHeaders: (res, path) => {
        if (path.includes('/assets/')) res.header('Cache-Control', 'public, max-age=31536000, immutable');
        else res.header('Cache-Control', 'no-cache');
      },
    });
    app.setNotFoundHandler((req, reply) => (req.url.startsWith('/api/') ? reply.code(404).send({ error: 'No existe.' }) : reply.sendFile('index.html')));
  }

  return app;
}
