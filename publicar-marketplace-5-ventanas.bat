@echo off
cd /d "%~dp0"
echo === PUBLICAR MARKETPLACE — 5 ventanas (paralelo actual) ===
echo.
echo Script: scripts\publicar-marketplace-paralelo.py
echo - 1 Chrome, login SOLO en la 1ra ventana
echo - Cada ventana = articulos distintos (reparto automatico)
echo - Menos ventanas: python -u scripts\publicar-marketplace-paralelo.py --ventanas 2
echo.
if exist "marketplace-pendientes\.publicando.lock" del /f "marketplace-pendientes\.publicando.lock"
python -u scripts\publicar-marketplace-paralelo.py --ventanas 5
echo.
pause