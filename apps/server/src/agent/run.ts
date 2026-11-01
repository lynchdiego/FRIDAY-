import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import type { Card, ChatReply } from '@friday/shared';
import type { Db } from '../db';
import type { Llm, MessageParam, SystemBlock, ContentBlock } from '../llm/types';
import { LlmUnavailableError } from '../llm/types';
import type { Integrations } from '../integrations/types';
import type { Config } from '../config';
import { toolDefinitions } from '../tools/schemas';
import { runTool } from '../tools/execute';
import { recordUsage, spend } from './usage';
import { audit } from './audit';
import { confirmAction, cancelAction, reissueAction } from './actions';
import { tzOffset } from '../integrations/mock';

const here = dirname(fileURLToPath(import.meta.url));
const FRIDAY_PROMPT = readFileSync(join(here, '../../prompts/friday.md'), 'utf8');
const MAX_STEPS = 8;

export interface Deps { db: Db; llm: Llm; integ: Integrations; config: Config }
export interface TurnInput { userId: number; conversationId?: string; text: string; channel?: 'texto' | 'voz'; heavy?: boolean }

// Nota: \b no reconoce letras acentuadas en JavaScript; por eso se usa (?=[^\p{L}]|$) con la bandera u.
const END = '(?=[^\\p{L}]|$)';
const AFFIRM = new RegExp(`^\\s*(s[ií]|sip|claro|adelante|dale|hazlo|confirmo|correcto|ok(ay)?)${END}[\\s,.!]*((env[ií]a(lo|la)?|ag[eé]nda(lo|la)?|cr[eé]a(lo|la)?|mu[eé]ve(lo|la)?|hazlo|confirmo|por favor|adelante)${END}[\\s,.!]*)*$`, 'iu');
const NEGATE = new RegExp(`^\\s*(no|cancela(lo|la)?|mejor no|d[eé]ja(lo|la))${END}[\\s,.!]*$`, 'iu');
const HEAVY = /(planea|planifica|organiza).{0,20}(semana|mes)|analiza (a fondo|este|el documento)|piensa a fondo|usa opus/i;

