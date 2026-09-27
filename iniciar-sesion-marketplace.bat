@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo PASO 1 — Ventana Chrome puerto 9222 (login)
echo - Si 9222 ya esta activo, NO se abre otra ventana.
echo - Inicia sesion ahi. NO cierres hasta terminar de publicar.
echo.
python scripts\publicar-marketplace.py --solo-abrir-navegador
pause
