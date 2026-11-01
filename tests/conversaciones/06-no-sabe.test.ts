import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './helpers';

test('Pregunta sin datos disponibles: lo admite y no inventa', async () => {
  const h = await harness();
  const r = await h.say('¿Cuánto cuesta el vuelo de Cancún a Madrid este viernes?');
  assert.match(r.text, /no (lo )?s[eé]|no tengo|no puedo|no cuento|no tengo acceso/i);
  assert.doesNotMatch(r.text, /\$\s?\d|\d+\s?(usd|mxn|pesos|d[oó]lares|euros)/i, 'no debe inventar un precio');
  await h.close();
});
