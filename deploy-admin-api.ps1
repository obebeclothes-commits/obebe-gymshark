# Sincroniza admin-api desde scripts/supabase y lo sube a Supabase.
# Necesitas: supabase login (o variable SUPABASE_ACCESS_TOKEN)
$ErrorActionPreference = "Stop"
$ProjectRef = "yueajorzawaanubgekpm"
$Root = $PSScriptRoot
$Src = Join-Path $Root "scripts\supabase\functions\admin-api\index.ts"
$DstDir = Join-Path $Root "supabase\functions\admin-api"
$Dst = Join-Path $DstDir "index.ts"

if (-not (Test-Path $Src)) {
    Write-Error "No existe $Src"
}
New-Item -ItemType Directory -Force -Path $DstDir | Out-Null

function Get-ContentHash($path) {
    if (-not (Test-Path $path)) { return $null }
    return (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
}

function Sync-AdminApiSource {
    param([string]$From, [string]$To)
    $hashFrom = Get-ContentHash $From
    $hashTo = Get-ContentHash $To
    if ($hashFrom -eq $hashTo) {
        Write-Host "index.ts ya coincide con scripts/supabase (sin copiar)."
        return
    }
    $copied = $false
    foreach ($attempt in 1..3) {
        try {
            Copy-Item -LiteralPath $From -Destination $To -Force
            $copied = $true
            break
        } catch {
            if ($attempt -lt 3) { Start-Sleep -Milliseconds 400 }
        }
    }
    if (-not $copied) {
        try {
            $text = [System.IO.File]::ReadAllText($From)
            [System.IO.File]::WriteAllText($To, $text)
            $copied = $true
        } catch {
            Write-Warning "No se pudo actualizar $To (suele estar abierto en Cursor)."
            Write-Warning "Cierra supabase/functions/admin-api/index.ts y vuelve a ejecutar."
            if (-not (Test-Path $To)) {
                Write-Error "No hay copia local para desplegar."
            }
            if ((Get-ContentHash $From) -ne (Get-ContentHash $To)) {
                Write-Warning "La copia en supabase/functions puede estar DESACTUALIZADA. Despliega solo si estás seguro."
            } else {
                Write-Host "La copia en supabase/functions ya está al día; se despliega esa version."
            }
        }
    }
    if ($copied) {
        Write-Host "Copiado index.ts -> supabase/functions/admin-api"
    }
}

Sync-AdminApiSource -From $Src -To $Dst

$cli = Get-Command supabase -ErrorAction SilentlyContinue
if ($cli) {
    & supabase functions deploy admin-api --no-verify-jwt --project-ref $ProjectRef
} else {
    Write-Host "Usando npx supabase ..."
    npx --yes supabase@latest functions deploy admin-api --no-verify-jwt --project-ref $ProjectRef
}
Write-Host "Listo. Prueba en admin: Ventas -> Cotizador -> Guardar de nuevo."
