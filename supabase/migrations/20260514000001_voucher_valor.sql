-- Adiciona valor ao voucher (preço/desconto que o cliente vai usar)
alter table public.vouchers
  add column if not exists valor numeric(10, 2);
