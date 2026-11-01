ALTER TABLE google_connections ADD COLUMN IF NOT EXISTS email TEXT;
-- OAuth: estado anti-falsificación (CSRF) de un solo uso
CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL
);
