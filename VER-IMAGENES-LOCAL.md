# Cómo ver las imágenes de productos en tu PC

Si abres la página con **doble clic** (file:///...) las imágenes **no se muestran** porque el navegador lo bloquea por seguridad.

**Solución:** abrir el sitio con un **servidor local**.

## Opción 1 – Con Node.js (recomendado)

1. Abre **PowerShell** o **Símbolo del sistema** en la carpeta del proyecto (Obebe Gym Shark).
2. Ejecuta:
   ```bash
   npx serve .
   ```
3. Abre en el navegador la dirección que salga (ej: **http://localhost:3000**).
4. Entra a la página del producto, por ejemplo:
   - http://localhost:3000/producto.html?id=1022&categoria=Mujer

## Opción 2 – Con Python

1. Abre **PowerShell** o **Símbolo del sistema** en la carpeta del proyecto.
2. Ejecuta:
   ```bash
   python -m http.server 8000
   ```
3. Abre en el navegador: **http://localhost:8000**
4. Navega a producto.html?id=1022&categoria=Mujer (o el producto que quieras).

Cuando uses **http://localhost/...** en lugar de **file:///...**, las imágenes de la carpeta `mujer/` y `hombre/` se cargarán correctamente.
