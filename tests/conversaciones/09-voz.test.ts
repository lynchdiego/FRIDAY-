import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './helpers';
import { speakable } from '../../apps/server/src/voice';

const VOICE_ENV = { ELEVENLABS_API_KEY: 'llave-secreta-eleven', ELEVENLABS_VOICE_ID: 'voz-original-123' };

/** Sustituye fetch para simular a ElevenLabs sin red y sin costo. */
function fakeEleven(opts: { fail?: boolean } = {}) {
  const real = globalThis.fetch;
  const calls: { url: string; init: any }[] = [];
  globalThis.fetch = (async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    if (opts.fail) return new Response('error', { status: 500 });
    if (String(url).includes('/text-to-speech/')) {
      const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array([0x49, 0x44, 0x33])); c.enqueue(new Uint8Array([1, 2, 3])); c.close(); } });
      return new Response(stream, { status: 200, headers: { 'content-type': 'audio/mpeg' } });
    }
    return Response.json({ text: ' ¿Qué tengo hoy? ' });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = real; } };
}

test('Sin llave de ElevenLabs: la app usa la voz del navegador (gratis)', async () => {
  const h = await harness();
  const cookie = await h.login();
  const cfg = (await h.app.inject({ method: 'GET', url: '/api/voice/config', headers: { cookie } })).json();
  assert.deepEqual(cfg, { tts: 'browser', stt: 'browser' });
  assert.equal((await h.app.inject({ method: 'POST', url: '/api/voice/tts', headers: { cookie }, payload: { text: 'hola' } })).statusCode, 503);
  await h.close();
});

test('Voz de FRIDAY: llave solo en el servidor, audio por partes, enlace de un solo uso, costo registrado', async () => {
  const h = await harness({ env: VOICE_ENV });
  const f = fakeEleven();
  try {
    const cookie = await h.login();
    const r = await h.app.inject({ method: 'POST', url: '/api/voice/tts', headers: { cookie }, payload: { text: '**Listo.** Tu próxima reunión es a las 10:30.' } });
    assert.equal(r.statusCode, 200);
    assert.doesNotMatch(r.body, /llave-secreta/, 'la llave nunca viaja al navegador');
    const url = r.json().url;
    const audio = await h.app.inject({ method: 'GET', url, headers: { cookie } });
    assert.equal(audio.statusCode, 200);
    assert.equal(audio.headers['content-type'], 'audio/mpeg');
    assert.equal(audio.rawPayload.length, 6, 'llegan todas las partes del audio');
    const sent = f.calls.find((c) => c.url.includes('/text-to-speech/voz-original-123/stream'))!;
    assert.equal(sent.init.headers['xi-api-key'], 'llave-secreta-eleven');
    assert.equal(JSON.parse(sent.init.body).model_id, 'eleven_flash_v2_5');
    assert.doesNotMatch(JSON.parse(sent.init.body).text, /\*/, 'sin símbolos de formato en la voz');
    assert.equal((await h.app.inject({ method: 'GET', url, headers: { cookie } })).statusCode, 404, 'el enlace sirve una sola vez');
    assert.equal((await h.app.inject({ method: 'GET', url: '/api/voice/tts/abc' })).statusCode, 401, 'requiere sesión');
    const cost = (await h.db.query<any>(`SELECT model, cost_usd FROM usage_log WHERE model LIKE 'elevenlabs:%'`)).rows;
    assert.equal(cost.length, 1);
    assert.ok(Number(cost[0].cost_usd) > 0);
  } finally { f.restore(); await h.close(); }
});

test('Entrada de voz: transcribe en español y registra el costo', async () => {
  const h = await harness({ env: VOICE_ENV });
  const f = fakeEleven();
  try {
    const cookie = await h.login();
    const r = await h.app.inject({ method: 'POST', url: '/api/voice/stt', headers: { cookie, 'content-type': 'audio/webm', 'x-duration': '3' }, payload: Buffer.alloc(4000, 1) });
    assert.equal(r.statusCode, 200);
    assert.equal(r.json().text, '¿Qué tengo hoy?');
    const form = f.calls[0].init.body as FormData;
    assert.equal(form.get('model_id'), 'scribe_v2');
    assert.equal(form.get('language_code'), 'es');
    assert.equal((await h.db.query(`SELECT 1 FROM usage_log WHERE model='elevenlabs:scribe_v2'`)).rows.length, 1);
  } finally { f.restore(); await h.close(); }
});

test('Falla de la voz: lo dice y sigue por texto', async () => {
  const h = await harness({ env: VOICE_ENV });
  const f = fakeEleven({ fail: true });
  try {
    const cookie = await h.login();
    const { url } = (await h.app.inject({ method: 'POST', url: '/api/voice/tts', headers: { cookie }, payload: { text: 'hola' } })).json();
    const audio = await h.app.inject({ method: 'GET', url, headers: { cookie } });
    assert.equal(audio.statusCode, 502);
    assert.match(audio.json().error, /texto/);
    const stt = await h.app.inject({ method: 'POST', url: '/api/voice/stt', headers: { cookie, 'content-type': 'audio/webm' }, payload: Buffer.alloc(4000, 1) });
    assert.equal(stt.statusCode, 502);
    assert.match(stt.json().error, /Escríbemelo/);
    assert.ok((await h.audit()).some((a) => a.tool === 'voz_tts'), 'queda registrado');
  } finally { f.restore(); await h.close(); }
});

test('Texto para voz: sin enlaces largos ni formato, y con tope', () => {
  assert.equal(speakable('Mira https://wa.me/123?text=hola'), 'Mira el enlace en pantalla');
  const long = 'Frase corta. '.repeat(200);
  const out = speakable(long);
  assert.ok(out.length < 1300 && out.endsWith('El resto está en pantalla.'));
});
