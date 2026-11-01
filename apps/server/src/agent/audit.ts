import type { Db } from '../db';

export type AuditEvent = 'herramienta' | 'propuesta' | 'confirmada' | 'ejecutada' | 'fallida' | 'cancelada' | 'rechazada' | 'limite' | 'error';

/** Registro de auditoría: cada propuesta, confirmación, ejecución y rechazo queda guardado. */
export async function audit(db: Db, userId: number, event: AuditEvent, tool: string | null, detail: unknown, actionId?: string) {
  await db.query('INSERT INTO audit_log(user_id, event, tool, action_id, detail) VALUES ($1,$2,$3,$4,$5)', [userId, event, tool, actionId ?? null, JSON.stringify(detail ?? null)]);
}
