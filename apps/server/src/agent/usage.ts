import type { Db } from '../db';
import type { LlmUsage } from '../llm/types';
import { estimateCost } from '../llm/pricing';

export async function recordUsage(db: Db, userId: number, conversationId: string, model: string, u: LlmUsage) {
  const cost = estimateCost(model, u);
  await db.query(
    'INSERT INTO usage_log(user_id, conversation_id, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [userId, conversationId, model, u.input, u.output, u.cacheRead, u.cacheWrite, cost],
  );
  return cost;
}

/** Gasto del día y del mes, en la zona horaria de Diego. */
export async function spend(db: Db, userId: number, tz: string) {
  const r = await db.query<{ today: string; month: string; tokens_today: string }>(
    `SELECT
       COALESCE(SUM(cost_usd) FILTER (WHERE (at AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date), 0) AS today,
       COALESCE(SUM(cost_usd) FILTER (WHERE date_trunc('month', at AT TIME ZONE $2) = date_trunc('month', now() AT TIME ZONE $2)), 0) AS month,
       COALESCE(SUM(input_tokens + output_tokens + cache_read_tokens + cache_write_tokens) FILTER (WHERE (at AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date), 0) AS tokens_today
     FROM usage_log WHERE user_id = $1`,
    [userId, tz],
  );
  const row = r.rows[0];
  return { today: Number(row.today), month: Number(row.month), tokensToday: Number(row.tokens_today) };
}
