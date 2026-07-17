@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo === Sincronizar stock: Sheet -^> ML + Facebook ===
echo.
choice /C DA /M "D=Ver plan  A=Aplicar en ML y FB"
if errorlevel 2 goto APLICAR
python scripts\actualizar-stock-todo.py --dry-run
goto FIN

:APLICAR
python scripts\actualizar-stock-todo.py --aplicar

:FIN
pause
