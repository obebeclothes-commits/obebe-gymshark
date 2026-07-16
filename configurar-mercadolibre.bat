@echo off
cd /d "%~dp0.."
if not exist "scripts\mercadolibre-config.json" (
    copy "scripts\mercadolibre-config.ejemplo.json" "scripts\mercadolibre-config.json"
    echo.
    echo Creado scripts\mercadolibre-config.json
    echo Edita ese archivo y pega tu client_id y client_secret de Mercado Libre DevCenter.
    echo Redirect URI en la app ML: https://www.obebe.store/mercadolibre-callback.html
    echo.
    notepad "scripts\mercadolibre-config.json"
) else (
    echo Ya existe scripts\mercadolibre-config.json
)
pause
