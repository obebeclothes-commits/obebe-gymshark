-- =============================================================================
-- OBEBE · ETAPA A — Rollback
-- Restaura lectura anon de inventario_filas (como antes de la Etapa A).
-- NO borra auth.users que hayas creado a mano.
-- =============================================================================

begin;

drop view if exists public.inventario_publico;

-- Restaurar policy amplia (estado pre-auditoría). Solo si necesitas revertir YA.
drop policy if exists "inventario_select_anon" on public.inventario_filas;
create policy "inventario_select_anon"
  on public.inventario_filas for select
  to anon, authenticated
  using (true);

grant select on table public.inventario_filas to anon, authenticated;

-- Perfiles: se puede conservar la tabla; descomenta para eliminarla.
-- drop table if exists public.admin_profiles;

commit;
