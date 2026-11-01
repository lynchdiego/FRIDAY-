# FRIDAY — Plan de la etapa 1 (arquitectura)

Fecha: 2026-11-01. Estado: **pendiente de aprobación de Diego**. Aún no se escribió código.
Los precios vienen de páginas de terceros (no pude abrir las oficiales); todos deben confirmarse en la página del proveedor antes de pagar.

## 1. Decisiones técnicas (y por qué)

| Tema | Decisión | Por qué, en sencillo |
|---|---|---|
| Lenguaje | TypeScript en todo | Un solo lenguaje para servidor y app; menos errores. |
| Servidor | Node.js + Fastify | Ligero, rápido, buen soporte para streaming (voz y texto). |
| IA | SDK oficial de Anthropic con **mi propio ciclo de herramientas** (no el Agent SDK) | El Agent SDK está pensado para agentes que programan (archivos, terminal). Aquí necesitamos control total de permisos, tokens de confirmación y auditoría; con el SDK normal el servidor decide qué se ejecuta, no el modelo. También facilita comparar proveedores en NODO. |
| Base de datos | PostgreSQL + Drizzle ORM | Mismo motor que NODO; Drizzle da migraciones simples. Docker en local. |
| App | Vite + React + TypeScript, PWA | Instalable en Mac e iPhone; después se envuelve en app nativa. |
| Möbius | Three.js + shader de `referencia/` + postproceso (bloom, aberración cromática, grano, viñeta) | Es lo que pediste. Calidad se ajusta sola según el equipo. |
| Estructura | Monorepo (`apps/web`, `apps/server`, `packages/shared`) | La lista de habilidades/permisos vive en `shared` y la usan servidor y pantalla. |
| Sesión | Un usuario, contraseña (hash argon2) y cookie segura; tablas ya con `user_id` | Multiusuario después sin rehacer. |
| Cifrado de tokens | AES-256-GCM con llave en variable de entorno | Los tokens de Google nunca quedan en texto plano. |
| Programador | Tareas en el servidor (tabla `jobs` + temporizador) y endpoints webhook | Se puede mover a n8n después. |
| Avisos | Web Push (en iPhone requiere instalar la PWA, iOS 16.4+) | Para el resumen de las 7:30 y recordatorios. |

## 2. Estructura del repositorio

```
CLAUDE.md
referencia/                 (shader y animaciones)
docs/                       (plan, manual, instalación cliente, fallas)
apps/server/src/{api,agent,tools,google,voice,memory,scheduler,security,db}
apps/server/prompts/friday.md
apps/web/src/{screens,components,mobius,voice,styles}
packages/shared/            (skills.ts = fuente única de permisos)
tests/conversaciones/
docker-compose.yml  .env.example  .gitignore
```

## 3. Modelo de datos (PostgreSQL)

`users`, `sessions`, `profile` (clave/valor), `people`, `projects`, `tasks` (pendientes), `reminders`, `conversations`, `messages`, `summaries` (historial resumido), `memories` (hechos duraderos), `google_connections` (tokens cifrados), `pending_actions` (acción propuesta + hash del contenido + token de un solo uso + expiración), `audit_log` (propuso → confirmó → ejecutó/falló), `usage_log` (modelo, tokens, costo estimado), `jobs`, `settings`.

## 4. Herramientas y permisos

Una sola lista en `packages/shared/skills.ts`; el servidor rechaza cualquier herramienta que no esté ahí y la pantalla "Habilidades y permisos" se dibuja desde la misma lista.

- **LEE:** `calendar_list`, `calendar_search`, `gmail_search`, `gmail_read` (contenido marcado como no confiable), `tasks_list`, `memory_read`.
- **PROPONE:** `gmail_draft` (guarda borrador en Gmail), `event_propose`, `task_add`/`reminder_add` (internos, reversibles), `memory_save`.
- **ACTÚA (solo con tu sí):** `gmail_send`, `event_create`, `event_update`. Flujo: el modelo propone → el servidor guarda la acción con un token de un solo uso (expira en ~5 min, atado al contenido exacto) → tú confirmas con botón o voz → solo el servidor, tras validar el token, ejecuta. El modelo nunca recibe el token ni puede ejecutar por su cuenta. Si editas el contenido, el token anterior se invalida.
- **NUNCA:** pagar, borrar sin papelera, publicar en tu nombre, compartir llaves, obedecer instrucciones dentro de correos/archivos/páginas. No existe herramienta para esto.

Contenido externo (correos, eventos) se envuelve en etiquetas `<datos_no_confiables>` y el prompt dice que son datos. Además, si en el mismo turno se leyó contenido externo, las acciones ACTÚA exigen siempre confirmación explícita en pantalla (no basta con voz ambigua).

