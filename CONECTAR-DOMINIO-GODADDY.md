# Conectar tu dominio de GoDaddy a GitHub Pages

Tu sitio está en el repositorio `obebeclothes-commits/obebe-gymshark`. Para que se vea en GitHub Pages y luego en el dominio de GoDaddy, sigue estos pasos.

---

## 0. Activar GitHub Pages (si está deshabilitado)

Si te sale **"Páginas de GitHub está deshabilitado actualmente"**:

1. En tu repo, ve a **Settings** → **Pages** (en el menú izquierdo).
2. En **Source** / **Fuente** o **Build and deployment**:
   - **Source:** elige **Deploy from a branch** (Implementar desde una rama).
   - **Branch:** elige **main** (o **master** si tu rama se llama así).
   - **Folder:** elige **/ (root)**.
3. Pulsa **Save**.
4. Espera 1–2 minutos. Arriba verás algo como: *“Your site is live at https://obebeclothes-commits.github.io/obebe-gymshark/”*.

Cuando eso aparezca, GitHub Pages ya está habilitado. Luego puedes poner tu dominio personalizado (pasos siguientes).

---

## 1. Decidir qué quieres usar

- **Solo “www”:** la gente entra con `www.tudominio.com` → más común.
- **Solo “sin www”:** la gente entra con `tudominio.com`.
- **Los dos:** tanto `tudominio.com` como `www.tudominio.com` llevan al sitio.

Recomendación: configurar **los dos** (con y sin www).

---

## 2. Configurar el dominio en GitHub

1. Entra a tu repositorio en GitHub:  
   **https://github.com/obebeclothes-commits/obebe-gymshark**
2. Ve a **Settings** (Configuración) del repo.
3. En el menú izquierdo, **Pages** (página “GitHub Pages”).
4. En **Custom domain** escribe tu dominio:
   - Si quieres que el sitio sea **www.tudominio.com** → escribe: `www.tudominio.com`
   - Si quieres que sea **tudominio.com** (sin www) → escribe: `tudominio.com`
5. Pulsa **Save**.
6. (Opcional) Marca **Enforce HTTPS** cuando GitHub te lo ofrezca, para que la página cargue con https.

Anota exactamente lo que pusiste (con o sin www); lo usarás en GoDaddy.

---

## 3. Configurar DNS en GoDaddy

1. Entra a **https://www.godaddy.com** e inicia sesión.
2. Ve a **Mis Productos** y localiza el dominio que compraste.
3. Junto al dominio, pulsa **DNS** o **Administrar DNS** (o “Manage DNS”).
4. Vas a **añadir o editar registros** según lo que elegiste en GitHub.

### Si en GitHub pusiste **www.tudominio.com** (recomendado para empezar)

Añade o edita estos registros:

| Tipo  | Nombre | Valor                          | TTL   |
|-------|--------|---------------------------------|-------|
| **CNAME** | `www`  | `obebeclothes-commits.github.io` | 600 o 1 hora |

- **Nombre:** solo `www` (no pongas .com).
- **Valor:** exactamente `obebeclothes-commits.github.io` (tu usuario de GitHub + .github.io).

Guarda los cambios.

### Para que **tudominio.com** (sin www) también funcione

Añade **registros A** que apunten a los servidores de GitHub:

| Tipo | Nombre | Valor           | TTL   |
|------|--------|------------------|-------|
| **A**    | `@`    | `185.199.108.153` | 600   |
| **A**    | `@`    | `185.199.109.153` | 600   |
| **A**    | `@`    | `185.199.110.153` | 600   |
| **A**    | `@`    | `185.199.111.153` | 600   |

- **Nombre:** `@` (significa “el dominio raíz”, tudominio.com).
- Si ya tienes un A con nombre `@`, edítalo o sustituye por estos; no dejes A antiguos que apunten a otro sitio.

Luego, en **GitHub → Settings → Pages → Custom domain** añade también **tudominio.com** (sin www) y guarda. GitHub permite un solo dominio principal; si quieres que tanto www como sin www funcionen, suele usarse **www** como dominio principal en GitHub y los A para que el raíz redirija o también apunte a GitHub (según lo que permita la configuración; a veces se deja solo www como dominio en GitHub y en GoDaddy se hace una redirección de tudominio.com → www.tudominio.com).

---

## 4. Resumen práctico (solo usar www por ahora)

