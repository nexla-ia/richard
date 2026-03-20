-- Tabela de pastas (hierarquia infinita via parent_id)
CREATE TABLE IF NOT EXISTS pastas (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        TEXT        NOT NULL,
  parent_id   BIGINT      REFERENCES pastas(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pastas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pastas_own" ON pastas
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger updated_at
CREATE TRIGGER set_pastas_updated_at
  BEFORE UPDATE ON pastas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
