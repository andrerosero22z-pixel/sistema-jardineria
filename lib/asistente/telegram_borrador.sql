create table if not exists public.telegram_borrador (
  id uuid primary key default gen_random_uuid(),
  chat_id text not null,
  tipo text not null,
  mensaje_original text,
  datos jsonb not null,
  estado text not null default 'pendiente',
  fecha_creacion timestamptz default now(),
  fecha_actualizacion timestamptz default now()
);

create index if not exists telegram_borrador_chat_estado_idx
  on public.telegram_borrador (chat_id, estado, fecha_creacion desc);
