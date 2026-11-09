@echo off
cd /d "%~dp0"
echo === PUBLICAR MARKETPLACE EN 4 VENTANAS ===
echo.
echo 1) Se abre UN Chrome: inicia sesion UNA vez.
echo 2) Luego se abren 4 ventanas y cada una sube articulos distintos.
echo 3) No cierres esas ventanas mientras publica.
echo.
python -u scripts\publicar-marketplace-paralelo.py --ventanas 4
echo.
pause
