import { OAuth2Client, type Credentials } from 'google-auth-library';
import { calendar as gcal, type calendar_v3 } from '@googleapis/calendar';
import { gmail as gmailApi, type gmail_v1 } from '@googleapis/gmail';
import { tasks as gtasks } from '@googleapis/tasks';
import type { Db } from '../db';
import type { Config } from '../config';
import type { Integrations, CalendarEvent, Email, EmailSummary, NewEvent, Service } from './types';
import { IntegrationError } from './types';
import { encrypt, decrypt } from '../security/crypto';
import { tzOffset } from './mock';

/**
 * Google real (Calendar, Gmail, Tasks) con OAuth oficial y permisos mínimos.
 * Los tokens se guardan cifrados (AES-256-GCM) en google_connections.
 */
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events', // ver y editar eventos (no ajustes ni otros calendarios)
  'https://www.googleapis.com/auth/gmail.readonly', // leer correos
  'https://www.googleapis.com/auth/gmail.compose', // crear borradores y enviar (solo tras el "sí")
  'https://www.googleapis.com/auth/tasks', // Google Tasks
];
const REQUIRED = GOOGLE_SCOPES.filter((s) => s.startsWith('https://'));

export function googleConfigured(c: Config) { return !!(c.GOOGLE_CLIENT_ID && c.GOOGLE_CLIENT_SECRET && c.ENCRYPTION_KEY); }

export function oauthClient(c: Config) {
  return new OAuth2Client({ clientId: c.GOOGLE_CLIENT_ID, clientSecret: c.GOOGLE_CLIENT_SECRET, redirectUri: `${c.PUBLIC_URL}/api/google/callback` });
}

export function authUrl(c: Config, state: string) {
  return oauthClient(c).generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: GOOGLE_SCOPES, state, include_granted_scopes: true });
}

/** Intercambia el código de Google por tokens y los guarda cifrados. */
export async function saveConnection(db: Db, c: Config, userId: number, code: string) {
  const { tokens } = await oauthClient(c).getToken(code);
  const granted = (tokens.scope ?? '').split(' ');
  const missing = REQUIRED.filter((s) => !granted.includes(s));
  if (missing.length) throw new Error('Faltan permisos. Vuelve a conectar y marca todas las casillas.');
  if (!tokens.refresh_token) throw new Error('Google no entregó acceso permanente. Desconecta FRIDAY en tu cuenta de Google y vuelve a conectar.');
  const email = emailFromIdToken(tokens.id_token);
  await db.query(
    `INSERT INTO google_connections(user_id, token_enc, scopes, email) VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id) DO UPDATE SET token_enc=$2, scopes=$3, email=$4, updated_at=now()`,
    [userId, encrypt(JSON.stringify(tokens), c.ENCRYPTION_KEY!), tokens.scope ?? '', email],
  );
  return email;
}

export async function connectionStatus(db: Db, userId: number) {
  const r = await db.query<any>('SELECT email, updated_at FROM google_connections WHERE user_id=$1', [userId]);
  return r.rows[0] ? { connected: true, email: r.rows[0].email as string | null } : { connected: false, email: null };
}

export async function disconnect(db: Db, c: Config, userId: number) {
  const r = await db.query<any>('SELECT token_enc FROM google_connections WHERE user_id=$1', [userId]);
  if (r.rows[0] && c.ENCRYPTION_KEY) {
    const t: Credentials = JSON.parse(decrypt(r.rows[0].token_enc, c.ENCRYPTION_KEY));
    await oauthClient(c).revokeToken(t.refresh_token ?? t.access_token ?? '').catch(() => {});
  }
  await db.query('DELETE FROM google_connections WHERE user_id=$1', [userId]);
}

function emailFromIdToken(idToken?: string | null) {
  try { return idToken ? (JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString()).email as string) : null; } catch { return null; }
}

