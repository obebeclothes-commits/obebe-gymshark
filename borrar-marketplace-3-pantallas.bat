@echo off
cd /d "%~dp0"
echo === BORRAR MARKETPLACE (1 Chrome, 3 pestanas) ===
echo.
echo Se abre UNA sola ventana de Chrome.
echo Inicia sesion UNA vez. No abras login en otras ventanas.
echo Cuando veas tus anuncios, el script abre 3 pestanas y borra solo.
echo.
python -u scripts\borrar-marketplace-paralelo.py --ventanas 3 --max 500
echo.
pause
