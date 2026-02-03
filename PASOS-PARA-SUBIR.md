# Pasos para subir el sitio a GitHub

## Paso 1: Abrir la terminal en la carpeta del proyecto

1. Abre el **Explorador de archivos** de Windows.
2. Ve a la carpeta: **Desktop → Obebe Gym Shark**.
3. En la barra de arriba (donde sale la ruta), escribe **cmd** y pulsa **Enter**.
   - Se abrirá una ventana negra (Símbolo del sistema) ya dentro de esa carpeta.

**O bien:** Abre **PowerShell** o **Símbolo del sistema**, escribe:
```
cd Desktop\Obebe Gym Shark
```
(y si tu usuario no es el que tiene "Desktop" en esa ruta, usa la ruta completa que te salga en el Explorador, por ejemplo: `cd "C:\Users\Dr. Coito\Desktop\Obebe Gym Shark"`).

---

## Paso 2: Comprobar que el remote es el correcto

Escribe y pulsa Enter:
```
git remote set-url origin https://github.com/obebeclothes-commits/obebe-gymshark.git
```
No tiene que salir ningún mensaje. Así te aseguras de que apunta a tu repo.

---

## Paso 3: Añadir todos los archivos

Escribe y pulsa Enter:
```
git add .
```

---

## Paso 4: Hacer el commit

Escribe y pulsa Enter:
```
git commit -m "Sitio completo Obebe Gym Shark"
```
- Si sale **"nothing to commit"** o **"working tree clean"**, significa que ya estaba todo guardado; puedes seguir al Paso 5.
- Si sale **"X files changed"**, el commit se hizo bien.

---

## Paso 5: Subir a GitHub (push)

Escribe y pulsa Enter:
```
git push -u origin main
```

- Te pedirá **usuario** y **contraseña**:
  - **Username:** `obebeclothes-commits`
  - **Password:** aquí **no** pongas tu contraseña de GitHub. Tienes que usar un **Personal Access Token**.

### Cómo crear el token (solo la primera vez)

1. Entra en [github.com](https://github.com) e inicia sesión.
2. Clic en tu foto (arriba a la derecha) → **Settings**.
3. Abajo a la izquierda: **Developer settings**.
4. **Personal access tokens** → **Tokens (classic)**.
5. **Generate new token** → **Generate new token (classic)**.
6. Pon un nombre, por ejemplo: `subir obebe`.
7. Marca la casilla **repo** (acceso a repositorios).
8. Clic en **Generate token**.
9. **Copia el token** (solo se muestra una vez; guárdalo en un lugar seguro).
10. Cuando la terminal pida **Password**, pega ese token (no se verá nada al escribir; es normal). Pulsa Enter.

Si todo va bien, al final verás algo como: **"Branch 'main' set up to track remote branch 'main' from 'origin'"**.

---

## Paso 6: Activar GitHub Pages (para que se vea la web)

1. Entra en tu repositorio: [https://github.com/obebeclothes-commits/obebe-gymshark](https://github.com/obebeclothes-commits/obebe-gymshark).
2. Clic en **Settings** (Configuración).
3. En el menú de la izquierda, **Pages**.
4. Donde dice **Source** (o "Origen"):
   - Elige **Deploy from a branch**.
5. Donde dice **Branch**:
   - Elige **main**.
   - Carpeta: **/ (root)**.
6. Clic en **Save**.

En 1–2 minutos tu sitio estará en:

**https://obebeclothes-commits.github.io/obebe-gymshark/**

Abre esa URL en el navegador para ver tu página.