/** Integraciones reales. Cada llamada carga el acceso (cifrado) y traduce los errores. */
export function createGoogleIntegrations(db: Db, c: Config, userId = 1): Integrations {
  async function auth() {
    const r = await db.query<any>('SELECT token_enc FROM google_connections WHERE user_id=$1', [userId]);
    if (!r.rows[0]) throw new IntegrationError('Google', 'Google no está conectado. Conéctalo en Ajustes.');
    const client = oauthClient(c);
    const creds: Credentials = JSON.parse(decrypt(r.rows[0].token_enc, c.ENCRYPTION_KEY!));
    client.setCredentials(creds);
    client.on('tokens', (t) => {
      const merged = { ...creds, ...t };
      db.query('UPDATE google_connections SET token_enc=$2, updated_at=now() WHERE user_id=$1', [userId, encrypt(JSON.stringify(merged), c.ENCRYPTION_KEY!)]).catch(() => {});
    });
    return client;
  }
  const wrap = async <T>(service: Service, fn: () => Promise<T>): Promise<T> => {
    try { return await fn(); } catch (err: any) {
      if (err instanceof IntegrationError) throw err;
      const msg = String(err?.response?.data?.error ?? err?.message ?? err);
      if (/invalid_grant|unauthorized_client|invalid_token/i.test(msg)) throw new IntegrationError('Google', 'Google retiró el acceso. Vuelve a conectar Google.');
      if (err?.code === 404 || err?.status === 404) throw new IntegrationError(service, 'No encontré ese elemento.');
      throw new IntegrationError(service, `${service} respondió con un error (${err?.code ?? err?.status ?? 'sin código'}).`);
    }
  };
  const tz = c.FRIDAY_TZ;

  return {
    name: 'google',
    calendar: {
      list: (from, to) => wrap('Google Calendar', async () => {
        const api = gcal({ version: 'v3', auth: await auth() });
        const r = await api.events.list({ calendarId: 'primary', timeMin: from, timeMax: to, singleEvents: true, orderBy: 'startTime', maxResults: 50, timeZone: tz });
        return (r.data.items ?? []).filter((e) => e.status !== 'cancelled').map((e) => mapEvent(e, tz));
      }),
      create: (e) => wrap('Google Calendar', async () => {
        const api = gcal({ version: 'v3', auth: await auth() });
        const r = await api.events.insert({ calendarId: 'primary', sendUpdates: e.attendees?.length ? 'all' : 'none', requestBody: eventBody(e, tz) });
        return mapEvent(r.data, tz);
      }),
      update: (id, patch) => wrap('Google Calendar', async () => {
        const api = gcal({ version: 'v3', auth: await auth() });
        const r = await api.events.patch({ calendarId: 'primary', eventId: id, sendUpdates: 'all', requestBody: eventBody(patch, tz) });
        return mapEvent(r.data, tz);
      }),
    },
    mail: {
      search: (q, max) => wrap('Gmail', async () => {
        const api = gmailApi({ version: 'v1', auth: await auth() });
        const r = await api.users.messages.list({ userId: 'me', q, maxResults: max });
        const ids = (r.data.messages ?? []).map((m) => m.id!).filter(Boolean);
        const full = await Promise.all(ids.map((id) => api.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] })));
        return full.map((m) => summary(m.data));
      }),
      read: (id) => wrap('Gmail', async () => {
        const api = gmailApi({ version: 'v1', auth: await auth() });
        const m = (await api.users.messages.get({ userId: 'me', id, format: 'full' })).data;
        return { ...summary(m), to: header(m.payload, 'To'), body: extractBody(m.payload).slice(0, 20000) } satisfies Email;
      }),
      draft: (m) => wrap('Gmail', async () => {
        const api = gmailApi({ version: 'v1', auth: await auth() });
        const reply = m.replyToId ? await replyInfo(api, m.replyToId) : undefined;
        const r = await api.users.drafts.create({ userId: 'me', requestBody: { message: { raw: buildRaw({ ...m, ...reply }), threadId: reply?.threadId } } });
        return { draftId: r.data.id ?? '' };
      }),
      send: (m) => wrap('Gmail', async () => {
        const api = gmailApi({ version: 'v1', auth: await auth() });
        const reply = m.replyToId ? await replyInfo(api, m.replyToId) : undefined;
        const r = await api.users.messages.send({ userId: 'me', requestBody: { raw: buildRaw({ ...m, ...reply }), threadId: reply?.threadId } });
        return { messageId: r.data.id ?? '' };
      }),
    },
    tasks: {
      list: () => wrap('Google Tasks', async () => {
        const api = gtasks({ version: 'v1', auth: await auth() });
        const r = await api.tasks.list({ tasklist: '@default', showCompleted: false, maxResults: 100 });
        return (r.data.items ?? []).map((t) => ({ id: t.id!, title: t.title ?? '', due: t.due ?? undefined, notes: t.notes ?? undefined }));
      }),
      add: (title, due, notes) => wrap('Google Tasks', async () => {
        const api = gtasks({ version: 'v1', auth: await auth() });
        // Google Tasks solo guarda la fecha (no la hora) del vencimiento.
        const r = await api.tasks.insert({ tasklist: '@default', requestBody: { title, notes, due: due ? new Date(due).toISOString() : undefined } });
        return { id: r.data.id!, title: r.data.title ?? title, due: r.data.due ?? undefined };
      }),
      complete: (id) => wrap('Google Tasks', async () => {
        const api = gtasks({ version: 'v1', auth: await auth() });
        await api.tasks.patch({ tasklist: '@default', task: id, requestBody: { status: 'completed' } });
      }),
    },
  };
}