/** Un turno de conversación. Devuelve el texto de FRIDAY y las tarjetas para la pantalla. */
export async function runTurn(deps: Deps, input: TurnInput): Promise<ChatReply> {
  const { db, config } = deps;
  const { userId } = input;
  const channel = input.channel ?? 'texto';
  const conversationId = await ensureConversation(db, userId, input.conversationId);
  const say = async (text: string, cards: Card[] = [], mode: ChatReply['mode'] = 'normal'): Promise<ChatReply> => {
    await saveMessage(db, conversationId, 'user', [{ type: 'text', text: input.text }], input.text);
    await saveMessage(db, conversationId, 'assistant', [{ type: 'text', text }], text, cards);
    return { conversationId, text, cards, mode };
  };

  // 1) "Sí" / "no" del propio Diego ante una acción pendiente: lo resuelve el servidor, no el modelo.
  const pending = (await db.query<any>(`SELECT id, verbal_ok, summary FROM pending_actions WHERE conversation_id=$1 AND status='pendiente' AND expires_at > now() ORDER BY created_at DESC LIMIT 1`, [conversationId])).rows[0];
  if (pending && AFFIRM.test(input.text)) {
    if (!pending.verbal_ok) {
      const card = await reissueAction(db, userId, pending.id, config.ACTION_TTL_SECONDS, config.FRIDAY_TZ);
      return say('Por seguridad, esta la confirmas tocando «Confirmar» en pantalla: la preparé después de leer contenido externo.', card ? [card] : []);
    }
    const r = await confirmAction(db, deps.integ, { userId, id: pending.id, tz: config.FRIDAY_TZ, via: channel === 'voz' ? 'voz' : 'texto' });
    await markEventsDelivered(db, conversationId);
    return r.ok ? say(`Listo. ${r.done}`) : say(r.message, [{ type: 'notice', tone: 'error', text: r.message }]);
  }
  if (pending && NEGATE.test(input.text)) {
    await cancelAction(db, userId, pending.id);
    await markEventsDelivered(db, conversationId);
    return say('Cancelado. No se hizo nada.');
  }

  // 2) Límite de gasto diario: si se alcanzó, modo básico (sin llamar al modelo).
  const s = await spend(db, userId, config.FRIDAY_TZ);
  if (s.today >= config.DAILY_LIMIT_USD) {
    await audit(db, userId, 'limite', null, { hoy: s.today, limite: config.DAILY_LIMIT_USD });
    return say(`Llegamos al límite de gasto de hoy (US$${config.DAILY_LIMIT_USD}). Estoy en modo básico: la agenda y los pendientes siguen en pantalla, pero no puedo conversar hasta mañana. Puedes subir el límite en Ajustes.`, [], 'basico');
  }

  // 3) Mensaje de Diego + contexto del servidor (fecha/hora y avisos), siempre agregado al final.
  const events = (await db.query<any>('SELECT id, text FROM conversation_events WHERE conversation_id=$1 AND NOT delivered ORDER BY id', [conversationId])).rows;
  const content: any[] = [{ type: 'text', text: `<contexto>${contextLine(config, channel)}</contexto>` }];
  for (const e of events) content.push({ type: 'text', text: `<evento_sistema>${e.text}</evento_sistema>` });
  content.push({ type: 'text', text: input.text });
  await saveMessage(db, conversationId, 'user', content, input.text);
  await markEventsDelivered(db, conversationId);

  const heavy = input.heavy || HEAVY.test(input.text);
  const model = heavy ? config.MODEL_HEAVY : config.MODEL_DEFAULT;
  const system = await systemBlocks(db, userId);
  const tools = toolDefinitions();
  const turn = { untrustedSeen: false };
  const cards: Card[] = [];
  const texts: string[] = [];
  let usedModel = model;

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const messages = await loadMessages(db, conversationId);
      const res = await deps.llm.create({ model, effort: heavy ? 'high' : 'low', system, tools, messages, maxTokens: heavy ? 16000 : 4096 });
      usedModel = res.model;
      await recordUsage(db, userId, conversationId, res.model, res.usage);
      const stepText = res.content.filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text').map((b) => b.text).join('').trim();
      if (stepText) texts.push(stepText);
      const isLast = res.stopReason !== 'tool_use';
      const msgId = await saveMessage(db, conversationId, 'assistant', res.content as any, isLast ? texts.join('\n\n') : null, isLast ? cards : null);
      if (res.stopReason === 'refusal') { texts.push('No puedo ayudar con eso.'); await setDisplay(db, msgId, texts.join('\n\n'), cards); break; }
      if (isLast) break;

      const results: any[] = [];
      for (const b of res.content) {
        if (b.type !== 'tool_use') continue;
        const out = await runTool(b.name, b.input, { db, userId, conversationId, integ: deps.integ, tz: config.FRIDAY_TZ, ttlSeconds: config.ACTION_TTL_SECONDS, turn });
        cards.push(...out.cards);
        results.push({ type: 'tool_result', tool_use_id: b.id, content: out.content, ...(out.isError ? { is_error: true } : {}) });
      }
      await saveMessage(db, conversationId, 'user', results, null);
      if (step === MAX_STEPS - 1) {
        texts.push('Me detuve porque la tarea requería demasiados pasos. ¿Lo intentamos por partes?');
        await saveMessage(db, conversationId, 'assistant', [{ type: 'text', text: texts.at(-1)! }], texts.join('\n\n'), cards);
      }
    }
  } catch (err) {
    if (!(err instanceof LlmUnavailableError)) throw err;
    await audit(db, userId, 'error', null, { llm: err.message });
    const text = `No puedo pensar ahora: ${err.message} Tu agenda y pendientes siguen en pantalla; intenta de nuevo en unos minutos.`;
    await saveMessage(db, conversationId, 'assistant', [{ type: 'text', text }], text, cards);
    return { conversationId, text, cards: [...cards, { type: 'notice', tone: 'error', text: err.message }], mode: 'normal' };
  }
  await db.query('UPDATE conversations SET updated_at=now() WHERE id=$1', [conversationId]);
  return { conversationId, text: texts.join('\n\n'), cards, mode: 'normal', model: usedModel };
}

