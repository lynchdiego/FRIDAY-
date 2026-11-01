import { loadConfig } from './config';
import { openDb } from './db';
import { buildApp } from './app';
import { createAnthropicLlm } from './llm/anthropic';
import { createMockLlm } from './llm/mock';
import { createMockIntegrations } from './integrations/mock';

const config = loadConfig();
const db = await openDb({ url: config.DATABASE_URL, pgliteDir: config.PGLITE_DIR });
const llm = config.llmProvider === 'anthropic' ? createAnthropicLlm(config.ANTHROPIC_API_KEY!) : createMockLlm({ tz: config.FRIDAY_TZ });
const { integrations } = createMockIntegrations({ tz: config.FRIDAY_TZ }); // Google real: etapa 4
const app = await buildApp({ db, llm, integ: integrations, config });
await app.listen({ port: config.PORT, host: '0.0.0.0' });
app.log.info(`FRIDAY lista en :${config.PORT} — modelo: ${llm.name}, integraciones: ${integrations.name}`);
