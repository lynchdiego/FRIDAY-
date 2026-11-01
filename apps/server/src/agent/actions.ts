import type { Db } from '../db';
import type { Card } from '@friday/shared';
import type { Integrations } from '../integrations/types';
import { randomToken, sha256 } from '../security/crypto';
import { audit } from './audit';
import { fmt, inTz } from '../tools/time';

/**
 * Acciones ACTÚA: el modelo solo puede PROPONERLAS. Aquí se guardan con un token de un
 * solo uso (solo su hash en la base) que viaja a la pantalla de Diego, nunca al modelo.
 * Ejecutar exige: token correcto + estado pendiente + no vencido. Atómico: un solo uso.
 */
const TITLES: Record<string, string> = { gmail_send: '¿Envío este correo?', event_create: '¿Creo este evento?', event_update: '¿Cambio este evento?' };

export function describeAction(tool: string, input: any, tz: string) {
  if (tool === 'gmail_send') return {
    summary: `enviar un correo a ${input.to} con asunto «${input.subject}»`,
    fields: [{ label: 'Para', value: input.to }, { label: 'Asunto', value: input.subject }], preview: input.body as string,
  };
  if (tool === 'event_create') return {
    summary: `crear el evento «${input.title}» el ${fmt(inTz(input.start, tz), tz)}`,
    fields: [{ label: 'Evento', value: input.title }, { label: 'Inicio', value: fmt(inTz(input.start, tz), tz) }, { label: 'Fin', value: fmt(inTz(input.end, tz), tz) },
      ...(input.location ? [{ label: 'Lugar', value: input.location }] : []), ...(input.attendees?.length ? [{ label: 'Invitados', value: input.attendees.join(', ') }] : [])],
    preview: input.description as string | undefined,
  };
  const ch = Object.entries(input).filter(([k]) => k !== 'id').map(([k, v]) => ({ label: k, value: /start|end/.test(k) ? fmt(inTz(String(v), tz), tz) : String(v) }));
  return { summary: `cambiar el evento ${input.id}`, fields: [{ label: 'Evento', value: input.id }, ...ch] };
}

export async function proposeAction(db: Db, p: { userId: number; conversationId: string; tool: string; input: any; verbalOk: boolean; ttlSeconds: number; tz: string }) {
  const id = `act_${randomToken(9)}`;
  const token = randomToken(32);
  const d = describeAction(p.tool, p.input, p.tz);
  const expiresAt = new Date(Date.now() + p.ttlSeconds * 1000);
  // Una nueva propuesta reemplaza a las anteriores de la misma conversación (evita confirmar algo viejo).
  await db.query(`UPDATE pending_actions SET status='cancelada', decided_at=now() WHERE conversation_id=$1 AND status='pendiente'`, [p.conversationId]);
  await db.query(
    `INSERT INTO pending_actions(id, user_id, conversation_id, tool, input, summary, token_hash, verbal_ok, status, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pendiente',$9)`,
    [id, p.userId, p.conversationId, p.tool, JSON.stringify(p.input), d.summary, sha256(token), p.verbalOk, expiresAt.toISOString()],
  );
  await audit(db, p.userId, 'propuesta', p.tool, { input: p.input, verbalOk: p.verbalOk }, id);
  const card: Card = { type: 'action', id, token, tool: p.tool, title: TITLES[p.tool] ?? '¿Lo hago?', fields: d.fields, preview: d.preview, expiresAt: expiresAt.toISOString(), verbalOk: p.verbalOk };
  return { id, card, summary: d.summary };
}

/** Frase en pasado para cuando la acción ya se ejecutó. */
export function doneText(tool: string, input: any, tz: string) {
  if (tool === 'gmail_send') return `Correo enviado a ${input.to}: «${input.subject}».`;
  if (tool === 'event_create') return `Evento creado: «${input.title}», ${fmt(inTz(input.start, tz), tz)}.`;
  return 'Evento actualizado.';
}

export type ConfirmResult =
  | { ok: true; summary: string; done: string; result: unknown }
  | { ok: false; reason: 'invalido' | 'vencido' | 'fallo'; message: string };

/**
 * Confirma y ejecuta. `edits` permite que Diego corrija el contenido antes de confirmar.
 * - Con `token`: confirmación desde la pantalla (botón Enviar).
 * - Sin `token`: "sí" escrito o dicho por Diego en su sesión; solo vale si la acción
 *   se preparó sin leer contenido externo en ese turno (verbal_ok).
 */