1. **GitHub → Settings → Pages → Custom domain:**  
   `www.tudominio.com` → Save.
2. **GoDaddy → DNS:**  
   - Un registro **CNAME**: nombre `www`, valor `obebeclothes-commits.github.io`.
3. Esperar **5–60 minutos** (a veces hasta 48 h).
4. En GitHub, en la misma sección de Pages, comprobar que pone algo como “DNS check successful” y activar **Enforce HTTPS** si está disponible.

Para que **tudominio.com** (sin www) lleve al mismo sitio, en GoDaddy puedes crear una **redirección** de dominio:  
**Dominio → Redirección** → redirigir `tudominio.com` a `https://www.tudominio.com`. Así todo termina en tu sitio en www.

---

## 5. Para www.obebe.store (pasos exactos en GoDaddy)

Si GitHub te dice **"InvalidCNAMEError"** o **"improperly configured"**:

1. Entra a **GoDaddy** → **Mis Productos** → dominio **obebe.store** → **DNS** / **Administrar DNS**.
2. **Quita** cualquier registro CNAME que tenga nombre **www** y que apunte a otra cosa (editar o eliminar).
3. **Añade** un registro nuevo (o edita el de www):
   - **Tipo:** **CNAME**
   - **Nombre:** solo **www** (GoDaddy a veces añade solo; si te pide “Nombre/Host”, es `www`).
   - **Valor / Apunta a / Destino:** exactamente **obebeclothes-commits.github.io**
     - Sin `https://`
     - Sin `http://`
     - Sin barra final `/`
     - Sin el nombre del repo (`/obebe-gymshark`)
   - **TTL:** 600 (o 1 hora). Guarda.
4. Espera **5–15 minutos** y en GitHub vuelve a **Settings → Pages**, pon **www.obebe.store** y pulsa **Save**. Si sigue fallando, espera hasta 1 hora (propagación DNS).

**Errores frecuentes:** valor con `https://`, con `/obebe-gymshark`, o nombre `www.obebe.store` en vez de solo `www`.

---

## 6. Tener obebe.store sin www (dominio raíz)

Para que **obebe.store** (sin www) también abra tu sitio:

1. En GoDaddy, en los DNS de **obebe.store**, localiza el registro **A** con nombre **@** que apunta a **WebsiteBuilder Site**.
2. **Edítalo** o **elimínalo** (si no puedes editarlo, elimínalo y crea los nuevos).
3. Añade **4 registros A** con nombre **@** y estos valores (uno por cada IP):

   | Tipo | Nombre | Valor            | TTL    |
   |------|--------|------------------|--------|
   | A    | @      | 185.199.108.153  | 1 Hora |
   | A    | @      | 185.199.109.153  | 1 Hora |
   | A    | @      | 185.199.110.153  | 1 Hora |
   | A    | @      | 185.199.111.153  | 1 Hora |

   En GoDaddy: **Añadir** → Tipo **A** → Nombre **@** → Valor **la IP** → Guardar. Repite para las 4 IPs.

4. Deja el **CNAME** de **www** como está (apuntando a `obebeclothes-commits.github.io`).
5. En **GitHub → Settings → Pages → Custom domain** puedes dejar **www.obebe.store**. Con los A de @, **obebe.store** (sin www) también servirá tu sitio.

No uses CNAME para **@** (el raíz); solo los 4 registros A.

---

## 7. Comprobar que funciona

- Abre `https://www.tudominio.com` en el navegador (usa https cuando GitHub ya haya activado el certificado).
- Si ves tu página de Obebe, la conexión dominio ↔ GitHub Pages está bien.

---

## Problemas frecuentes

- **“DNS check failed” en GitHub:**  
  Espera un poco más y revisa en GoDaddy que el CNAME de `www` apunte exactamente a `obebeclothes-commits.github.io` (sin `https://`, sin barra final).

- **“Este sitio no se puede alcanzar”:**  
  Suele ser DNS aún propagando. Vuelve a revisar nombres y valores en GoDaddy.

- **Solo funciona con www (o solo sin www):**  
  Si quieres los dos, en GitHub deja el dominio que prefieras como principal (por ejemplo www) y en GoDaddy usa la redirección del dominio raíz a www (o los A si quieres que el raíz apunte directo a GitHub).

Si me dices el dominio exacto (por ejemplo `obebe.com` o `obebestore.com`) te puedo decir línea por línea qué poner en cada campo de GoDaddy.
