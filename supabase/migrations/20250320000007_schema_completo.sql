-- =============================================
-- Schema completo — Studio Foto Charme
-- Execute este arquivo em um banco limpo
-- =============================================


-- ── 1. FUNÇÃO: updated_at automático ─────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ── 2. PROFILES ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT,
  full_name  TEXT,
  avatar_url TEXT,
  role       TEXT        NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE POLICY "profiles_select_own"   ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own"   ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_select_admin" ON public.profiles FOR SELECT USING (public.is_admin());
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE USING (public.is_admin());

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 3. TRIGGER: cria profile ao registrar usuário ──

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


-- ── 4. GESTÕES ────────────────────────────────

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

ALTER TABLE public.gestoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gestoes_select_own" ON public.gestoes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "gestoes_insert_own" ON public.gestoes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gestoes_update_own" ON public.gestoes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "gestoes_delete_own" ON public.gestoes FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS gestoes_updated_at ON public.gestoes;
CREATE TRIGGER gestoes_updated_at
  BEFORE UPDATE ON public.gestoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 5. CLIENTES ───────────────────────────────

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
  cobrado_em   TEXT,
  created_at   TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ            NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS clientes_user_id_idx ON public.clientes (user_id);
CREATE INDEX IF NOT EXISTS clientes_status_idx  ON public.clientes (status);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clientes_select_own" ON public.clientes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "clientes_insert_own" ON public.clientes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clientes_update_own" ON public.clientes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "clientes_delete_own" ON public.clientes FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS clientes_updated_at ON public.clientes;
CREATE TRIGGER clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 6. CONFIGURAÇÕES ──────────────────────────

CREATE TABLE IF NOT EXISTS public.configuracoes (
  user_id    UUID        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  ativo      BOOLEAN     NOT NULL DEFAULT false,
  dia_mes    SMALLINT    NOT NULL DEFAULT 5 CHECK (dia_mes BETWEEN 1 AND 28),
  horario    TIME        NOT NULL DEFAULT '08:00',
  mensagem   TEXT        NOT NULL DEFAULT 'Olá {nome}! Sua cobrança de {valor} vence no dia {dia}. Por favor, realize o pagamento em dia!',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "configuracoes_select_own" ON public.configuracoes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "configuracoes_insert_own" ON public.configuracoes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "configuracoes_update_own" ON public.configuracoes FOR UPDATE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS configuracoes_updated_at ON public.configuracoes;
CREATE TRIGGER configuracoes_updated_at
  BEFORE UPDATE ON public.configuracoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 7. PASTAS ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pastas (
  id         BIGSERIAL   PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       TEXT        NOT NULL,
  parent_id  BIGINT      REFERENCES public.pastas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pastas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pastas_own" ON public.pastas
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_pastas_updated_at ON public.pastas;
CREATE TRIGGER set_pastas_updated_at
  BEFORE UPDATE ON public.pastas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 8. COMPARTILHAMENTOS ──────────────────────

CREATE TABLE IF NOT EXISTS public.compartilhamentos (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pasta_id           BIGINT      REFERENCES public.pastas(id) ON DELETE CASCADE,
  storage_path       TEXT        NOT NULL,
  nome               TEXT        NOT NULL,
  senha              TEXT,
  ativo              BOOLEAN     NOT NULL DEFAULT true,
  expires_at         TIMESTAMPTZ,
  max_downloads      INT,
  download_count     INT         NOT NULL DEFAULT 0,
  max_fotos_download INTEGER     DEFAULT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.compartilhamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compartilhamentos_owner" ON public.compartilhamentos
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "compartilhamentos_public_read" ON public.compartilhamentos
  FOR SELECT TO anon
  USING (ativo = true);


-- ── 9. STORAGE: bucket fotos ─────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fotos',
  'fotos',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "fotos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fotos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "fotos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'fotos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "fotos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'fotos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "fotos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'fotos' AND (storage.foldername(name))[1] = auth.uid()::text);


-- ── Para tornar um usuário admin (execute manualmente após registrar) ──
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'seu@email.com';
