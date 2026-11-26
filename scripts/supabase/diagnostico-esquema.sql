-- =============================================================================
-- OBEBE · Diagnóstico del esquema REAL (solo lectura)
-- Ejecutar en Supabase → SQL Editor → New query → Run
-- Copia el resultado JSON/tabla y pégalo en el chat antes de migraciones Etapa B–E.
-- =============================================================================

-- 1) Tablas en public
select
  table_name,
  (select count(*) from information_schema.columns c
   where c.table_schema = t.table_schema and c.table_name = t.table_name) as columnas
from information_schema.tables t
where t.table_schema = 'public'
  and t.table_type = 'BASE TABLE'
order by table_name;

-- 2) Columnas de tablas conocidas / esperadas
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'inventario_filas',
    'ventas_lineas',
    'gastos_operativos',
    'admin_modulos_blob',
    'admin_profiles',
    'inventario_movimientos',
    'customers',
    'customer_addresses',
    'orders',
    'order_items',
    'payments',
    'shipments'
  )
order by table_name, ordinal_position;

-- 3) Vistas públicas
select table_name
from information_schema.views
where table_schema = 'public'
order by table_name;

-- 4) Policies RLS
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 5) RLS habilitado
select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;

-- 6) Privilegios de anon / authenticated sobre tablas y vistas
select
  grantee,
  table_name,
  string_agg(privilege_type, ', ' order by privilege_type) as privilegios
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role')
group by grantee, table_name
order by table_name, grantee;

-- 7) Funciones RPC en public
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname;

-- 8) Conteos rápidos (no destruye nada)
select 'inventario_filas' as tabla, count(*)::bigint as filas from public.inventario_filas
union all
select 'ventas_lineas', count(*)::bigint from public.ventas_lineas
union all
select 'admin_modulos_blob', count(*)::bigint from public.admin_modulos_blob;

-- 9) ¿Existe gastos_operativos?
select exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'gastos_operativos'
) as existe_gastos_operativos;

-- 10) Muestra de forma de celdas (sin datos sensibles de costos: solo longitud)
select
  id,
  jsonb_typeof(celdas) as tipo_celdas,
  jsonb_array_length(celdas) as num_celdas,
  updated_at
from public.inventario_filas
order by id
limit 5;
