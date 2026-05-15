-- ════════════════════════════════════════════════════════════
--  STUDIO CHARME · SQL CONSOLIDADO
--  Rode TUDO de uma vez no Supabase Dashboard → SQL Editor
--  Seguro: usa "if not exists" e "if exists" — pode rodar várias vezes
-- ════════════════════════════════════════════════════════════

-- ─── 1. TABELA VOUCHERS ───────────────────────────────────────
create table if not exists public.vouchers (
  id          bigint primary key generated always as identity,
  user_id     uuid references auth.users on delete cascade not null,
  codigo      text not null,
  descricao   text,
  valor       numeric(10, 2),
  created_at  timestamp with time zone default now()
);
create index if not exists vouchers_user_id_idx on public.vouchers(user_id);

-- Garante coluna valor (caso já existisse a tabela sem ela)
alter table public.vouchers add column if not exists valor numeric(10, 2);

-- RLS — só o dono vê/edita
alter table public.vouchers enable row level security;
drop policy if exists "user owns vouchers" on public.vouchers;
create policy "user owns vouchers" on public.vouchers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ─── 2. TABELA TEMPLATES DE MENSAGEM ──────────────────────────
create table if not exists public.voucher_mensagens (
  id          bigint primary key generated always as identity,
  user_id     uuid references auth.users on delete cascade not null,
  titulo      text not null,
  texto       text not null,
  created_at  timestamp with time zone default now()
);
create index if not exists voucher_mensagens_user_id_idx on public.voucher_mensagens(user_id);

alter table public.voucher_mensagens enable row level security;
drop policy if exists "user owns mensagens" on public.voucher_mensagens;
create policy "user owns mensagens" on public.voucher_mensagens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ─── 3. VERIFICAÇÕES DE INTEGRIDADE ───────────────────────────
-- Confere se vouchers + mensagens estão isoladas por user (RLS ativo)
do $$
declare
  v_rls_vouchers  boolean;
  v_rls_mensagens boolean;
begin
  select c.relrowsecurity into v_rls_vouchers
    from pg_class c where c.relname = 'vouchers' and c.relnamespace = 'public'::regnamespace;
  select c.relrowsecurity into v_rls_mensagens
    from pg_class c where c.relname = 'voucher_mensagens' and c.relnamespace = 'public'::regnamespace;

  raise notice 'RLS vouchers: %', v_rls_vouchers;
  raise notice 'RLS voucher_mensagens: %', v_rls_mensagens;

  if not v_rls_vouchers then raise exception '⚠ RLS vouchers DESLIGADO — perigoso!'; end if;
  if not v_rls_mensagens then raise exception '⚠ RLS voucher_mensagens DESLIGADO — perigoso!'; end if;

  raise notice '✅ Tudo OK — RLS ativo nas tabelas';
end $$;
