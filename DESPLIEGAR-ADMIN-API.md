# Desplegar admin-api (cotizador y módulos en nube)

El mensaje **«La API no acepta el módulo cotizador»** significa que en Supabase sigue la **versión vieja** de la Edge Function. El código nuevo ya está en `scripts/supabase/functions/admin-api/index.ts`; hay que **subirlo**.

## Requisitos

1. Cuenta en [Supabase](https://supabase.com/dashboard) con el proyecto **yueajorzawaanubgekpm**.
2. **Access token** del CLI: Supabase → **Account** → **Access Tokens** → crear token.

## Opción A — PowerShell (recomendada)

En PowerShell, en la carpeta del proyecto:

```powershell
cd "C:\Users\Dr. Coito\Desktop\Obebe Gym Shark"
$env:SUPABASE_ACCESS_TOKEN = "TU_TOKEN_AQUI"
.\deploy-admin-api.ps1
```

O inicia sesión una vez:

```powershell
npx supabase@latest login
.\deploy-admin-api.ps1
```

## Opción B — Comandos manuales

```powershell
cd "C:\Users\Dr. Coito\Desktop\Obebe Gym Shark"
npx supabase@latest login
Copy-Item scripts\supabase\functions\admin-api\index.ts supabase\functions\admin-api\index.ts -Force
npx supabase@latest functions deploy admin-api --no-verify-jwt --project-ref yueajorzawaanubgekpm
```

## Secretos (solo si aún no los configuraste)

En Supabase → **Project Settings** → **Edge Functions** → secrets, o:

```powershell
npx supabase@latest secrets set ADMIN_SECRET=OBebeClotes.1 --project-ref yueajorzawaanubgekpm
```

(La función usa también las variables de entorno del proyecto que ya vienen con el service role.)

## Comprobar que quedó bien

1. Admin **Obebe** → Ventas → **Cotizador** → **Guardar** (debe decir sincronizado, sin error de módulo).
2. **Abrir página web** del cotizador y probar un monto USD (los precios deben coincidir con el probador del admin).

## Tabla en base de datos

Si guardar falla por tabla inexistente, en Supabase → **SQL Editor** ejecuta `scripts/supabase/schema.sql` (al menos la parte de `admin_modulos_blob`).
