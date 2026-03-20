-- Campos adicionais para compartilhamentos: validade, limite de acessos e contador
ALTER TABLE compartilhamentos
  ADD COLUMN IF NOT EXISTS expires_at     TIMESTAMPTZ,         -- null = sem validade
  ADD COLUMN IF NOT EXISTS max_downloads  INT,                 -- null = sem limite
  ADD COLUMN IF NOT EXISTS download_count INT NOT NULL DEFAULT 0; -- acessos realizados
