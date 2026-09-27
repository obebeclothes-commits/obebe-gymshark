@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo PASO 2 — Subir a Marketplace
echo - NO abre otro Chrome. NO cierra tu pestaña.
echo - Usa la misma ventana del paso 1 (debe seguir abierta).
echo - Pulsa Enter cuando quieras que empiece a subir.
echo.
if exist "marketplace-pendientes\.publicando.lock" del /f "marketplace-pendientes\.publicando.lock"
python scripts\publicar-marketplace.py --ids-archivo marketplace-pendientes\recientes-ids.txt --omitir-publicados --auto
pause
