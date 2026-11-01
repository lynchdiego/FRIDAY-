import { z } from 'zod';

// Toda la configuración viene de variables de entorno (ver .env.example).
// Las llaves nunca se escriben en el código ni se envían al navegador.
const Env = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(8787),
  FRIDAY_PASSWORD: z.string().min(8, 'FRIDAY_PASSWORD debe tener al menos 8 caracteres'),
  ENCRYPTION_KEY: z.string().optional(), // 32 bytes en base64; obligatorio en producción
  DATABASE_URL: z.string().optional(), // si falta, se usa PGlite (Postgres local en archivo)
  PGLITE_DIR: z.string().default('./data/pglite'),
  LLM_PROVIDER: z.enum(['anthropic', 'mock']).optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  MODEL_DEFAULT: z.string().default('claude-sonnet-5-5'),
  MODEL_HEAVY: z.string().default('claude-opus-5-5'),
  DAILY_LIMIT_USD: z.coerce.number().default(2),
  ACTION_TTL_SECONDS: z.coerce.number().default(300),
  FRIDAY_TZ: z.string().default('America/Cancun'),
  OWNER_NAME: z.string().default('Diego'),
  INTEGRATIONS: z.enum(['mock', 'google']).default('mock'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  PUBLIC_URL: z.string().default('http://localhost:5173'), // dirección desde la que Diego abre la app
});

export type Config = z.infer<typeof Env> & { llmProvider: 'anthropic' | 'mock' };

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuración incompleta:\n${msg}`);
  }
  const c = parsed.data;
  if (c.NODE_ENV === 'production' && !c.ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY es obligatoria en producción');
  const llmProvider = c.LLM_PROVIDER ?? (c.ANTHROPIC_API_KEY ? 'anthropic' : 'mock');
  if (llmProvider === 'anthropic' && !c.ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY');
  if (c.INTEGRATIONS === 'google' && !(c.GOOGLE_CLIENT_ID && c.GOOGLE_CLIENT_SECRET && c.ENCRYPTION_KEY))
    throw new Error('Para usar Google faltan GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET o ENCRYPTION_KEY');
  return { ...c, llmProvider };
}
