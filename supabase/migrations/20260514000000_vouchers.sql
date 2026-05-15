-- ── Vouchers ──
create table if not exists public.vouchers (
  id          bigint primary key generated always as identity,
  user_id     uuid references auth.users on delete cascade not null,
  codigo      text not null,
  descricao   text,
  created_at  timestamp with time zone default now()
);
create index if not exists vouchers_user_id_idx on public.vouchers(user_id);
alter table public.vouchers enable row level security;
create policy "user owns vouchers" on public.vouchers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Templates de mensagem ──
create table if not exists public.voucher_mensagens (
  id          bigint primary key generated always as identity,
  user_id     uuid references auth.users on delete cascade not null,
  titulo      text not null,
  texto       text not null,
  created_at  timestamp with time zone default now()
);
create index if not exists voucher_mensagens_user_id_idx on public.voucher_mensagens(user_id);
alter table public.voucher_mensagens enable row level security;
create policy "user owns mensagens" on public.voucher_mensagens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
