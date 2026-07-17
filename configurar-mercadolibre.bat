@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "CONFIG=%CD%\scripts\mercadolibre-config.json"

echo.
echo === Configurar Mercado Libre ===
echo.
echo Archivo: %CONFIG%
echo.

if not exist "%CONFIG%" (
    copy /Y "%CD%\scripts\mercadolibre-config.ejemplo.json" "%CONFIG%" >nul
)

echo Opcion 1 - Abrir archivo en bloc de notas (recomendado)
echo   Cambia la linea 3: "client_secret": "TU_SECRET_AQUI"
echo   Guarda con Ctrl+S y cierra el bloc de notas.
echo.
echo Opcion 2 - Pegar secret aqui en la terminal
echo.
choice /C 12 /M "Elige 1=Bloc de notas  2=Pegar aqui"

if errorlevel 2 goto PEGAR
if errorlevel 1 goto NOTEPAD

:NOTEPAD
notepad "%CONFIG%"
echo.
echo Cuando guardes en el bloc de notas, presiona una tecla para validar...
pause >nul
python scripts\validar-mercadolibre-config.py
goto FIN

:PEGAR
echo.
set "ML_SECRET="
set /p ML_SECRET=PEGA tu Client Secret y Enter: 
if "%ML_SECRET%"=="" (
    echo No escribiste nada.
    pause
    exit /b 1
)
python scripts\validar-mercadolibre-config.py --secret "%ML_SECRET%"
goto FIN

:FIN
pause
