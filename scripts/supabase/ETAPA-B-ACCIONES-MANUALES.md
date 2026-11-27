# Etapa B — Inventario atómico (acciones manuales)

## 1. Ejecutar SQL

En Supabase → SQL Editor, pegar y Run:

`scripts/supabase/etapa-b-inventario-atomico.sql`

Comprobar:

```sql
select to_regprocedure(
  'public.ajustar_inventario_stock(bigint,integer,integer,text,text,text,uuid,text,boolean)'
) is not null as rpc_ok;

select count(*) as movimientos from public.inventario_movimientos;
```

## 2. Desplegar admin-api

```powershell
cd "C:\Users\Dr. Coito\Desktop\Obebe Gym Shark"
.\deploy-admin-api.ps1
```

## 3. Publicar frontend

Commit/push a `main` (GitHub Pages).

## 4. Pruebas

1. Registrar una venta retail de 1 unidad → stock baja 1.
2. Volver a consultar:
```sql
select * from public.inventario_movimientos order by id desc limit 5;
```
3. Intentar vender más unidades de las disponibles → debe fallar con “Stock insuficiente”.
4. Ajuste manual de stock en inventario → debe crear movimiento `ajuste_manual`.
5. (Opcional) Llamar dos veces el mismo RPC con la misma `p_idempotency_key` → un solo movimiento.

## Rollback

`scripts/supabase/etapa-b-inventario-atomico-rollback.sql`  
Luego redesplegar una versión anterior de `admin-api` si hace falta.
