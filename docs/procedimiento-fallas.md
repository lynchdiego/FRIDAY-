# FRIDAY — Qué hacer si algo deja de funcionar

*Se amplía en cada etapa.*

| Lo que ves | Qué significa | Qué hacer |
|---|---|---|
| «No puedo pensar ahora: …» | Claude no responde (sin saldo, llave inválida, saturado o sin internet). | Espera unos minutos. Si sigue: revisa saldo y llave en platform.claude.com. |
| «Llegamos al límite de gasto de hoy» | Se alcanzó el límite diario. | Normal: se restablece mañana. Si lo necesitas, sube `DAILY_LIMIT_USD`. |
| «Google Calendar / Gmail / Google Tasks respondió con un error» | Google tuvo una falla temporal. | Intenta en unos minutos. Tus datos están intactos en Google. |
| «Google retiró el acceso. Vuelve a conectar Google.» | Cambiaste tu contraseña de Google, revocaste el acceso o caducó. | Habilidades y permisos → Google → Conectar. |
| «Google no está conectado» | Aún no se conecta (o se desconectó). | Sigue `docs/google-setup.md`, paso 6. |
| «No se pudo conectar Google. Revisa que marcaste todos los permisos.» | En la pantalla de Google faltó marcar alguna casilla. | Conecta de nuevo y marca todas. |
| «La confirmación venció» | Pasaron más de 5 minutos. | Pide a FRIDAY que la prepare de nuevo. |
| «Esta confirmación no es válida o ya se usó» | Se confirmó dos veces o el enlace es viejo. | Nada que hacer: no se ejecutó dos veces. |
| La app pide contraseña otra vez | La sesión venció (30 días) o se cerró. | Entra de nuevo. 5 intentos fallidos bloquean 15 minutos. |
| «No tengo permiso para usar el micrófono» | El navegador bloqueó el micrófono. | Mac: Safari/Chrome → Ajustes del sitio → Micrófono → Permitir. iPhone: Ajustes → Safari → Micrófono. |
| «No te escuché» | Fue un toque corto o no hubo audio. | Mantén presionado mientras hablas. |
| «No pude transcribir. Escríbemelo» | ElevenLabs no respondió o sin saldo. | Escribe por ahora; revisa tu cuenta de ElevenLabs. |
| FRIDAY responde pero sin voz | Silencio activado, o la voz falló. | Toca el botón de la bocina. Si sigue, revisa ElevenLabs; la respuesta siempre queda en pantalla. |
| La cinta de luz no se ve | El equipo no puede dibujar 3D; aparece un anillo quieto. | No afecta a FRIDAY. Reporta el equipo y navegador. |

## Revisar qué pasó
- Registro de auditoría: `GET /api/audit` (pantalla en Ajustes, etapa 7). Muestra cada propuesta, confirmación, ejecución, rechazo y error.
- Registro del servidor: la terminal donde corre `npm run dev:server` (o los logs del servidor en producción).

## Plan B general
Si FRIDAY no está disponible, todo sigue en tus apps de siempre (Google Calendar, Gmail). FRIDAY no guarda nada que no exista también allá, salvo su memoria, pendientes y recordatorios, que puedes exportar.
