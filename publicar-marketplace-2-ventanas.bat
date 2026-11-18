@echo off
cd /d "%~dp0"
echo === PUBLICAR MARKETPLACE — 2 ventanas (paralelo actual) ===
echo.
echo Script: scripts\publicar-marketplace-paralelo.py
echo - 1 Chrome, 2 listas distintas de articulos, login solo en la 1ra
echo.
python -u scripts\publicar-marketplace-paralelo.py --ventanas 2
echo.
pause