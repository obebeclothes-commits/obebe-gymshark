@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo === Sincronizar stock Google Sheet -^> Mercado Libre ===
echo.
choice /C DA /M "D=Ver plan (dry-run)  A=Aplicar cambios en ML"
if errorlevel 2 goto APLICAR
python scripts\actualizar-stock-mercadolibre.py --dry-run
goto FIN

:APLICAR
python scripts\actualizar-stock-mercadolibre.py --aplicar

:FIN
pause
