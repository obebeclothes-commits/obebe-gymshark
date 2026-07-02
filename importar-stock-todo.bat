@echo off
cd /d "%~dp0.."
echo Importando HOMBRE...
python scripts\importar-stock.py hombre
echo.
echo Importando MUJER...
python scripts\importar-stock.py mujer
echo.
echo Listo. Recarga http://localhost:5500 con Ctrl+F5
pause
