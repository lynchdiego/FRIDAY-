import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './helpers';

test('"¿Qué tengo hoy?" consulta la agenda y responde con los eventos', async () => {
  const h = await harness();
  const r = await h.say('¿Qué tengo hoy?');
  const events = r.cards.find((c) => c.type === 'events');
  assert.ok(events && events.type === 'events' && events.items.length >= 4, 'debe mostrar la tarjeta con los eventos de hoy');
  assert.ok(r.text.length > 0);
  assert.ok((await h.audit()).some((a) => a.tool === 'calendar_list'), 'debe quedar en auditoría');
  await h.close();
});

test('"¿Qué sigue?" también usa la agenda (no inventa)', async () => {
  const h = await harness();
  const r = await h.say('¿Qué sigue en mi día?');
  assert.ok((await h.audit()).some((a) => a.tool === 'calendar_list'));
  assert.ok(r.text.length > 0);
  await h.close();
});
