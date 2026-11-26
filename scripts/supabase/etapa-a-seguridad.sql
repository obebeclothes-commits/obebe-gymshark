-- =============================================================================
-- OBEBE · ETAPA A — Seguridad (Auth + perfiles + inventario público)
-- Ejecutar SOLO después de:
--   1) Correr diagnostico-esquema.sql y compartir resultados
--   2) Tener un respaldo (Dashboard → Database → Backups, o dump)
--   3) Tener listo el rollback: etapa-a-seguridad-rollback.sql
-- NO inventa usuarios ni contraseñas. Los perfiles se insertan a mano.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) Perfiles administrativos (roles verificados en backend)
-- ---------------------------------------------------------------------------
create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text not null,
  role text not null check (role in ('admin', 'mayoreo_cliente')),
  cliente_mayoreo text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.admin_profiles is
  'Roles del panel /admin. La autorización real se verifica en Edge Functions con el JWT.';

alter table public.admin_profiles enable row level security;

-- Nadie con anon/authenticated lee perfiles vía REST (solo service_role / functions).
drop policy if exists admin_profiles_no_public on public.admin_profiles;
-- Sin policies = denegado para anon/authenticated bajo RLS.

revoke all on table public.admin_profiles from anon, authenticated;
grant all on table public.admin_profiles to service_role;

-- ---------------------------------------------------------------------------
-- 2) Vista pública de inventario (whitelist de columnas comerciales)
--    Índices públicos (celdas jsonb):
--      0 imagen, 1 nombre, 2 stock, 3 talla, 4 color, 5 tipo, 6 marca,
--      7 precio retail, 8 total, 9 foto, 10 fecha stock,
--      15–17 mayoreo+20 (display hasta Etapa E), 19 segmento, 20 carrusel,
--      21–22 mayoreo+50, 23 colección, 24 oferta semanal
--    Privados (vacíos en la vista):
--      11–14 costos/margen, 18 faltante, 25 auditoría, 26 apartado mayoreo, 27 ubicación
-- ---------------------------------------------------------------------------
create or replace view public.inventario_publico
with (security_invoker = false) as
select
  f.id,
  (
    select coalesce(jsonb_agg(elem order by ord), '[]'::jsonb)
    from (
      select
        g.ord,
        case
          when g.ord in (11, 12, 13, 14, 18, 25, 26, 27) then to_jsonb(''::text)
          when g.ord < coalesce(jsonb_array_length(f.celdas), 0)
            then coalesce(f.celdas -> g.ord, to_jsonb(''::text))
          else to_jsonb(''::text)
        end as elem
      from generate_series(0, 28) as g(ord)
    ) x
  ) as celdas
from public.inventario_filas f;

comment on view public.inventario_publico is
  'Catálogo para la tienda: sin costos, márgenes ni campos administrativos internos.';

-- ---------------------------------------------------------------------------
-- 3) Privilegios: anon ya no lee inventario_filas completo
-- ---------------------------------------------------------------------------
revoke all on table public.inventario_filas from anon, authenticated;
revoke all on table public.ventas_lineas from anon, authenticated;
revoke all on table public.admin_modulos_blob from anon, authenticated;

-- Si existe gastos_operativos, también cerrar
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'gastos_operativos'
  ) then
    execute 'revoke all on table public.gastos_operativos from anon, authenticated';
  end if;
end $$;

drop policy if exists "inventario_select_anon" on public.inventario_filas;
drop policy if exists inventario_select_anon on public.inventario_filas;

-- Vista: solo SELECT para anon/authenticated
grant select on public.inventario_publico to anon, authenticated;
grant select on public.inventario_publico to service_role;

-- La tabla base solo service_role (Edge Functions)
grant all on table public.inventario_filas to service_role;
grant all on table public.ventas_lineas to service_role;
grant all on table public.admin_modulos_blob to service_role;

-- ---------------------------------------------------------------------------
-- 4) Instrucciones (no ejecuta inserts)
-- ---------------------------------------------------------------------------
-- Tras crear usuarios en Authentication → Users, insertar perfiles, por ejemplo:
--
-- insert into public.admin_profiles (user_id, email, display_name, role, cliente_mayoreo)
-- values
--   ('UUID-DEL-USUARIO-ADMIN', 'correo-admin@ejemplo.com', 'OBEBE', 'admin', ''),
--   ('UUID-DEL-USUARIO-NATY', 'correo-naty@ejemplo.com', 'NATY', 'mayoreo_cliente', 'naty');
--
-- Los UUID salen de Authentication → Users → cada usuario.

commit;
