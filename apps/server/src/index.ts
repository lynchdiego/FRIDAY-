import { loadConfig } from './config';
import { openDb } from './db';
import { buildApp } from './app';
import { createAnthropicLlm } from './llm/anthropic';
import { createMockLlm } from './llm/mock';
import { createMockIntegrations } from './integrations/mock';
import { createGoogleIntegrations } from './integrations/google';
import { startScheduler } from './scheduler';
import { webPushSender } from './notify';

const config = loadConfig();
const db = await openDb({ url: config.DATABASE_URL, pgliteDir: config.PGLITE_DIR });
const llm = config.llmProvider === 'anthropic' ? createAnthropicLlm(config.ANTHROPIC_API_KEY!) : createMockLlm({ tz: config.FRIDAY_TZ });
const integrations = config.INTEGRATIONS === 'google' ? createGoogleIntegrations(db, config) : createMockIntegrations({ tz: config.FRIDAY_TZ }).integrations;
const deps = { db, llm, integ: integrations, config };
const app = await buildApp(deps);
startScheduler(deps, webPushSender(db, config), (m) => app.log.warn(m));
await app.listen({ port: config.PORT, host: '0.0.0.0' });
app.log.info(`FRIDAY lista en :${config.PORT} — modelo: ${llm.name}, integraciones: ${integrations.name}`);
