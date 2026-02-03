@echo off
chcp 65001 >nul
echo Subiendo proyecto a GitHub...

pushd "%~dp0"

git remote set-url origin https://github.com/obebeclothes-commits/obebe-gymshark.git
git add .
git status
git commit -m "Sitio completo Obebe Gym Shark"
if errorlevel 1 echo No hay cambios nuevos o ya esta todo subido

echo.
echo Ahora te pedira usuario y contraseña de GitHub. Usa tu Personal Access Token como contraseña.
git push -u origin main

echo.
echo Si salio Repository not found, revisa en GitHub el nombre del repo y tu usuario.
popd
pause
