-- FRIDAY: esquema inicial. Todas las tablas tienen user_id para crecer a multiusuario (NODO).
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,                       -- hash SHA-256 del token de sesión
  user_id INT NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS settings (
  user_id INT NOT NULL REFERENCES users(id),
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  PRIMARY KEY (user_id, key)
);
-- Memoria: perfil, preferencias, personas y proyectos
CREATE TABLE IF NOT EXISTS memories (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('perfil','preferencia','persona','proyecto','dato')),
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  done_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS reminders (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  delivered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Mensajes en el formato exacto de la API (se reenvían sin modificar: solo se agregan)
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content JSONB NOT NULL,
  display TEXT,
  cards JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_conv ON messages(conversation_id, id);
-- Avisos del sistema que el modelo debe conocer en su siguiente turno (p. ej. "Diego confirmó")
CREATE TABLE IF NOT EXISTS conversation_events (
  id SERIAL PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  text TEXT NOT NULL,
  delivered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Historial resumido por día (se llena en etapas siguientes)
CREATE TABLE IF NOT EXISTS summaries (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  day DATE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Acciones ACTÚA esperando el "sí" de Diego. El token se guarda solo como hash.
CREATE TABLE IF NOT EXISTS pending_actions (
  id TEXT PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  conversation_id TEXT REFERENCES conversations(id),
  tool TEXT NOT NULL,
  input JSONB NOT NULL,
  summary TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  verbal_ok BOOLEAN NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pendiente','en_proceso','ejecutada','fallida','cancelada')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  result JSONB
);
-- Registro de auditoría: qué se propuso, qué se confirmó y qué se ejecutó
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event TEXT NOT NULL,
  tool TEXT,
  action_id TEXT,
  detail JSONB
);
-- Costos: tokens y costo estimado por llamada al modelo
CREATE TABLE IF NOT EXISTS usage_log (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  conversation_id TEXT,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  model TEXT NOT NULL,
  input_tokens INT NOT NULL,
  output_tokens INT NOT NULL,
  cache_read_tokens INT NOT NULL DEFAULT 0,
  cache_write_tokens INT NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12,6) NOT NULL
);
-- Tokens de Google cifrados (etapa 4)
CREATE TABLE IF NOT EXISTS google_connections (
  user_id INT PRIMARY KEY REFERENCES users(id),
  token_enc TEXT NOT NULL,
  scopes TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
