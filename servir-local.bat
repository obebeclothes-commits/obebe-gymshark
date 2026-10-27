@echo off
cd /d "%~dp0"
echo Servidor local Obebe — tienda + admin (solo en esta PC)
echo.
echo   Tienda:  http://127.0.0.1:8765/
echo   Admin:   http://127.0.0.1:8765/admin/
echo.
echo Cierra esta ventana para detener el servidor.
python -m http.server 8765
