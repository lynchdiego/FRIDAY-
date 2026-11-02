# Conectar tu Google real a FRIDAY (≈ 30 minutos, una sola vez)

*Hazlo cuando quieras pasar de los datos ficticios a tu agenda y correo reales. Si algún nombre de menú cambió, dímelo y lo ajustamos.*

## 1. Crear el proyecto
1. Entra a **console.cloud.google.com** con tu cuenta de Google.
2. Arriba, en el selector de proyectos → **Proyecto nuevo** → nombre: `FRIDAY` → **Crear**.

## 2. Activar las tres APIs
Menú ☰ → **APIs y servicios** → **Biblioteca**. Busca y presiona **Habilitar** en cada una:
- Gmail API
- Google Calendar API
- Google Tasks API

## 3. Pantalla de consentimiento (Google Auth Platform)
Menú ☰ → **Google Auth Platform** (antes "Pantalla de consentimiento de OAuth") → **Comenzar**:
1. **Información de la app / Branding:** nombre `FRIDAY`, correo de asistencia: el tuyo.
2. **Público / Audience:** tipo **Externo**. Agrega tu correo como contacto.
3. Al terminar, en **Público** presiona **Publicar app** → **En producción** (lo que acordamos: así el acceso no caduca cada 7 días). Google avisará que la app no está verificada: es normal para uso personal.
4. **Acceso a los datos / Data Access** → **Agregar o quitar permisos** y marca solo estos:
   - `.../auth/calendar.events`
   - `.../auth/gmail.readonly`
   - `.../auth/gmail.compose`
   - `.../auth/tasks`
   - `openid` y `.../auth/userinfo.email`

## 4. Crear la llave de la app (cliente OAuth)
**Google Auth Platform** → **Clientes** → **Crear cliente**:
- Tipo: **Aplicación web** · Nombre: `FRIDAY`
- **URI de redireccionamiento autorizados:** `http://localhost:5173/api/google/callback`
  (cuando publiquemos FRIDAY en internet, en la etapa 7, agregamos la dirección definitiva)
- **Crear.** Copia el **ID de cliente** y el **Secreto del cliente**. **No los pegues en el chat.**

## 5. Ponerlos en FRIDAY
En tu archivo `.env` (en tu Mac, nunca en GitHub):
```
INTEGRATIONS=google
GOOGLE_CLIENT_ID=(pega el ID de cliente)
GOOGLE_CLIENT_SECRET=(pega el secreto)
ENCRYPTION_KEY=(genera una con el comando de abajo)
```
Para generar la llave de cifrado, en Terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 6. Conectar
1. Reinicia FRIDAY (`npm run dev:server`).
2. En la app: botón redondo de arriba a la derecha → **Ajustes** → Google → **Conectar**.
3. Google mostrará **"Google no verificó esta app"** → **Configuración avanzada** → **Ir a FRIDAY**. Es tu propia app; es seguro.
4. **Marca todas las casillas** de permisos → **Continuar**.
5. Verás "Google conectado". Pregúntale a FRIDAY: «¿Qué tengo hoy?»

## Para desconectar
En **Ajustes** → Google → **Desconectar** (FRIDAY también revoca el acceso en Google). O desde tu cuenta de Google → Seguridad → Apps con acceso a tu cuenta.

## Qué puede y qué no puede hacer FRIDAY con estos permisos
- **Calendar:** ver y editar eventos de tus calendarios (no puede cambiar ajustes ni compartir calendarios).
- **Gmail:** leer correos, crear borradores y enviar. No puede borrar correos ni cambiar etiquetas o filtros. Enviar siempre requiere tu sí.
- **Tasks:** ver, crear y completar pendientes.
