@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo Borra la sesion guardada de Facebook Marketplace del bot.
echo Usa esto si Chrome abrio el correo de otra persona.
echo.
pause
python scripts\publicar-marketplace.py --limpiar-perfil-marketplace
pause
