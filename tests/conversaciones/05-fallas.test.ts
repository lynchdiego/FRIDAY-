import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './helpers';
import { LlmUnavailableError } from '../../apps/server/src/llm/types';

test('Falla de Google: lo dice con claridad y sigue en modo texto', async () => {
  const h = await harness();
  h.state.failing = true;
  const r = await h.say('¿Qué tengo hoy?');
  assert.ok(r.cards.some((c) => c.type === 'notice' && c.tone === 'error'), 'la pantalla muestra el aviso de falla');
  assert.match(r.text, /no (pude|puedo|está disponible|responde)|falla|disponible/i);
  await h.close();
});

test('Falla de Claude: no se cae; avisa y deja la app usable', async () => {
  const h = await harness({ llm: { name: 'roto', create: async () => { throw new LlmUnavailableError('No hay conexión con Claude.'); } } });
  const r = await h.say('¿Qué tengo hoy?');
  assert.match(r.text, /No puedo pensar ahora/);
  await h.close();
});
// La falla de voz (etapa 5) se prueba en la interfaz: si la voz no responde, cambia a modo texto.
