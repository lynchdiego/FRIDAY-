# FRIDAY — Qué hacer si algo deja de funcionar

*Se amplía en cada etapa.*

| Lo que ves | Qué significa | Qué hacer |
|---|---|---|
| «No puedo pensar ahora: …» | Claude no responde (sin saldo, llave inválida, saturado o sin internet). | Espera unos minutos. Si sigue: revisa saldo y llave en platform.claude.com. |
| «Llegamos al límite de gasto de hoy» | Se alcanzó el límite diario. | Normal: se restablece mañana. Si lo necesitas, sube `DAILY_LIMIT_USD`. |
| «Google Calendar / Gmail no está disponible» | Google no responde o se perdió el permiso. | Intenta más tarde. Si sigue: reconecta Google en Ajustes (etapa 4). |
| «La confirmación venció» | Pasaron más de 5 minutos. | Pide a FRIDAY que la prepare de nuevo. |
| «Esta confirmación no es válida o ya se usó» | Se confirmó dos veces o el enlace es viejo. | Nada que hacer: no se ejecutó dos veces. |
| La app pide contraseña otra vez | La sesión venció (30 días) o se cerró. | Entra de nuevo. 5 intentos fallidos bloquean 15 minutos. |
| La cinta de luz no se ve | El equipo no puede dibujar 3D; aparece un anillo quieto. | No afecta a FRIDAY. Reporta el equipo y navegador. |

## Revisar qué pasó
- Registro de auditoría: `GET /api/audit` (pantalla en Ajustes, etapa 7). Muestra cada propuesta, confirmación, ejecución, rechazo y error.
- Registro del servidor: la terminal donde corre `npm run dev:server` (o los logs del servidor en producción).

## Plan B general
Si FRIDAY no está disponible, todo sigue en tus apps de siempre (Google Calendar, Gmail). FRIDAY no guarda nada que no exista también allá, salvo su memoria, pendientes y recordatorios, que puedes exportar.
