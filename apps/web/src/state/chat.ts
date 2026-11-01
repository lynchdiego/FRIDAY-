import { useSyncExternalStore } from 'react';
import type { Card, ChatReply } from '@friday/shared';
import { presence } from '../mobius/presence';
import { mock } from '../data/mock';

/**
 * Estado de la conversación y conexión con el servidor de FRIDAY.
 * - 'server': hay servidor; todo pasa por la API (y por el inicio de sesión).
 * - 'demo': no hay servidor (p. ej. la vista previa): respuestas ficticias, nada sale.
 */
export type ActionCard = Extract<Card, { type: 'action' }>;
export interface Msg { role: 'user' | 'assistant'; text: string; cards: Card[] }
interface State {
  mode: 'checking' | 'server' | 'demo';
  authed: boolean;
  /** Zona horaria de Diego (la indica el servidor); las horas siempre se muestran en ella. */
  tz: string;
  conversationId?: string;
  messages: Msg[];
  busy: boolean;
  action?: ActionCard;
  toast?: string;
}
let s: State = { mode: 'checking', authed: false, messages: [], busy: false, tz: 'America/Cancun' };
export const currentTz = () => s.tz;
const subs = new Set<() => void>();
const set = (p: Partial<State>) => { s = { ...s, ...p }; subs.forEach((f) => f()); };
export const useChat = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => s);

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { set({ authed: false }); throw new Error(data.error ?? 'Inicia sesión.'); }
  if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
  return data as T;
}

export const chat = {
  async init() {
    try {
      const h = await fetch('/api/health').then((r) => (r.ok ? r.json() : null));
      if (!h?.ok) throw new Error();
      set({ mode: 'server' });
      try { const me = await api<{ tz: string }>('/me'); set({ authed: true, tz: me.tz }); } catch { /* muestra login */ }
    } catch { set({ mode: 'demo', authed: true }); }
  },

  async login(password: string) {
    await api('/login', { password });
    const me = await api<{ tz: string }>('/me');
    set({ authed: true, tz: me.tz });
  },

  async send(text: string, channel: 'texto' | 'voz' = 'texto') {
    if (!text.trim() || s.busy) return;
    set({ messages: [...s.messages, { role: 'user', text, cards: [] }], busy: true });
    presence.set({ state: 'think' });
    try {
      const r = s.mode === 'server'
        ? await api<ChatReply>('/chat', { text, channel, conversationId: s.conversationId })
        : await demoReply(text);
      const action = r.cards.find((c): c is ActionCard => c.type === 'action');
      set({ conversationId: r.conversationId, messages: [...s.messages, { role: 'assistant', text: r.text, cards: r.cards }], action: action ?? s.action });
      speakFor(r.text);
    } catch (e) {
      set({ messages: [...s.messages, { role: 'assistant', text: `No pude responder: ${(e as Error).message}`, cards: [] }] });
      presence.set({ state: 'calm' });
    } finally { set({ busy: false }); }
  },

  openAction(a: ActionCard) { set({ action: a }); },
  /** Tras confirmar o cancelar, la tarjeta del chat deja de ofrecer el botón. */
  retire(id: string) {
    set({ messages: s.messages.map((m) => ({ ...m, cards: m.cards.map((c) => (c.type === 'action' && c.id === id ? { ...c, token: '' } : c)) })) });
  },
  closeAction() { set({ action: undefined }); },

  async confirm(a: ActionCard, edits?: Record<string, string>) {
    if (s.mode === 'demo') { chat.retire(a.id); set({ action: undefined, toast: 'Demostración: no se envió nada (datos ficticios).' }); return; }
    try {
      const r = await api<{ text: string }>(`/actions/${a.id}/confirm`, { token: a.token, edits });
      chat.retire(a.id);
      set({ action: undefined, toast: r.text, messages: [...s.messages, { role: 'assistant', text: r.text, cards: [] }] });
      speakFor(r.text);
    } catch (e) { chat.retire(a.id); set({ action: undefined, toast: (e as Error).message }); }
  },

  async cancel(a: ActionCard) {
    if (s.mode === 'server') await api(`/actions/${a.id}/cancel`, {}).catch(() => {});
    chat.retire(a.id);
    set({ action: undefined, toast: 'Cancelado. No se hizo nada.' });
  },

  clearToast() { set({ toast: undefined }); },
};

/** La presencia "habla" mientras dura la respuesta (en la etapa 5 seguirá al audio real). */
function speakFor(text: string) {
  presence.set({ state: 'speak' });
  const ms = Math.min(6000, 1200 + text.length * 25);
  window.setTimeout(() => { if (presence.get().state === 'speak') presence.set({ state: 'calm' }); }, ms);
}

/** Respuestas de demostración (sin servidor). */
async function demoReply(text: string): Promise<ChatReply> {
  await new Promise((r) => setTimeout(r, 1200));
  const t = text.toLowerCase();
  const base = { conversationId: 'demo', mode: 'normal' as const };
  if (/correo|env[ií]a|manda/.test(t)) {
    return { ...base, text: 'Lo dejé listo, pero no se ha enviado. Revísalo y confirma si está bien.', cards: [{
      type: 'action', id: 'demo', token: 'demo', tool: 'gmail_send', title: '¿Envío este correo?', verbalOk: true, expiresAt: new Date(Date.now() + 3e5).toISOString(),
      fields: [{ label: 'Para', value: mock.draft.to }, { label: 'Asunto', value: mock.draft.subject }], preview: mock.draft.body }] };
  }
  if (/hoy|agenda|sigue|d[ií]a/.test(t)) {
    const d = new Date().toLocaleDateString('en-CA', { timeZone: s.tz });
    return { ...base, text: `Hoy tienes ${mock.day.length} compromisos. Lo primero: ${mock.day[0].title} a las ${mock.day[0].time}.`, cards: [{
      type: 'events', items: mock.day.map((e, i) => ({ id: `d${i}`, title: e.title, start: `${d}T${e.time}:00-05:00`, end: `${d}T${e.time}:00-05:00`, location: e.place })) }] };
  }
  return { ...base, text: 'Estoy en modo demostración: el servidor no está conectado, así que no puedo consultar nada real todavía.', cards: [] };
}
