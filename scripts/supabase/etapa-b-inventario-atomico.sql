-- =============================================================================
-- OBEBE · ETAPA B — Inventario atómico
-- Requiere Etapa A aplicada. Solo lectura previa recomendada.
-- Rollback: etapa-b-inventario-atomico-rollback.sql
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) Bitácora de movimientos
-- ---------------------------------------------------------------------------
create table if not exists public.inventario_movimientos (
  id bigint generated always as identity primary key,
  inventario_fila_id bigint not null references public.inventario_filas (id) on delete restrict,
  delta integer not null,
  stock_anterior integer not null,
  stock_nuevo integer not null,
  tipo_movimiento text not null check (tipo_movimiento in (
    'venta_showroom',
    'venta_online',
    'ajuste_manual',
    'devolucion',
    'apartado',
    'entrega',
    'mayoreo',
    'importacion',
    'otro'
  )),
  referencia text not null default '',
  usuario text not null default '',
  user_id uuid null,
  idempotency_key text null,
  created_at timestamptz not null default now()
);

create index if not exists inventario_movimientos_fila_idx
  on public.inventario_movimientos (inventario_fila_id, created_at desc);

create unique index if not exists inventario_movimientos_idempotency_uidx
  on public.inventario_movimientos (idempotency_key)
  where idempotency_key is not null and length(trim(idempotency_key)) > 0;

comment on table public.inventario_movimientos is
  'Movimientos atómicos de stock (showroom, online, ajustes, devoluciones).';

alter table public.inventario_movimientos enable row level security;
revoke all on table public.inventario_movimientos from anon, authenticated;
grant all on table public.inventario_movimientos to service_role;

-- ---------------------------------------------------------------------------
-- 2) RPC atómico: delta o stock absoluto (el absoluto se convierte a delta
--    dentro de la misma transacción con bloqueo de fila).
-- ---------------------------------------------------------------------------
create or replace function public.ajustar_inventario_stock(
  p_inventario_fila_id bigint,
  p_delta integer default null,
  p_stock_absoluto integer default null,
  p_tipo_movimiento text default 'ajuste_manual',
  p_referencia text default '',
  p_usuario text default '',
  p_user_id uuid default null,
  p_idempotency_key text default null,
  p_allow_negative boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_prev public.inventario_movimientos%rowtype;
  v_celdas jsonb;
  v_stock_antes integer;
  v_stock_nuevo integer;
  v_delta integer;
  v_raw text;
begin
  if p_inventario_fila_id is null or p_inventario_fila_id <= 0 then
    return jsonb_build_object('ok', false, 'error', 'inventario_fila_id inválido');
  end if;

  if p_delta is null and p_stock_absoluto is null then
    return jsonb_build_object('ok', false, 'error', 'Debe enviarse delta o stock_absoluto');
  end if;

  if p_delta is not null and p_stock_absoluto is not null then
    return jsonb_build_object('ok', false, 'error', 'Enviar solo delta o solo stock_absoluto');
  end if;

  if p_tipo_movimiento is null or p_tipo_movimiento not in (
    'venta_showroom','venta_online','ajuste_manual','devolucion',
    'apartado','entrega','mayoreo','importacion','otro'
  ) then
    return jsonb_build_object('ok', false, 'error', 'tipo_movimiento inválido');
  end if;

  -- Idempotencia: misma clave → no reaplicar
  if v_key is not null then
    select * into v_prev
    from public.inventario_movimientos
    where idempotency_key = v_key
    limit 1;
    if found then
      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'inventario_fila_id', v_prev.inventario_fila_id,
        'delta', v_prev.delta,
        'stock_anterior', v_prev.stock_anterior,
        'stock', v_prev.stock_nuevo,
        'movimiento_id', v_prev.id
      );
    end if;
  end if;

  select celdas into v_celdas
  from public.inventario_filas
  where id = p_inventario_fila_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Fila de inventario no encontrada');
  end if;

  if v_celdas is null or jsonb_typeof(v_celdas) <> 'array' then
    v_celdas := '[]'::jsonb;
  end if;

  -- Asegurar longitud mínima 29
  while jsonb_array_length(v_celdas) < 29 loop
    v_celdas := v_celdas || to_jsonb(''::text);
  end loop;

  v_raw := coalesce(v_celdas->>2, '0');
  begin
    v_stock_antes := greatest(0, v_raw::integer);
  exception when others then
    v_stock_antes := 0;
  end;

  if p_delta is not null then
    v_delta := p_delta;
    v_stock_nuevo := v_stock_antes + v_delta;
  else
    if p_stock_absoluto < 0 and not p_allow_negative then
      return jsonb_build_object('ok', false, 'error', 'Stock absoluto no puede ser negativo');
    end if;
    v_stock_nuevo := p_stock_absoluto;
    v_delta := v_stock_nuevo - v_stock_antes;
  end if;

  if v_delta = 0 then
    return jsonb_build_object(
      'ok', true,
      'noop', true,
      'inventario_fila_id', p_inventario_fila_id,
      'delta', 0,
      'stock_anterior', v_stock_antes,
      'stock', v_stock_antes
    );
  end if;

  if v_stock_nuevo < 0 and not coalesce(p_allow_negative, false) then
    return jsonb_build_object(
      'ok', false,
      'error', 'Stock insuficiente',
      'stock_anterior', v_stock_antes,
      'delta', v_delta,
      'disponible', v_stock_antes
    );
  end if;

  v_celdas := jsonb_set(v_celdas, '{2}', to_jsonb(v_stock_nuevo::text), true);

  update public.inventario_filas
  set celdas = v_celdas,
      updated_at = now()
  where id = p_inventario_fila_id;

  insert into public.inventario_movimientos (
    inventario_fila_id, delta, stock_anterior, stock_nuevo,
    tipo_movimiento, referencia, usuario, user_id, idempotency_key
  ) values (
    p_inventario_fila_id, v_delta, v_stock_antes, v_stock_nuevo,
    p_tipo_movimiento, coalesce(p_referencia, ''), coalesce(p_usuario, ''),
    p_user_id, v_key
  )
  returning id into v_prev.id;

  return jsonb_build_object(
    'ok', true,
    'inventario_fila_id', p_inventario_fila_id,
    'delta', v_delta,
    'stock_anterior', v_stock_antes,
    'stock', v_stock_nuevo,
    'movimiento_id', v_prev.id
  );
exception
  when unique_violation then
    -- Carrera en idempotency_key: devolver el movimiento ya creado
    if v_key is not null then
      select * into v_prev
      from public.inventario_movimientos
      where idempotency_key = v_key
      limit 1;
      if found then
        return jsonb_build_object(
          'ok', true,
          'idempotent', true,
          'inventario_fila_id', v_prev.inventario_fila_id,
          'delta', v_prev.delta,
          'stock_anterior', v_prev.stock_anterior,
          'stock', v_prev.stock_nuevo,
          'movimiento_id', v_prev.id
        );
      end if;
    end if;
    raise;
end;
$$;

revoke all on function public.ajustar_inventario_stock(
  bigint, integer, integer, text, text, text, uuid, text, boolean
) from public, anon, authenticated;

grant execute on function public.ajustar_inventario_stock(
  bigint, integer, integer, text, text, text, uuid, text, boolean
) to service_role;

comment on function public.ajustar_inventario_stock is
  'Ajusta stock de inventario_filas.celdas[2] de forma atómica con bitácora e idempotencia.';

commit;
