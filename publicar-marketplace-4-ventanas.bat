@echo off
cd /d "%~dp0"
echo === PUBLICAR MARKETPLACE — 4 ventanas (paralelo actual) ===
echo.
echo Script: scripts\publicar-marketplace-paralelo.py
echo - 1 Chrome, articulos distintos por ventana, login solo en la 1ra
echo.
python -u scripts\publicar-marketplace-paralelo.py --ventanas 4
echo.
pause