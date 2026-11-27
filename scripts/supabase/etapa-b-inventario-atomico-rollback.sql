-- =============================================================================
-- OBEBE · ETAPA B — Rollback
-- Elimina RPC y tabla de movimientos. NO restaura stocks históricos.
-- =============================================================================

begin;

drop function if exists public.ajustar_inventario_stock(
  bigint, integer, integer, text, text, text, uuid, text, boolean
);

drop table if exists public.inventario_movimientos;

commit;
