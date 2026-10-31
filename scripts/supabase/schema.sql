-- OBEBE · Supabase (PostgreSQL)
-- 1. Crea proyecto en supabase.com
-- 2. SQL Editor → pega y ejecuta este archivo
-- 3. Despliega Edge Function scripts/supabase/functions/admin-api (ver comentario en index.ts)
-- 4. admin-config.js: dataSource 'supabase' + URLs y claves

create table if not exists public.inventario_filas (
  id bigint generated always as identity primary key,
  celdas jsonb not null default '[]'::jsonb,
  legacy_sheet_row int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventario_filas_updated_idx on public.inventario_filas (updated_at desc);

create table if not exists public.ventas_lineas (
  id bigint generated always as identity primary key,
  fecha_raw text,
  fecha_iso date,
  nombre text,
  tipo text,
  precio numeric default 0,
  talla text,
  color text,
  segmento text,
  cliente text,
  vendedor text,
  cuenta text,
  red_social text,
  link text,
  telefono text,
  legacy_sheet_row int,
  created_at timestamptz not null default now()
);

create index if not exists ventas_lineas_fecha_idx on public.ventas_lineas (fecha_iso desc nulls last, id desc);

alter table public.inventario_filas enable row level security;
alter table public.ventas_lineas enable row level security;

-- Tienda y admin: lectura inventario con anon key
drop policy if exists "inventario_select_anon" on public.inventario_filas;
create policy "inventario_select_anon"
  on public.inventario_filas for select
  to anon, authenticated
  using (true);

-- Ventas: solo service role (Edge Function)
drop policy if exists "ventas_no_anon" on public.ventas_lineas;
-- sin policy de SELECT para anon → lectura ventas vía admin-api

comment on table public.inventario_filas is '29 columnas en celdas (array JSON, índices como Google Sheet A–AC)';
comment on table public.ventas_lineas is 'Ventas retail (ex hoja VENTAS B–N)';

create table if not exists public.gastos_operativos (
  id bigint generated always as identity primary key,
  fecha_raw text,
  fecha_iso date,
  concepto text not null default '',
  cantidad numeric not null default 0 check (cantidad >= 0),
  pagado_por text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists gastos_operativos_fecha_idx on public.gastos_operativos (fecha_iso desc nulls last, id desc);

alter table public.gastos_operativos enable row level security;

comment on table public.gastos_operativos is 'Gastos operativos (no van en ventas_lineas)';

create table if not exists public.admin_modulos_blob (
  module_key text primary key,
  payload jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.admin_modulos_blob enable row level security;

comment on table public.admin_modulos_blob is 'JSON por módulo admin (apartados, entregas) — solo Edge Function con service role';
