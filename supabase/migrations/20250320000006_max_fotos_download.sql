alter table compartilhamentos
  add column if not exists max_fotos_download integer default null;
