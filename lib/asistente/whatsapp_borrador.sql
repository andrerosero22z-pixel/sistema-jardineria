create table if not exists public.whatsapp_borrador (
  id uuid primary key default gen_random_uuid(),
  telefono text not null,
  tipo text not null,
  mensaje_original text,
  datos jsonb not null,
  estado text not null default 'pendiente',
  fecha_creacion timestamptz default now(),
  fecha_actualizacion timestamptz default now()
);

create index if not exists whatsapp_borrador_telefono_estado_idx
  on public.whatsapp_borrador (telefono, estado, fecha_creacion desc);
