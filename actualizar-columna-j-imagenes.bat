@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo Columna J — vista previa IMAGE (A = foto, T = HOMBRE/MUJER)
echo.
if "%~1"=="" (
  python scripts\actualizar-columna-j-imagenes.py --dry-run
) else (
  python scripts\actualizar-columna-j-imagenes.py %*
)
pause
