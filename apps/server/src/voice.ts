import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Db } from './db';
import type { Config } from './config';
import { randomToken } from './security/crypto';
import { audit } from './agent/audit';

/**
 * Voz con ElevenLabs. La llave vive solo aquí, en el servidor; el navegador nunca la ve.
 * - Salida (TTS): el navegador pide una frase y recibe un enlace de un solo uso que
 *   reproduce el audio mientras se genera (streaming progresivo, funciona en iPhone).
 * - Entrada (STT): el navegador sube el audio grabado mientras Diego mantiene "Hablar".
 * Sin llave: la app usa la voz y el reconocimiento del navegador (gratis).
 */
const MAX_CHARS = 1200;
const pending = new Map<string, { text: string; userId: number; expires: number }>();

export function voiceEnabled(c: Config) { return !!(c.ELEVENLABS_API_KEY && c.ELEVENLABS_VOICE_ID); }

/** Texto apto para leer en voz alta: sin markdown, sin enlaces largos, con tope de longitud. */
export function speakable(text: string) {
  const t = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/https?:\/\/\S+/g, 'el enlace en pantalla')
    .replace(/[*_#>`~|]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length <= MAX_CHARS) return t;
  const cut = t.slice(0, MAX_CHARS);
  return cut.slice(0, Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? ')) + 1 || MAX_CHARS) + ' El resto está en pantalla.';
}

async function logVoice(db: Db, userId: number, model: string, units: number, cost: number) {
  // Se reutiliza usage_log: input_tokens = caracteres (TTS) o segundos (STT).
  await db.query('INSERT INTO usage_log(user_id, conversation_id, model, input_tokens, output_tokens, cost_usd) VALUES ($1,$2,$3,$4,0,$5)', [userId, 'voz', model, Math.round(units), cost]);
}

export function registerVoice(app: FastifyInstance, deps: { db: Db; config: Config }, auth: (req: FastifyRequest, reply: any) => Promise<unknown>) {
  const { db, config } = deps;
  const on = voiceEnabled(config);

  app.get('/api/voice/config', { preHandler: auth }, async () => ({ tts: on ? 'elevenlabs' : 'browser', stt: on ? 'elevenlabs' : 'browser' }));

  // 1) Pedir una frase: devuelve un enlace de un solo uso (2 minutos).
  app.post('/api/voice/tts', { preHandler: auth }, async (req, reply) => {
    if (!on) return reply.code(503).send({ error: 'La voz de ElevenLabs no está configurada.' });
    const body = z.object({ text: z.string().min(1).max(8000) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Texto inválido.' });
    const id = randomToken(18);
    for (const [k, v] of pending) if (v.expires < Date.now()) pending.delete(k);
    pending.set(id, { text: speakable(body.data.text), userId: req.userId!, expires: Date.now() + 120_000 });
    return { url: `/api/voice/tts/${id}` };
  });

  // 2) Reproducir: el audio llega por partes mientras ElevenLabs lo genera.
  app.get('/api/voice/tts/:id', { preHandler: auth }, async (req, reply) => {
    const item = pending.get((req.params as any).id);
    pending.delete((req.params as any).id);
    if (!item || item.expires < Date.now() || item.userId !== req.userId) return reply.code(404).send({ error: 'Audio vencido.' });
    const url = `${config.ELEVENLABS_BASE_URL}/text-to-speech/${encodeURIComponent(config.ELEVENLABS_VOICE_ID!)}/stream?output_format=${encodeURIComponent(config.ELEVENLABS_OUTPUT_FORMAT)}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'xi-api-key': config.ELEVENLABS_API_KEY!, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text: item.text, model_id: config.ELEVENLABS_TTS_MODEL, language_code: 'es' }),
    }).catch(() => null);
    if (!r || !r.ok || !r.body) {
      await audit(db, item.userId, 'error', 'voz_tts', { status: r?.status ?? 'sin conexión' });
      return reply.code(502).send({ error: 'La voz no respondió. Sigo por texto.' });
    }
    await logVoice(db, item.userId, `elevenlabs:${config.ELEVENLABS_TTS_MODEL}`, item.text.length, (item.text.length / 1000) * config.VOICE_TTS_USD_PER_1K_CHARS);
    reply.header('Content-Type', r.headers.get('content-type') ?? 'audio/mpeg').header('Cache-Control', 'no-store');
    return reply.send(r.body);
  });

  // Entrada de voz: audio crudo (webm/mp4/ogg) hasta 8 MB ≈ 2-3 minutos.
  app.addContentTypeParser(/^audio\//, { parseAs: 'buffer', bodyLimit: 8 * 1024 * 1024 }, (_req, body, done) => done(null, body));
  app.post('/api/voice/stt', { preHandler: auth, bodyLimit: 8 * 1024 * 1024 }, async (req, reply) => {
    if (!on) return reply.code(503).send({ error: 'El reconocimiento de voz de ElevenLabs no está configurado.' });
    const audio = req.body as Buffer;
    if (!Buffer.isBuffer(audio) || audio.length < 200) return reply.code(400).send({ error: 'No escuché nada.' });
    const type = String(req.headers['content-type'] ?? 'audio/webm').split(';')[0];
    const seconds = Number(req.headers['x-duration'] ?? 0) || audio.length / 16000; // estimación si el navegador no la manda
    const form = new FormData();
    form.append('model_id', config.ELEVENLABS_STT_MODEL);
    form.append('language_code', 'es');
    form.append('file', new Blob([new Uint8Array(audio)], { type }), `voz.${type.split('/')[1] ?? 'webm'}`);
    const r = await fetch(`${config.ELEVENLABS_BASE_URL}/speech-to-text`, { method: 'POST', headers: { 'xi-api-key': config.ELEVENLABS_API_KEY! }, body: form }).catch(() => null);
    if (!r || !r.ok) {
      await audit(db, req.userId!, 'error', 'voz_stt', { status: r?.status ?? 'sin conexión' });
      return reply.code(502).send({ error: 'No pude transcribir. Escríbemelo, por favor.' });
    }
    const data = (await r.json()) as { text?: string };
    await logVoice(db, req.userId!, `elevenlabs:${config.ELEVENLABS_STT_MODEL}`, seconds, (seconds / 3600) * config.VOICE_STT_USD_PER_HOUR);
    return { text: (data.text ?? '').trim() };
  });
}
