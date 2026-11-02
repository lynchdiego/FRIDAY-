# FRIDAY para clientes de NODO — Guía de instalación (plantilla)

*Plantilla reutilizable. Reemplaza lo que está entre [corchetes]. Se completa al cerrar cada etapa del piloto.*

## 0. Antes de empezar (con el cliente)
- Nombre del cliente: [ ] · Zona horaria: [America/Cancun] · Correo de Google: [ ]
- ¿Google Workspace (empresa) o Gmail personal? → define el tipo de app de Google (ver 2).
- Acordar límite de gasto diario en Claude: [US$2] y mensual: [US$40].
- Explicar las reglas fijas (Nunca) y el «sí» obligatorio. Obtener su aceptación por escrito.

## 1. Cuentas
| Servicio | Quién la crea | Para qué | Costo |
|---|---|---|---|
| Claude Console (platform.claude.com) | NODO o el cliente | Cerebro de FRIDAY | Por uso (ver plan de costos) |
| Google Cloud | NODO, en proyecto del cliente | Calendar, Gmail, Tasks | Gratis |
| ElevenLabs | NODO | Voz | Plan mensual (etapa 5) |
| Servidor (Hetzner u otro) | NODO | Hospedar FRIDAY | ~€4–6/mes (etapa 7) |

## 2. Google
- **Workspace del cliente:** app "Interna" → sin verificación de Google.
- **Gmail personal:** app "Externa" en producción sin verificar (aviso de "app no verificada" una vez), o verificación formal si se escala. *(Detalle en etapa 4.)*
- Permisos mínimos: Calendar (`calendar.events`), Gmail (`gmail.readonly` + `gmail.compose`), Tasks (`tasks`), `openid`, `email`.
- Pasos detallados: `docs/google-setup.md` (cambiar el URI de redirección por el dominio del cliente).
- Gmail personal en producción sin verificar: tope de 100 usuarios **de por vida por proyecto** → un proyecto de Google Cloud por cliente.

## 3. Configuración
1. Clonar el repositorio de FRIDAY para el cliente.
2. Copiar `.env.example` a `.env` y llenar: `FRIDAY_PASSWORD` (larga y única), `ENCRYPTION_KEY` (generada), `ANTHROPIC_API_KEY`, `DAILY_LIMIT_USD`, `FRIDAY_TZ`, `OWNER_NAME`.
3. Personalizar `apps/server/prompts/friday.md` (nombre, negocio, tono). No quitar las secciones de seguridad.
4. Revisar `packages/shared/src/skills.ts`: activar solo las habilidades contratadas.

## 3.5 Publicar
Seguir `docs/despliegue.md` con el dominio del cliente (p. ej. `friday.cliente.com`). Un servidor por cliente (datos separados). Revisar `docs/revision-seguridad.md` con el cliente.

## 4. Pruebas antes de entregar
- `npm test` (todas deben pasar).
- `npm run test:live` con la llave del cliente (costo: centavos).
- Prueba manual con el cliente: agenda de hoy, borrador, correo con confirmación, cancelar, recordatorio.

## 5. Entrega
- Instalar la app en Mac y iPhone del cliente (ver `docs/manual-de-uso.md` → Instalar) y activar Avisos en cada dispositivo.
- Entregar el `manual-de-uso.md` personalizado y el `procedimiento-fallas.md`.
- Programar revisión a los 7 días: costos reales, ajustes de tono, habilidades nuevas.
