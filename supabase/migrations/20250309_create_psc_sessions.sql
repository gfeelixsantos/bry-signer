CREATE TABLE IF NOT EXISTS psc_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_codigo text NOT NULL,
  user_cpf text NULL,
  user_nome text NULL,
  user_perfil text NULL,
  conselho text NULL,
  ufconselho text NULL,
  state text NOT NULL UNIQUE,
  psc_name text NOT NULL,
  signature_session text NOT NULL,
  integra_url text NOT NULL DEFAULT 'https://integra.bry.com.br/api/service',
  is_authorized boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_in integer NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NULL,
  invalid_reason text NULL
);

CREATE INDEX IF NOT EXISTS idx_psc_sessions_user_codigo ON psc_sessions(user_codigo);
CREATE INDEX IF NOT EXISTS idx_psc_sessions_expires_at ON psc_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_psc_sessions_is_authorized ON psc_sessions(is_authorized);
CREATE INDEX IF NOT EXISTS idx_psc_sessions_user_auth ON psc_sessions(user_codigo, is_authorized);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_psc_sessions_updated_at ON psc_sessions;
CREATE TRIGGER update_psc_sessions_updated_at
    BEFORE UPDATE ON psc_sessions
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
