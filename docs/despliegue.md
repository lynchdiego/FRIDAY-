# Publicar FRIDAY en internet (≈ 45–60 minutos, una vez)

Al terminar tendrás FRIDAY en `https://friday.tudominio.com`, instalable en tu Mac y tu iPhone, con HTTPS, base de datos y respaldos diarios.

## Qué necesitas
1. **Un dominio** (o subdominio de uno que ya tengas, p. ej. `friday.navuastudios.com`). HTTPS es obligatorio: sin él no funcionan el micrófono, las notificaciones ni la instalación en iPhone.
2. **Un servidor Linux con Docker**, mínimo 2 GB de RAM (recomendado 4 GB). Ejemplo abajo con Hetzner.
3. Tus llaves: Claude (obligatoria para conversar), Google y ElevenLabs (opcionales; se pueden agregar después).

## 1. Crear el servidor (ejemplo: Hetzner Cloud)
1. hetzner.com/cloud → crea cuenta y proyecto `FRIDAY`.
2. **Agregar servidor**: ubicación **Alemania o Finlandia** (la más barata; ver nota de precios), imagen **Ubuntu 24.04**, tipo **CX23** (2 vCPU, 4 GB) o el más barato con 4 GB.
3. **Llave SSH** (para entrar sin contraseña). En tu Mac, Terminal:
   ```bash
   ssh-keygen -t ed25519 -C "friday"
   ```
   ```bash
   cat ~/.ssh/id_ed25519.pub
   ```
   Copia lo que aparece y pégalo en Hetzner → SSH keys.
4. Crea el servidor y copia su **IP**.

> Nota de precios (nov. 2026): Hetzner cambió precios dos veces este año y las fuentes no coinciden; la línea CX no está en sus centros de EE. UU. Confírmalo al contratar. Alternativas con centro en EE. UU. (más cerca de Cancún): DigitalOcean o Vultr, mismo procedimiento.

## 2. Apuntar el dominio
En tu proveedor de dominio, crea un registro **A**: nombre `friday`, valor: la IP del servidor. Espera 5–30 minutos.

## 3. Preparar el servidor
```bash
ssh root@LA_IP_DEL_SERVIDOR
```
Ya dentro:
```bash
curl -fsSL https://get.docker.com | sh
```
```bash
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw --force enable
```

## 4. Descargar FRIDAY
El repositorio es privado: en GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained**, crea un token de **solo lectura** para el repositorio de FRIDAY.
```bash
git clone https://github.com/lynchdiego/FRIDAY-.git friday && cd friday
```
(Te pedirá usuario y, como contraseña, el token.)

## 5. Configurar
```bash
cp .env.example .env && nano .env
```
Llena como mínimo:
- `FRIDAY_DOMAIN=friday.tudominio.com`
- `POSTGRES_PASSWORD=` y `ENCRYPTION_KEY=`: genera cada una con
  ```bash
  openssl rand -base64 32
  ```
- `FRIDAY_PASSWORD=` (mínimo 14 caracteres, única)
- `ANTHROPIC_API_KEY=`
- `VAPID_SUBJECT=mailto:tu-correo`
- Google (opcional): `INTEGRATIONS=google`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- ElevenLabs (opcional): `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`

Guarda con Ctrl+O, Enter, Ctrl+X.

## 6. Encender
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
La primera vez tarda 3–5 minutos. Revisa:
```bash
docker compose -f docker-compose.prod.yml ps
```
Abre `https://friday.tudominio.com` y entra con tu contraseña.

## 7. Google (si lo usas)
En Google Cloud → Google Auth Platform → Clientes → tu cliente → agrega el URI:
`https://friday.tudominio.com/api/google/callback`. Luego en FRIDAY: Ajustes → Google → Conectar (`docs/google-setup.md`, paso 6).

## 8. Instalar la app
- **iPhone:** abre la dirección en **Safari** → botón Compartir → **Agregar a pantalla de inicio**. Abre FRIDAY desde el ícono → Ajustes → Avisos → **Activar**.
- **Mac:** en **Chrome**, ícono de instalar en la barra de direcciones; en **Safari**, menú Archivo → **Agregar al Dock**. Luego Ajustes → Avisos → Activar.

## Actualizar FRIDAY (cuando haya mejoras)
```bash
cd friday && git pull && docker compose -f docker-compose.prod.yml up -d --build
```

## Respaldos
Cada día se guarda una copia de la base de datos en `friday/backups/` (se conservan 14 días). Para descargar el último a tu Mac:
```bash
scp root@LA_IP_DEL_SERVIDOR:friday/backups/$(date +%F)*.dump .
```
Restaurar (solo si algo se perdió; pídeme ayuda):
```bash
docker compose -f docker-compose.prod.yml cp backups/ARCHIVO.dump db:/tmp/r.dump
```
```bash
docker compose -f docker-compose.prod.yml exec db pg_restore -U friday -d friday --clean /tmp/r.dump
```

## Costo mensual estimado
| Concepto | USD/mes |
|---|---|
| Servidor (Hetzner Europa, 4 GB) | ≈ 5–8 (confirmar) |
| Dominio | ≈ 1 (≈ 12/año; gratis si usas un subdominio tuyo) |
| Claude | 9–17 |
| ElevenLabs (opcional) | ≈ 9 |
| **Total** | **≈ 20–35** |