// ---------- Utilidades (probadas en tests) ----------

export function mapEvent(e: calendar_v3.Schema$Event, tz: string): CalendarEvent {
  const allDay = !e.start?.dateTime;
  const at = (d?: calendar_v3.Schema$EventDateTime) => d?.dateTime ?? (d?.date ? `${d.date}T00:00:00${tzOffset(tz, new Date(d.date))}` : '');
  return {
    id: e.id ?? '', title: e.summary ?? '(sin título)', start: at(e.start ?? undefined), end: at(e.end ?? undefined), allDay,
    location: e.location ?? undefined, description: e.description ?? undefined,
    attendees: (e.attendees ?? []).map((a) => a.email!).filter(Boolean),
  };
}

function eventBody(e: Partial<NewEvent>, tz: string): calendar_v3.Schema$Event {
  return {
    ...(e.title ? { summary: e.title } : {}),
    ...(e.start ? { start: { dateTime: e.start, timeZone: tz } } : {}),
    ...(e.end ? { end: { dateTime: e.end, timeZone: tz } } : {}),
    ...(e.location !== undefined ? { location: e.location } : {}),
    ...(e.description !== undefined ? { description: e.description } : {}),
    ...(e.attendees ? { attendees: e.attendees.map((email) => ({ email })) } : {}),
  };
}

export function header(p: gmail_v1.Schema$MessagePart | undefined | null, name: string) {
  return p?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function summary(m: gmail_v1.Schema$Message): EmailSummary {
  const d = header(m.payload, 'Date');
  return {
    id: m.id ?? '', from: header(m.payload, 'From'), subject: header(m.payload, 'Subject') || '(sin asunto)',
    date: d ? new Date(d).toISOString() : new Date(Number(m.internalDate ?? 0)).toISOString(),
    snippet: decodeEntities(m.snippet ?? ''), unread: (m.labelIds ?? []).includes('UNREAD'),
  };
}

/** Texto del correo: prefiere text/plain; si solo hay HTML, lo limpia. */
export function extractBody(p: gmail_v1.Schema$MessagePart | undefined | null): string {
  const find = (part: gmail_v1.Schema$MessagePart | undefined | null, type: string): string | null => {
    if (!part) return null;
    if (part.mimeType === type && part.body?.data) return Buffer.from(part.body.data, 'base64url').toString('utf8');
    for (const sub of part.parts ?? []) { const r = find(sub, type); if (r) return r; }
    return null;
  };
  const plain = find(p, 'text/plain');
  if (plain) return plain;
  const html = find(p, 'text/html');
  if (!html) return '';
  // Conservamos los comentarios HTML como texto visible: ahí suelen esconderse instrucciones maliciosas.
  return decodeEntities(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?>|<\/p>/gi, '\n').replace(/<(?!!--)[^>]+>/g, '')).replace(/\n{3,}/g, '\n\n').trim();
}

const decodeEntities = (s: string) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

async function replyInfo(api: gmail_v1.Gmail, id: string) {
  const m = (await api.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: ['Message-ID', 'References'] })).data;
  const msgId = header(m.payload, 'Message-ID');
  return { threadId: m.threadId ?? undefined, inReplyTo: msgId, references: [header(m.payload, 'References'), msgId].filter(Boolean).join(' ') };
}

/** Correo en formato RFC 822, codificado para la API de Gmail. Evita inyección de encabezados. */
export function buildRaw(m: { to: string; subject: string; body: string; inReplyTo?: string; references?: string }) {
  const clean = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();
  const subject = /^[\x20-\x7e]*$/.test(m.subject) ? clean(m.subject) : `=?UTF-8?B?${Buffer.from(clean(m.subject)).toString('base64')}?=`;
  const lines = [
    `To: ${clean(m.to)}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    ...(m.inReplyTo ? [`In-Reply-To: ${clean(m.inReplyTo)}`, `References: ${clean(m.references ?? m.inReplyTo)}`] : []),
    '',
    Buffer.from(m.body, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n'),
  ];
  return Buffer.from(lines.join('\r\n')).toString('base64url');
}
