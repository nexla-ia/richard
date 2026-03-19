-- =============================================
-- Migration 001 — Schema inicial
-- Studio Foto Charme
-- =============================================

-- ── 1. PROFILES ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT,
  full_name  TEXT,
  avatar_url TEXT,
  role       TEXT        NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. GESTÕES ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.gestoes (
  id         BIGSERIAL      PRIMARY KEY,
  user_id    UUID           NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nome       TEXT           NOT NULL DEFAULT '',
  valor      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  data       DATE           NOT NULL DEFAULT CURRENT_DATE,
  feito      TEXT           NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gestoes_user_id_idx ON public.gestoes (user_id);
CREATE INDEX IF NOT EXISTS gestoes_data_idx    ON public.gestoes (data DESC);

-- ── 3. CLIENTES (cobranças) ───────────────────

-- FIX: CREATE TYPE não tem IF NOT EXISTS no PostgreSQL 15
-- Usar bloco DO para evitar erro em execução dupla
DO $$ BEGIN
  CREATE TYPE public.cobranca_status AS ENUM ('pendente', 'cobrado', 'pago');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.clientes (
  id           BIGSERIAL              PRIMARY KEY,
  user_id      UUID                   NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nome         TEXT                   NOT NULL,
  valor        NUMERIC(12, 2)         NOT NULL DEFAULT 0,
  telefone     TEXT                   NOT NULL DEFAULT '',
  dia_cobranca SMALLINT               NOT NULL DEFAULT 1 CHECK (dia_cobranca BETWEEN 1 AND 31),
  status       public.cobranca_status NOT NULL DEFAULT 'pendente',
  cobrado_em   TEXT,                  -- data formatada pt-BR, ex: "10/03/2025"
  created_at   TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ            NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS clientes_user_id_idx ON public.clientes (user_id);
CREATE INDEX IF NOT EXISTS clientes_status_idx  ON public.clientes (status);

-- ── 4. ROW LEVEL SECURITY ────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestoes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- FIX: A policy de admin NÃO pode fazer SELECT em public.profiles diretamente
-- porque o RLS está ativo → causa recursão infinita.
-- Solução: função SECURITY DEFINER que bypassa o RLS ao checar o role.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- profiles: usuário vê e edita apenas o próprio
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- profiles: admin vê todos e pode atualizar roles (usa a função para evitar recursão)
CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  USING (public.is_admin());

-- gestoes: usuário gerencia apenas as próprias
CREATE POLICY "gestoes_select_own"
  ON public.gestoes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "gestoes_insert_own"
  ON public.gestoes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "gestoes_update_own"
  ON public.gestoes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "gestoes_delete_own"
  ON public.gestoes FOR DELETE
  USING (auth.uid() = user_id);

-- clientes: usuário gerencia apenas os próprios
CREATE POLICY "clientes_select_own"
  ON public.clientes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "clientes_insert_own"
  ON public.clientes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "clientes_update_own"
  ON public.clientes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "clientes_delete_own"
  ON public.clientes FOR DELETE
  USING (auth.uid() = user_id);

-- ── 5. TRIGGER: updated_at automático ────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- FIX: DROP IF EXISTS antes de criar triggers (não têm IF NOT EXISTS no PG15)
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS gestoes_updated_at ON public.gestoes;
CREATE TRIGGER gestoes_updated_at
  BEFORE UPDATE ON public.gestoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS clientes_updated_at ON public.clientes;
CREATE TRIGGER clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 6. TRIGGER: cria profile ao registrar usuário ──

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 7. Tornar usuário admin (execute manualmente) ──
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'seu@email.com';
