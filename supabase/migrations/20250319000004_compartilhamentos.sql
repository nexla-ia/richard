CREATE TABLE IF NOT EXISTS compartilhamentos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pasta_id     BIGINT      REFERENCES pastas(id) ON DELETE CASCADE,
  storage_path TEXT        NOT NULL,  -- caminho no Storage ex: "userId/pastaId"
  nome         TEXT        NOT NULL,  -- nome da pasta para exibição pública
  senha        TEXT,                  -- opcional, plain text (pode usar hash depois)
  ativo        BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE compartilhamentos ENABLE ROW LEVEL SECURITY;

-- Dono gerencia os próprios
CREATE POLICY "compartilhamentos_owner" ON compartilhamentos
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Anônimos podem ler (para validar token na página pública)
CREATE POLICY "compartilhamentos_public_read" ON compartilhamentos
  FOR SELECT
  TO anon
  USING (ativo = true);