export async function confirmAction(db: Db, integ: Integrations, p: { userId: number; id: string; token?: string; tz: string; edits?: Record<string, string>; via: 'pantalla' | 'voz' | 'texto' }): Promise<ConfirmResult> {
  if (!p.token && p.edits) throw new Error('Las ediciones solo se aceptan desde la pantalla');
  const r = p.token
    ? await db.query<any>(
      `UPDATE pending_actions SET status='en_proceso', decided_at=now()
       WHERE id=$1 AND user_id=$2 AND token_hash=$3 AND status='pendiente' AND expires_at > now() RETURNING *`,
      [p.id, p.userId, sha256(p.token)])
    : await db.query<any>(
      `UPDATE pending_actions SET status='en_proceso', decided_at=now()
       WHERE id=$1 AND user_id=$2 AND verbal_ok AND status='pendiente' AND expires_at > now() RETURNING *`,
      [p.id, p.userId]);
  const row = r.rows[0];
  if (!row) {
    const ex = (await db.query<any>('SELECT status, expires_at FROM pending_actions WHERE id=$1 AND user_id=$2', [p.id, p.userId])).rows[0];
    const vencido = ex && ex.status === 'pendiente' && new Date(ex.expires_at) <= new Date();
    await audit(db, p.userId, 'rechazada', null, { motivo: vencido ? 'vencido' : 'token inválido o ya usado', via: p.via }, p.id);
    return vencido ? { ok: false, reason: 'vencido', message: 'La confirmación venció. Pídeme que la prepare de nuevo.' }
      : { ok: false, reason: 'invalido', message: 'Esta confirmación no es válida o ya se usó.' };
  }
  const input = { ...row.input, ...pickEdits(row.tool, p.edits) };
  await audit(db, p.userId, 'confirmada', row.tool, { via: p.via, editado: !!p.edits }, row.id);
  try {
    const result = await execute(integ, row.tool, input, p.tz);
    await db.query(`UPDATE pending_actions SET status='ejecutada', result=$2, input=$3 WHERE id=$1`, [row.id, JSON.stringify(result), JSON.stringify(input)]);
    await audit(db, p.userId, 'ejecutada', row.tool, { result }, row.id);
    const summary = describeAction(row.tool, input, p.tz).summary;
    if (row.conversation_id) await db.query('INSERT INTO conversation_events(conversation_id, text) VALUES ($1,$2)', [row.conversation_id, `Diego confirmó (${p.via}) y se ejecutó con éxito: ${summary}.`]);
    return { ok: true, summary, done: doneText(row.tool, input, p.tz), result };
  } catch (err: any) {
    await db.query(`UPDATE pending_actions SET status='fallida', result=$2 WHERE id=$1`, [row.id, JSON.stringify({ error: String(err?.message ?? err) })]);
    await audit(db, p.userId, 'fallida', row.tool, { error: String(err?.message ?? err) }, row.id);
    if (row.conversation_id) await db.query('INSERT INTO conversation_events(conversation_id, text) VALUES ($1,$2)', [row.conversation_id, `Diego confirmó, pero falló: ${String(err?.message ?? err)}. No se hizo nada.`]);
    return { ok: false, reason: 'fallo', message: `No se pudo completar: ${err?.message ?? err}` };
  }
}

/** Nuevo token para una acción pendiente (el anterior deja de servir). */
export async function reissueAction(db: Db, userId: number, id: string, ttlSeconds: number, tz: string): Promise<Card | null> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const r = await db.query<any>(`UPDATE pending_actions SET token_hash=$3, expires_at=$4 WHERE id=$1 AND user_id=$2 AND status='pendiente' RETURNING tool, input, verbal_ok`,
    [id, userId, sha256(token), expiresAt.toISOString()]);
  const row = r.rows[0];
  if (!row) return null;
  const d = describeAction(row.tool, row.input, tz);
  return { type: 'action', id, token, tool: row.tool, title: TITLES[row.tool] ?? '¿Lo hago?', fields: d.fields, preview: d.preview, expiresAt: expiresAt.toISOString(), verbalOk: row.verbal_ok };
}

export async function cancelAction(db: Db, userId: number, id: string) {
  const r = await db.query<any>(`UPDATE pending_actions SET status='cancelada', decided_at=now() WHERE id=$1 AND user_id=$2 AND status='pendiente' RETURNING tool, conversation_id, summary`, [id, userId]);
  const row = r.rows[0];
  if (!row) return false;
  await audit(db, userId, 'cancelada', row.tool, null, id);
  if (row.conversation_id) await db.query('INSERT INTO conversation_events(conversation_id, text) VALUES ($1,$2)', [row.conversation_id, `Diego canceló: ${row.summary}. No se hizo.`]);
  return true;
}

/** Solo se pueden editar campos de contenido, nunca el tipo de acción. */
function pickEdits(tool: string, edits?: Record<string, string>) {
  if (!edits) return {};
  const allowed = tool === 'gmail_send' ? ['to', 'subject', 'body'] : ['title', 'start', 'end', 'location', 'description'];
  return Object.fromEntries(Object.entries(edits).filter(([k, v]) => allowed.includes(k) && typeof v === 'string' && v.length));
}

async function execute(integ: Integrations, tool: string, input: any, tz: string) {
  switch (tool) {
    case 'gmail_send': return integ.mail.send({ to: input.to, subject: input.subject, body: input.body, replyToId: input.reply_to_id });
    case 'event_create': return integ.calendar.create({ ...input, start: inTz(input.start, tz), end: inTz(input.end, tz) });
    case 'event_update': {
      const { id, ...patch } = input;
      for (const k of ['start', 'end']) if (patch[k]) patch[k] = inTz(patch[k], tz);
      return integ.calendar.update(id, patch);
    }
    default: throw new Error(`Acción desconocida: ${tool}`);
  }
}
