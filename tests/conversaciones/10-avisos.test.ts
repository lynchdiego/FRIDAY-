import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './helpers';
import { runReminders, runBriefing } from '../../apps/server/src/scheduler';

const SUB = { endpoint: 'https://push.ejemplo.com/dispositivo-1', keys: { p256dh: 'clave', auth: 'auth' }, device: 'iPhone' };
/** Fecha de hoy a una hora local de Cancún (UTC-5). */
const at = (hhmm: string) => new Date(`${new Date().toLocaleDateString('en-CA', { timeZone: 'America/Cancun' })}T${hhmm}:00-05:00`);

test('Recordatorio: "recuérdame" lo guarda y avisa a la hora, una sola vez', async () => {
  const h = await harness();
  const cookie = await h.login();
  await h.app.inject({ method: 'POST', url: '/api/push/subscribe', headers: { cookie }, payload: SUB });
  await h.db.query(`INSERT INTO reminders(user_id, text, remind_at) VALUES (1, 'Llamar al proveedor', now() - interval '1 minute'), (1, 'Futuro', now() + interval '1 hour')`);
  assert.equal(await runReminders(h.deps, h.push), 1, 'solo el que ya venció');
  assert.equal(h.pushed.length, 1);
  assert.equal(h.pushed[0].payload.body, 'Llamar al proveedor');
  assert.equal(await runReminders(h.deps, h.push), 0, 'no se repite');
  const unread = (await h.app.inject({ method: 'GET', url: '/api/notifications', headers: { cookie } })).json();
  assert.equal(unread.length, 1, 'también queda en la app por si el aviso no llegó');
  await h.app.inject({ method: 'POST', url: '/api/notifications/read', headers: { cookie }, payload: { ids: [unread[0].id] } });
  assert.equal((await h.app.inject({ method: 'GET', url: '/api/notifications', headers: { cookie } })).json().length, 0);
  await h.close();
});

test('Resumen de las 7:30: no antes, sí después, una vez al día y con la prioridad', async () => {
  const h = await harness();
  const cookie = await h.login();
  await h.app.inject({ method: 'POST', url: '/api/push/subscribe', headers: { cookie }, payload: SUB });
  assert.equal(await runBriefing(h.deps, h.push, 1, { now: at('07:10') }), false, 'antes de las 7:30 no');
  assert.equal(await runBriefing(h.deps, h.push, 1, { now: at('07:31') }), true);
  assert.equal(await runBriefing(h.deps, h.push, 1, { now: at('08:00') }), false, 'una vez al día');
  const p = h.pushed[0].payload;
  assert.equal(p.title, 'Tu día');
  assert.match(p.body, /4 compromisos/);
  assert.match(p.body, /Prioridad: Enviar la cotización/);
  assert.equal(p.url, '/#hoy');
  await h.close();
});

test('Si el servidor estuvo apagado toda la mañana, no manda el resumen en la tarde', async () => {
  const h = await harness();
  assert.equal(await runBriefing(h.deps, h.push, 1, { now: at('15:00') }), false);
  await h.close();
});

test('Dispositivos que ya no aceptan avisos se eliminan solos', async () => {
  const h = await harness();
  const cookie = await h.login();
  await h.app.inject({ method: 'POST', url: '/api/push/subscribe', headers: { cookie }, payload: { ...SUB, endpoint: 'https://push.ejemplo.com/vencido' } });
  await h.app.inject({ method: 'POST', url: '/api/push/subscribe', headers: { cookie }, payload: SUB });
  const r = (await h.app.inject({ method: 'POST', url: '/api/push/test', headers: { cookie } })).json();
  assert.equal(r.dispositivos, 1);
  assert.equal((await h.db.query('SELECT 1 FROM push_subscriptions')).rows.length, 1);
  const bad = await h.app.inject({ method: 'POST', url: '/api/push/subscribe', headers: { cookie }, payload: { ...SUB, endpoint: 'http://inseguro.com/x' } });
  assert.equal(bad.statusCode, 400, 'solo direcciones seguras (https)');
  await h.close();
});

test('Webhooks para n8n: requieren la clave secreta', async () => {
  const secret = 'clave-secreta-de-n8n-muy-larga-123';
  const h = await harness({ env: { HOOKS_SECRET: secret } });
  assert.equal((await h.app.inject({ method: 'POST', url: '/api/hooks/briefing' })).statusCode, 401);
  assert.equal((await h.app.inject({ method: 'POST', url: '/api/hooks/briefing', headers: { authorization: 'Bearer otra-clave' } })).statusCode, 401);
  const ok = await h.app.inject({ method: 'POST', url: '/api/hooks/briefing', headers: { authorization: `Bearer ${secret}` } });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.json().enviado, true);
  const h2 = await harness();
  assert.equal((await h2.app.inject({ method: 'POST', url: '/api/hooks/reminders', headers: { authorization: 'Bearer cualquiera' } })).statusCode, 401, 'sin HOOKS_SECRET configurado, los webhooks están cerrados');
  await h.close(); await h2.close();
});

test('La llave pública de avisos es estable entre reinicios', async () => {
  const h = await harness();
  const cookie = await h.login();
  const a = (await h.app.inject({ method: 'GET', url: '/api/push/key', headers: { cookie } })).json().publicKey;
  const b = (await h.app.inject({ method: 'GET', url: '/api/push/key', headers: { cookie } })).json().publicKey;
  assert.ok(a.length > 60);
  assert.equal(a, b);
  await h.close();
});
