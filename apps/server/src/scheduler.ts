import type { Deps } from './agent/run';
import type { PushSender } from './notify';
import { notify } from './notify';
import { today } from './agent/today';
import { audit } from './agent/audit';

/**
 * Tareas programadas del piloto:
 * - Recordatorios: cada minuto revisa los que ya vencieron y avisa.
 * - Resumen del día: a la hora de BRIEFING_TIME (7:30), una vez al día, hasta mediodía.
 * Diseñado para n8n: las mismas funciones se pueden disparar por webhook (/api/hooks/*)
 * y apagar el programador interno con SCHEDULER=off.
 */
export async function runReminders(deps: Deps, sender: PushSender, userId = 1) {
  const due = await deps.db.query<any>(
    `UPDATE reminders SET delivered=true WHERE user_id=$1 AND NOT delivered AND remind_at <= now() RETURNING id, text`, [userId]);
  for (const r of due.rows) await notify(deps.db, sender, userId, { kind: 'recordatorio', title: 'Recordatorio', body: r.text, url: '/#inicio' });
  return due.rows.length;
}

export async function runBriefing(deps: Deps, sender: PushSender, userId = 1, opts: { force?: boolean; now?: Date } = {}) {
  const { db, config } = deps;
  const now = opts.now ?? new Date();
  const tz = config.FRIDAY_TZ;
  const date = now.toLocaleDateString('en-CA', { timeZone: tz });
  const hhmm = now.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  if (!opts.force && (hhmm < config.BRIEFING_TIME || hhmm >= '12:00')) return false;
  // Marca atómica: si dos procesos corren a la vez, solo uno envía el resumen.
  const mark = await db.query(`INSERT INTO settings(user_id, key, value) VALUES ($1,$2,'{"enviado":true}') ON CONFLICT (user_id, key) DO NOTHING RETURNING key`, [userId, `resumen_enviado:${date}`]);
  if (!mark.rows.length && !opts.force) return false;
  const d = await today(deps, userId);
  const n = d.events.length;
  const agenda = n === 0 ? 'Hoy no tienes eventos.' : n === 1 ? 'Tienes un compromiso hoy.' : `Tienes ${n} compromisos hoy.`;
  const correo = d.emails.length ? ` ${d.emails.length} correos sin leer.` : '';
  const body = `${agenda}${correo}${d.priority ? ` Prioridad: ${d.priority}` : ''}`;
  await notify(db, sender, userId, { kind: 'resumen', title: 'Tu día', body, url: '/#hoy' });
  await audit(db, userId, 'ejecutada', 'resumen_programado', { fecha: date, errores: d.errors });
  return true;
}

export function startScheduler(deps: Deps, sender: PushSender, log: (m: string) => void) {
  if (deps.config.SCHEDULER !== 'internal') return () => {};
  const tick = async () => {
    try { await runReminders(deps, sender); await runBriefing(deps, sender); }
    catch (e) { log(`programador: ${(e as Error).message}`); }
  };
  const t = setInterval(tick, 30_000);
  tick();
  return () => clearInterval(t);
}
