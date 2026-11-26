# Desplegar admin-api

Código canónico: `supabase/functions/admin-api/index.ts`.

## Auth (Etapa A)

- El panel inicia sesión con **Supabase Auth** (correo + contraseña).
- Las acciones administrativas exigen JWT + fila activa en `admin_profiles`.
- `getCotizadorConfig` sigue siendo **público** (solo lectura de la fórmula del cotizador).
- **No** uses `ADMIN_SECRET` en el body ni en archivos JS. Si el secret existe en el proyecto, elimínalo.

`verify_jwt = false` en el gateway es intencional (endpoint público mixto). La autorización real está dentro de la función.

## Despliegue

```powershell
cd "C:\Users\Dr. Coito\Desktop\Obebe Gym Shark"
npx supabase@latest login
npx supabase@latest secrets set SITE_URL=https://obebe.store --project-ref yueajorzawaanubgekpm
npx supabase@latest functions deploy admin-api --no-verify-jwt --project-ref yueajorzawaanubgekpm
```

O: `.\deploy-admin-api.ps1`

## Antes de desplegar (Etapa A)

1. Ejecutar `scripts/supabase/diagnostico-esquema.sql` y revisar.
2. Ejecutar `scripts/supabase/etapa-a-seguridad.sql`.
3. Crear usuarios Auth e insertar `admin_profiles`.
4. Ver checklist completa: `scripts/supabase/ETAPA-A-ACCIONES-MANUALES.md`.
