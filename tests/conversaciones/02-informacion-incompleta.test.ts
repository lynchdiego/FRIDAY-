import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './helpers';

test('"Agenda una reunión con Julio" sin fecha: pregunta antes de preparar nada', async () => {
  const h = await harness();
  const r = await h.say('Agenda una reunión con Julio.');
  assert.match(r.text, /\?/, 'debe hacer una pregunta');
  const pend = await h.db.query('SELECT * FROM pending_actions');
  assert.equal(pend.rows.length, 0, 'no debe preparar el evento sin fecha');
  assert.equal(h.state.created.length, 0);
  await h.close();
});
