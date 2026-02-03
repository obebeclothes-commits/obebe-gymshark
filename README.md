# Obebe Gym Shark Collection

Sitio web de la tienda Obebe - GymShark Collection.

---

## Cómo desplegar la página en GitHub (GitHub Pages)

### Paso 1: Crear el repositorio en GitHub

1. Entra en [github.com](https://github.com) e inicia sesión.
2. Clic en **"New"** (nuevo repositorio).
3. Nombre del repositorio: **`obebeclothes-commits`** (o el que ya creaste).
4. Elige **Public**.
5. **No** marques "Add a README". Deja el repositorio vacío.
6. Clic en **Create repository**.

### Paso 2: Subir el proyecto desde tu PC

Abre **PowerShell** o **Símbolo del sistema** en la carpeta del proyecto  
(`C:\Users\Dr. Coito\Desktop\Obebe Gym Shark`) y ejecuta estos comandos **uno por uno**:

```bash
git init
git add .
git commit -m "Sitio Obebe Gym Shark"
git branch -M main
git remote add origin https://github.com/obebeclothes/obebeclothes-commits.git
git push -u origin main
```

**Importante:** si tu usuario de GitHub no es `obebeclothes`, cambia la URL: `https://github.com/TU-USUARIO/obebeclothes-commits.git`  
Si GitHub te pide usuario y contraseña, usa un **Personal Access Token** como contraseña (en GitHub: Settings → Developer settings → Personal access tokens).

### Paso 3: Activar GitHub Pages

1. En tu repositorio de GitHub, ve a **Settings** (Configuración).
2. En el menú izquierdo, entra en **Pages**.
3. En **Source** (Origen) elige **"Deploy from a branch"**.
4. En **Branch** elige **main** y carpeta **/ (root)**.
5. Clic en **Save**.

En 1–2 minutos tu sitio estará en:

**https://obebeclothes.github.io/obebeclothes-commits/**

(Si tu usuario no es `obebeclothes`, la URL será: `https://TU-USUARIO.github.io/obebeclothes-commits/`)