function contextLine(config: Config, channel: string) {
  const now = new Date();
  const fecha = now.toLocaleString('es-MX', { timeZone: config.FRIDAY_TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  return `Ahora: ${fecha} (${config.FRIDAY_TZ}, UTC${tzOffset(config.FRIDAY_TZ, now)}). Canal: ${channel}.`;
}

/** Instrucciones fijas (cacheadas) + memoria de Diego (cambia poco). */
async function systemBlocks(db: Db, userId: number): Promise<SystemBlock[]> {
  const mem = (await db.query<any>('SELECT kind, subject, content FROM memories WHERE user_id=$1 ORDER BY id DESC LIMIT 30', [userId])).rows;
  const memText = mem.length ? mem.map((m) => `- [${m.kind}] ${m.subject}: ${m.content}`).join('\n') : '(vacía por ahora)';
  return [
    { type: 'text', text: FRIDAY_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: `## Lo que recuerdas de Diego\n${memText}` },
  ];
}

async function ensureConversation(db: Db, userId: number, id?: string) {
  if (id) {
    const r = await db.query('SELECT id FROM conversations WHERE id=$1 AND user_id=$2', [id, userId]);
    if (r.rows.length) return id;
  }
  const nid = randomUUID();
  await db.query('INSERT INTO conversations(id, user_id) VALUES ($1,$2)', [nid, userId]);
  return nid;
}

async function saveMessage(db: Db, conversationId: string, role: 'user' | 'assistant', content: unknown, display: string | null, cards?: Card[] | null) {
  const r = await db.query<{ id: number }>('INSERT INTO messages(conversation_id, role, content, display, cards) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [conversationId, role, JSON.stringify(content), display, cards ? JSON.stringify(cards) : null]);
  return r.rows[0].id;
}
const setDisplay = (db: Db, id: number, display: string, cards: Card[]) => db.query('UPDATE messages SET display=$2, cards=$3 WHERE id=$1', [id, display, JSON.stringify(cards)]);
const markEventsDelivered = (db: Db, conversationId: string) => db.query('UPDATE conversation_events SET delivered=true WHERE conversation_id=$1 AND NOT delivered', [conversationId]);

/** Historial completo en el formato exacto de la API: solo se agrega, nunca se edita. */
async function loadMessages(db: Db, conversationId: string): Promise<MessageParam[]> {
  const r = await db.query<any>('SELECT role, content FROM messages WHERE conversation_id=$1 ORDER BY id', [conversationId]);
  return r.rows.map((m) => ({ role: m.role, content: typeof m.content === 'string' ? JSON.parse(m.content) : m.content }));
}

/** Mensajes visibles de una conversación (para la pantalla). */
export async function conversationView(db: Db, userId: number, conversationId: string) {
  const ok = await db.query('SELECT 1 FROM conversations WHERE id=$1 AND user_id=$2', [conversationId, userId]);
  if (!ok.rows.length) return null;
  const r = await db.query<any>('SELECT role, display, cards, created_at FROM messages WHERE conversation_id=$1 AND display IS NOT NULL ORDER BY id', [conversationId]);
  // Las tarjetas de acción se muestran sin token: el token solo viaja una vez, en la respuesta original.
  return r.rows.map((m) => ({ role: m.role, text: m.display, cards: ((m.cards ?? []) as Card[]).map((c) => (c.type === 'action' ? { ...c, token: '' } : c)), at: m.created_at }));
}
