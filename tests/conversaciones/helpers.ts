import { loadConfig } from '../../apps/server/src/config';
import { openDb } from '../../apps/server/src/db';
import { buildApp } from '../../apps/server/src/app';
import { createMockLlm } from '../../apps/server/src/llm/mock';
import { createAnthropicLlm } from '../../apps/server/src/llm/anthropic';
import { createMockIntegrations } from '../../apps/server/src/integrations/mock';
import { runTurn } from '../../apps/server/src/agent/run';
import type { Llm } from '../../apps/server/src/llm/types';

/** LIVE=1 usa Claude real (cuesta centavos); si no, el Claude simulado (gratis). */
export const LIVE = process.env.LIVE === '1' && !!process.env.ANTHROPIC_API_KEY;

export async function harness(opts: { naive?: boolean; env?: Record<string, string>; llm?: Llm } = {}) {
  const config = loadConfig({ NODE_ENV: 'test', FRIDAY_PASSWORD: 'prueba-segura-123', ...(LIVE ? { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY } : { LLM_PROVIDER: 'mock' }), ...opts.env });
  const db = await openDb({ memory: true });
  const base = opts.llm ?? (LIVE ? createAnthropicLlm(process.env.ANTHROPIC_API_KEY!) : createMockLlm({ tz: config.FRIDAY_TZ, naive: opts.naive }));
  let calls = 0;
  const llm: Llm = { name: base.name, create: (r) => { calls++; return base.create(r); } };
  const { integrations, state } = createMockIntegrations({ tz: config.FRIDAY_TZ });
  const deps = { db, llm, integ: integrations, config };
  const pushed: { endpoint: string; payload: any }[] = [];
  const push = { send: async (sub: { endpoint: string }, payload: string) => {
    if (sub.endpoint.includes('vencido')) throw Object.assign(new Error('gone'), { statusCode: 410 });
    pushed.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
  } };
  const app = await buildApp(deps, { push });
  const say = (text: string, conversationId?: string) => runTurn(deps, { userId: 1, text, conversationId });
  const login = async () => {
    const r = await app.inject({ method: 'POST', url: '/api/login', payload: { password: 'prueba-segura-123' } });
    return String(r.headers['set-cookie']).split(';')[0];
  };
  const audit = async () => (await db.query<any>('SELECT event, tool, detail FROM audit_log ORDER BY id')).rows;
  return { config, db, deps, app, state, push, pushed, say, login, audit, llmCalls: () => calls, close: async () => { await app.close(); await db.close(); } };
}
