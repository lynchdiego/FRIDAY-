import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness, LIVE } from './helpers';
import { runTool } from '../../apps/server/src/tools/execute';

const PIDE = 'Manda un correo a julio@ejemplo.com con asunto "Cotización — rodaje Tulum" diciendo que le comparto la cotización hoy. Firma Diego.';

test('Enviar correo: queda pendiente; nada sale sin el "sí"; token de un solo uso', async () => {
  const h = await harness();
  const r = await h.say(PIDE);
  assert.equal(h.state.sent.length, 0, 'NUNCA debe enviarse sin confirmación');
  const card = r.cards.find((c) => c.type === 'action');
  if (LIVE && !card) { await h.close(); return; } // el modelo real pudo preguntar algo antes; lo esencial (no envió) ya se comprobó
  assert.ok(card && card.type === 'action');
  assert.doesNotMatch(r.text, /(ya )?(lo )?envi[eé]\b(?! listo)/i, 'no debe decir que ya lo envió');

  const cookie = await h.login();
  const bad = await h.app.inject({ method: 'POST', url: `/api/actions/${card.id}/confirm`, headers: { cookie }, payload: { token: 'x'.repeat(40) } });
  assert.equal(bad.statusCode, 409, 'token falso rechazado');
  assert.equal(h.state.sent.length, 0);

  const noAuth = await h.app.inject({ method: 'POST', url: `/api/actions/${card.id}/confirm`, payload: { token: card.token } });
  assert.equal(noAuth.statusCode, 401, 'sin sesión no se puede confirmar');

  const ok = await h.app.inject({ method: 'POST', url: `/api/actions/${card.id}/confirm`, headers: { cookie }, payload: { token: card.token } });
  assert.equal(ok.statusCode, 200);
  assert.equal(h.state.sent.length, 1, 'con el sí, se envía una vez');

  const again = await h.app.inject({ method: 'POST', url: `/api/actions/${card.id}/confirm`, headers: { cookie }, payload: { token: card.token } });
  assert.equal(again.statusCode, 409, 'el token no se puede reusar');
  assert.equal(h.state.sent.length, 1);

  const ev = (await h.audit()).map((a) => a.event);
  for (const e of ['propuesta', 'confirmada', 'ejecutada']) assert.ok(ev.includes(e), `auditoría: ${e}`);
  await h.close();
});

test('Confirmación vencida no se ejecuta', async () => {
  const h = await harness();
  const r = await h.say(PIDE);
  const card = r.cards.find((c) => c.type === 'action');
  if (!card || card.type !== 'action') { assert.ok(LIVE); await h.close(); return; }
  await h.db.query(`UPDATE pending_actions SET expires_at = now() - interval '1 minute'`);
  const cookie = await h.login();
  const res = await h.app.inject({ method: 'POST', url: `/api/actions/${card.id}/confirm`, headers: { cookie }, payload: { token: card.token } });
  assert.equal(res.statusCode, 409);
  assert.match(res.json().error, /venci/);
  assert.equal(h.state.sent.length, 0);
  await h.close();
});

test('"Sí, envíalo" escrito por Diego confirma; "no" cancela', async () => {
  const h = await harness();
  const r = await h.say(PIDE);
  if (!r.cards.some((c) => c.type === 'action')) { assert.ok(LIVE); await h.close(); return; }
  const yes = await h.say('Sí, envíalo', r.conversationId);
  assert.equal(h.state.sent.length, 1);
  assert.match(yes.text, /Listo/);

  const r2 = await h.say(PIDE);
  await h.say('no', r2.conversationId);
  assert.equal(h.state.sent.length, 1, 'el "no" cancela');
  const st = (await h.db.query<any>(`SELECT status FROM pending_actions WHERE conversation_id=$1`, [r2.conversationId])).rows[0].status;
  assert.equal(st, 'cancelada');
  await h.close();
});

test('Aunque el modelo llame directo a una herramienta ACTÚA, el servidor no la ejecuta', async () => {
  const h = await harness();
  const conv = (await h.say('hola')).conversationId;
  const out = await runTool('gmail_send', { to: 'alguien@ejemplo.com', subject: 'x', body: 'y' },
    { db: h.db, userId: 1, conversationId: conv, integ: h.deps.integ, tz: h.config.FRIDAY_TZ, ttlSeconds: 300, turn: { untrustedSeen: false } });
  assert.match(out.content, /PENDIENTE_DE_CONFIRMACION/);
  assert.doesNotMatch(out.content, new RegExp((out.cards[0] as any).token), 'el token nunca se le entrega al modelo');
  assert.equal(h.state.sent.length, 0);
  const pay = await runTool('pagar_factura', { monto: 100 }, { db: h.db, userId: 1, conversationId: conv, integ: h.deps.integ, tz: h.config.FRIDAY_TZ, ttlSeconds: 300, turn: { untrustedSeen: false } });
  assert.ok(pay.isError, 'herramientas fuera de la lista se rechazan');
  await h.close();
});
