-- =============================================
-- Migration 002 — Tabela de configurações
-- Studio Foto Charme
-- =============================================

-- Uma linha por usuário com as preferências de cobrança automática

CREATE TABLE IF NOT EXISTS public.configuracoes (
  user_id    UUID        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  ativo      BOOLEAN     NOT NULL DEFAULT false,
  dia_mes    SMALLINT    NOT NULL DEFAULT 5 CHECK (dia_mes BETWEEN 1 AND 28),
  horario    TIME        NOT NULL DEFAULT '08:00',
  mensagem   TEXT        NOT NULL DEFAULT 'Olá {nome}! Sua cobrança de {valor} vence no dia {dia}. Por favor, realize o pagamento em dia!',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "configuracoes_select_own"
  ON public.configuracoes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "configuracoes_insert_own"
  ON public.configuracoes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "configuracoes_update_own"
  ON public.configuracoes FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS configuracoes_updated_at ON public.configuracoes;
CREATE TRIGGER configuracoes_updated_at
  BEFORE UPDATE ON public.configuracoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
