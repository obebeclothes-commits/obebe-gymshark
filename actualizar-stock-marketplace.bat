@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo === Sincronizar stock Google Sheet -^> Facebook Marketplace ===
echo.
choice /C DA /M "D=Ver plan (dry-run)  A=Marcar vendidos en FB (Selenium)"
if errorlevel 2 goto APLICAR
python scripts\actualizar-stock-marketplace.py --dry-run
goto FIN

:APLICAR
python scripts\actualizar-stock-marketplace.py --marcar-vendido --limite 20

:FIN
pause