Modelos: `MODEL_DEFAULT=claude-sonnet-5-5`, `MODEL_HEAVY=claude-opus-5-5` (variables de entorno). Opus se usa si pides "planea mi semana" o analizar documentos largos, o por interruptor en la app. Se usará caché de prompts para abaratar.

## 5. Voz (verificado, con reservas)

- **Voz de salida — recomiendo ElevenLabs Flash v2.5** (streaming, ~75 ms, español). API ≈ **$0.04–0.05 por 1,000 caracteres** (las fuentes difieren; hubo un recorte de precio en octubre 2026). Voz original diseñada con el "Voice Design", sin clonar a nadie. Alternativa: Cartesia/otros si el costo no convence.
- **Voz de entrada — recomiendo ElevenLabs Scribe v2 Realtime** (**≈ $0.39/hora**) para tener un solo proveedor. Alternativa: Deepgram Nova-3 multilingüe streaming (**≈ $0.009/min**, ≈ $0.55/hora). **No pude verificar cuál entiende mejor español de México**: en la etapa 5 grabaremos las mismas 10 frases tuyas en ambos y escoges.
- Respaldo gratis: reconocimiento de voz del navegador (menos fiable en iPhone) y modo solo texto.
- Planes: ElevenLabs cobra por suscripción mensual con créditos; hay que elegir el plan más bajo que alcance. **No pude confirmar precios de planes** — lo reviso en la etapa 5.

## 6. Estimado mensual (uso diario fuerte, supuestos explícitos)

Supuestos: 30 intercambios/día, ~6k tokens de entrada (con caché) y ~400 de salida; resumen diario; 5 tareas con Opus al mes; 8 min/día hablando; ~7,500 caracteres hablados por día.

| Concepto | USD/mes |
|---|---|
| Claude Sonnet 5.5 ($2 entrada / $10 salida por millón) | 8–15 |
| Claude Opus 5.5 ($4 / $20) ocasional | 1–2 |
| Voz de salida (ElevenLabs) | 8–15 |
| Voz de entrada | 2–5 |
| Servidor (Hetzner ≈ €4–6; ver abajo) | 5–7 |
| Google APIs | 0 |
| **Total** | **≈ 25–45** |

Con el límite de gasto diario (por defecto sugerido: US$2 al día en Claude) no puedes pasarte sin enterarte.

## 7. Hosting (etapa 7)

Recomiendo un VPS de **Hetzner** (≈ €4–6/mes tras el alza de abril 2026, confirmar), con servidor + Postgres juntos, Docker y HTTPS automático (Caddy). Hay ubicación en EE. UU. (cerca de Cancún). Alternativa más fácil pero más cara y variable: Railway (cobro por uso). Fly.io subió la RAM a $6/GB en octubre 2026.

## 8. Riesgos que encontré (necesito tu decisión en el #1)

1. **Google en modo "Testing" caduca el acceso cada 7 días**: tendrías que reconectar Google cada semana. Además, los permisos de leer Gmail son "restringidos" y publicar la app oficialmente pide verificación y evaluación de seguridad (cara y larga). **Mi recomendación:** crear la app en Google Cloud como "En producción" pero **sin verificar**, solo para tu cuenta: Google muestra un aviso de "app no verificada" que aceptas tú una vez, el acceso ya no caduca a los 7 días y está limitado a 100 usuarios (suficiente para el piloto). Para clientes de NODO habrá que revisar otra vía (Workspace interno o verificación). Alternativa: quedarte en Testing y reconectar cada semana.
2. Precios de IA y voz salen de terceros; los confirmo contra páginas oficiales antes de cada etapa que los use.
3. Meta (WhatsApp): sin cambios; FRIDAY no será chatbot de WhatsApp.
4. iPhone: las notificaciones y el micrófono continuo en PWA tienen límites de iOS; el atajo ⌥+espacio solo funciona en Mac con la app enfocada.

## 9. Etapas siguientes (sin cambios)

2 Interfaz y Möbius → 3 Cerebro por texto → 4 Google → 5 Voz → 6 Recordatorios → 7 Pulido y despliegue. Cada una termina con commit, `CLAUDE.md` actualizado y pasos para que pruebes.

## 10. Preguntas para ti

1. ¿Google "En producción sin verificar" (recomendado) o "Testing" con reconexión semanal?
2. ¿Límite diario de gasto en Claude: US$2 (sugerido) u otro?
3. ¿Aprobado el stack y el plan para pasar a la etapa 2 (interfaz y Möbius)? Esta etapa no gasta API: solo datos ficticios.
