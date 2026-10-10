# 💌 Guía Paso a Paso: Configurar el Envío de Correos con tu Gmail y Commits en GitHub

Esta guía te explica de forma muy sencilla cómo hacer que los correos salgan directamente desde tu cuenta personal **`maoaza13579@gmail.com`** y cómo conectar los commits automáticos a tu repositorio de GitHub usando **Google Apps Script** (100% gratuito y sin servidores externos).

---

## 📌 ¿Por qué usamos Google Apps Script?
1. **Tus correos salen de tu Gmail real**: Cada invitado recibirá un correo directamente desde `maoaza13579@gmail.com` con su código QR, puesto y el botón de Google Calendar.
2. **Cero costos**: Es un servicio oficial de Google totalmente gratuito.
3. **Seguridad absoluta**: Tu Token de GitHub se guarda de forma privada en los servidores de Google y nunca queda expuesto al público en la página web.
4. **Commits automáticos**: Cada vez que alguien confirma asistencia, cancela o ingresa, Google Apps Script ejecuta un commit en tu repositorio en GitHub para actualizar `data/database.json`.

---

## 🚀 PASO 1: Crear el Token de GitHub (PAT)

Para que el script pueda hacer commits en tu repositorio:

1. Ve a GitHub e inicia sesión con tu cuenta `MAOAZAking`.
2. Haz clic en tu foto de perfil (arriba a la derecha) y entra en **Settings** (Configuración).
3. En el menú de la izquierda, baja hasta el final y haz clic en **Developer Settings**.
4. Haz clic en **Personal access tokens** -> **Tokens (classic)**.
5. Haz clic en **Generate new token** -> **Generate new token (classic)**.
6. En **Note**, escribe: `Token 15 Sara Sofia`.
7. En **Expiration**, selecciona `No expiration` o 90 días.
8. En los permisos (scopes), marca la casilla **`repo`** (Full control of private repositories / public repositories).
9. Baja y haz clic en el botón verde **Generate token**.
10. **¡IMPORTANTE!** Copia el código que empieza por `ghp_...` y guárdalo en un bloc de notas (GitHub no te lo volverá a mostrar).

---

## 🚀 PASO 2: Crear el Proyecto en Google Apps Script

1. Abre tu navegador con tu cuenta de correo **`maoaza13579@gmail.com`**.
2. Entra a: **[https://script.google.com/](https://script.google.com/)**
3. Haz clic en el botón **+ Nuevo proyecto** (arriba a la izquierda).
4. Arriba donde dice *"Proyecto sin título"*, cámbiale el nombre a: `Backend 15 Sara Sofia`.
5. Borra el código que viene por defecto en el editor.
6. Abre el archivo `backend/Code.gs` de este proyecto, copia todo su contenido y pégalo en el editor de Google Apps Script.
7. Haz clic en el icono del disquete **Guardar** (o `Ctrl + S`).

---

## 🚀 PASO 3: Guardar el Token de GitHub de forma Segura

1. En el menú lateral izquierdo de Google Apps Script, haz clic en el icono de engranaje ⚙️ (**Configuración del proyecto**).
2. Baja hasta la sección **Propiedades de la secuencia de comandos** (Script Properties).
3. Haz clic en **Editar las propiedades de la secuencia de comandos** -> **Agregar propiedad**:
   - **Propiedad**: `GITHUB_TOKEN`
   - **Valor**: Pega el token `ghp_...` que copiaste en el Paso 1.
4. Haz clic en **Guardar propiedades**.

---

## 🚀 PASO 4: Desplegar la Aplicación Web

1. Vuelve al editor de código haciendo clic en el icono `< >` (Editor) a la izquierda.
2. Arriba a la derecha, haz clic en el botón azul **Implementar** (Deploy) -> **Nueva implementación** (New deployment).
3. En el engranaje ⚙️ junto a *"Seleccionar tipo"*, elige **Aplicación web** (Web app).
4. Configura los campos exactamente así:
   - **Descripción**: `Versión 1 - Asistencias 15 Sara Sofia`
   - **Ejecutar como**: **Yo (maoaza13579@gmail.com)** *(Esto garantiza que los correos salgan de tu cuenta)*.
   - **Quién tiene acceso**: **Cualquier usuario** (Anyone) *(Necesario para que los invitados desde la web puedan enviar su confirmación)*.
5. Haz clic en **Implementar**.
6. Google te pedirá autorizar permisos la primera vez:
   - Haz clic en **Revisar permisos** (Authorize access).
   - Selecciona tu cuenta `maoaza13579@gmail.com`.
   - Si Google muestra un aviso de *"Google no ha verificado esta app"*, haz clic en **Configuración avanzada** (Advanced) abajo a la izquierda y luego en **Ir a Backend 15 Sara Sofia (no seguro)**.
   - Haz clic en **Permitir** (Allow).
7. Al finalizar, Google te mostrará una **URL de la aplicación web** que termina en `/exec`.
8. **¡Copia esa URL!**

---

## 🚀 PASO 5: Vincular la URL a la Página Web

1. Abre el archivo `js/config.js` en tu proyecto.
2. Busca la línea:
   ```javascript
   BACKEND_API_URL: "",
   ```
3. Pega la URL que copiaste entre las comillas:
   ```javascript
   BACKEND_API_URL: "https://script.google.com/macros/s/AKfycbx...TU_URL_AQUI.../exec",
   ```
4. Guarda el archivo y sube los cambios a tu repositorio con git push.

¡Listo! A partir de ese momento, cada confirmación, cancelación o escaneo de QR activará commits automáticos y enviará los correos reales desde tu cuenta `maoaza13579@gmail.com`.
