# Etapa A — Acciones manuales (seguridad)

No se han aplicado cambios en producción todavía. Sigue este orden.

## 0. Respaldo

1. Supabase Dashboard → **Project Settings → Database → Backups** (o exporta un dump).
2. Guarda una copia del repo en la rama/commit actual.
3. Ten a mano `scripts/supabase/etapa-a-seguridad-rollback.sql`.

## 1. Diagnóstico (obligatorio antes de migrar)

1. Abre **SQL Editor**.
2. Ejecuta `scripts/supabase/diagnostico-esquema.sql`.
3. Pega el resultado en el chat del agente.

## 2. Credenciales comprometidas — ROTAR

Estas ya estuvieron en JS público. Trátalas como filtradas:

| Qué | Dónde estaba | Qué hacer |
|-----|--------------|-----------|
| Contraseña cuenta OBEBE (`OBebeClothes.1`) | `admin/admin-auth.js` | Dejar de usarla. Crear usuario Auth con **contraseña nueva**. |
| Contraseña cuenta NATY (`mayoreo9`) | `admin/admin-auth.js` | Igual: contraseña nueva en Auth. |
| `ADMIN_SECRET` / `inventarioSecret` (`OBebeClotes.1`) | `admin-config.js`, fallback en Edge Function, docs | **Eliminar** el secret en Supabase si existe. Ya no se usa. |
| Publishable / anon key | `admin-config.js`, `obebe-data-config.js` | Es pública por diseño. Opcional rotarla en Dashboard → API si quieres higiene extra. |
| `service_role` | No estaba en el frontend (correcto) | No la publiques. No hace falta rotarla salvo que la hayas compartido. |

**No pongas las contraseñas nuevas en GitHub ni en ningún `.js`.**

## 3. Crear usuarios en Supabase Auth

1. Authentication → Users → **Add user**.
2. Crea **dos** usuarios con correo real y contraseña nueva (tú eliges):
   - Administrador (antes “OBEBE”)
   - Mayoreo (antes “NATY”)
3. Copia el **UUID** de cada usuario.

## 4. Migración SQL Etapa A

1. Ejecuta `scripts/supabase/etapa-a-seguridad.sql`.
2. Inserta perfiles (sustituye UUID y correos reales):

```sql
insert into public.admin_profiles (user_id, email, display_name, role, cliente_mayoreo)
values
  ('UUID-ADMIN', 'correo-admin@tu-dominio.com', 'OBEBE', 'admin', ''),
  ('UUID-NATY', 'correo-naty@tu-dominio.com', 'NATY', 'mayoreo_cliente', 'naty');
```

## 5. Secrets / Edge Function

```bash
npx supabase@latest secrets set SITE_URL=https://obebe.store --project-ref yueajorzawaanubgekpm
npx supabase@latest functions deploy admin-api --no-verify-jwt --project-ref yueajorzawaanubgekpm
```

Si existía `ADMIN_SECRET`, bórralo desde Dashboard → Edge Functions → Secrets.

`verify_jwt` sigue en `false` a propósito: `getCotizadorConfig` es público; el resto valida JWT dentro de la función.

## 6. Publicar frontend

Despliega GitHub Pages (push a `main` o el workflow habitual) **después** de que Auth + SQL + function estén listos. Si publicas el frontend Auth antes, el panel viejo deja de poder autenticarse con el secret y el nuevo aún no tendrá perfiles.

## 7. Pruebas mínimas

1. Anónimo: `GET /rest/v1/inventario_filas?select=celdas` → debe fallar (401/403) o no devolver costos.
2. Anónimo: `GET /rest/v1/inventario_publico?select=id,celdas` → OK; celdas 11–14 vacías.
3. Login panel con correo admin → entra al ERP.
4. Login NATY → solo mayoreo.
5. Sin sesión: `POST admin-api` con `action=getVentas` → 401.
6. Con JWT admin: `getInventario` → filas con costos (solo panel).
7. Buscar en el HTML/JS publicado: no debe aparecer `OBebeClothes.1`, `mayoreo9` ni `OBebeClotes.1`.
