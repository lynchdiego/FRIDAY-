# FRIDAY — contexto para sesiones futuras

Asistente ejecutivo personal de Diego Lynch (piloto; luego paquete premium de NODO). Prompt original: `docs/prompt-original.md`. Diego no programa: explicar en español sencillo, probar cada etapa, no avanzar sin su aprobación, cuidar el presupuesto, cambios enfocados.

## Estado de etapas
1. Plan — **aprobado** (`docs/plan-etapa-1.md`).
2. Interfaz y Möbius — **aprobado** (2026-11-01). Ajustes posteriores: estados más distintos; Inicio responsivo para iPhone.
3. Cerebro por texto — **aprobado** (2026-11-01). Falta la prueba corta con Claude real (`npm run test:live`) cuando Diego tenga su llave.
4. Google (Calendar, Gmail, **Tasks**) + resumen del día + pantalla 5 — **aprobado** (2026-11-02). Google real listo pero sin conectar (guía: `docs/google-setup.md`).
5. Voz — **hecho, pendiente de aprobación** (`docs/etapa-5.md`). 28 pruebas pasan. ElevenLabs listo pero sin llave (hoy: voz del navegador).
6–7. Sin empezar.

## Acuerdos con Diego (2026-11-01)
- Google: app "En producción sin verificar" (evita caducidad de 7 días de Testing). Verificación formal después, para NODO.
- Límite de gasto diario en Claude: US$2 (piloto).
- Plan de llaves: construir 3, 4 y 5 con simuladores; solo una prueba corta con Claude real al final de la 3; Google y ElevenLabs al final.
- Alcance v1 ampliado (aprobado): **Google Tasks** (pendientes sincronizados) y **mensajes de WhatsApp preparados** (enlace wa.me: FRIDAY redacta, Diego envía con un toque). No hay API oficial para WhatsApp personal: no automatizar.
- v2 (después del piloto): reservaciones por llamada con voz (ElevenLabs + número telefónico, identificándose como IA) e iMessage desde la app nativa de Mac.
- La interfaz se puede seguir ajustando; Diego quiere una interfaz productiva, simple y efectiva en iPhone y Mac. Agrupar ajustes de diseño por etapa.

## Arquitectura (como está construida)
- Monorepo npm workspaces: `apps/web` (Vite 8 + React 19 + three), `apps/server` (Fastify 5 + TS con tsx), `packages/shared` (habilidades/permisos y tipos de tarjetas).
- **Permisos**: `packages/shared/src/skills.ts` es la fuente única. El servidor solo ofrece al modelo herramientas `activa` y nunca `NUNCA`. `ACTUA` → `tools/execute.ts` crea `pending_actions` con token de un solo uso (solo hash en BD; el token va a la pantalla, nunca al modelo). Ejecutar: `POST /api/actions/:id/confirm` (token) o "sí" escrito/dicho por Diego si `verbal_ok` (falso si en ese turno se leyó contenido externo). Ejecución atómica (UPDATE … WHERE status='pendiente' AND expires_at>now()).
- **Contenido externo** (correo/calendario) se envuelve en `<datos_no_confiables>` con `<`/`>` escapados + detector de instrucciones sospechosas (`SUSPICIOUS`) que avisa y audita.
- **Modelo**: `llm/anthropic.ts` usa `client.beta.messages.create` con `fallbacks: 'default'` (beta `server-side-fallback-2026-07-01`), `output_config.effort` (`low` chat, `high` pesado), caché: bloque fijo de `prompts/friday.md` con `cache_control` + auto-caché. Fecha/hora va en el mensaje del usuario (`<contexto>`) para no romper la caché. Historial: solo se agrega, nunca se edita (requisito de "preserved thinking"); una conversación por sesión.
- Modelo pesado (Opus 5.5) si el texto coincide con `HEAVY` en `agent/run.ts` o `heavy: true`.
- `llm/mock.ts`: Claude simulado (gratis). `naive: true` se deja engañar por el correo malicioso (para probar que el servidor frena).
- **BD**: PostgreSQL; en desarrollo/pruebas PGlite (sin Docker). Migraciones SQL en `apps/server/src/db/migrations`. Se usa SQL directo (no Drizzle): más simple de leer; cambio respecto al plan.
- **Costos**: `usage_log` por llamada; `llm/pricing.ts` (Sonnet 5.5 $2/$10, Opus 5.5 $4/$20, caché $0.20). Límite diario → modo básico sin llamar al modelo.
- **Sesión**: contraseña única (`FRIDAY_PASSWORD`), cookie httpOnly, 5 intentos/15 min.
- Integraciones: `integrations/types.ts` (contratos Calendar/Mail/Tasks) + `mock.ts` (datos ficticios con correo malicioso) + `google.ts` (real: `@googleapis/*` + `google-auth-library`). Selección con `INTEGRATIONS=mock|google`. Scopes: calendar.events, gmail.readonly, gmail.compose, tasks, openid, email. OAuth: `/api/google/connect` → Google → `/api/google/callback` validado con `oauth_states` (la cookie es SameSite=strict y no viaja en ese salto). Tokens cifrados en `google_connections`; se re-cifran al refrescarse.
- Pendientes = Google Tasks (`integ.tasks`); la tabla `tasks` local quedó sin uso.
- Resumen del día: `agent/today.ts` → `GET /api/today` (prioridad: modelo 1×/día en `settings`, o heurística con el simulado). Web: `state/today.ts` (`toView`).
- Pantalla 5: `apps/web/src/screens/Skills.tsx` (lee `/api/skills`; cada habilidad tiene `help` para Diego y `description` para el modelo).
- Web: `state/chat.ts` (modo `server` o `demo` si no hay servidor), `screens/Chat.tsx` (pantalla 3), `components/Cards.tsx`, `ConfirmSheet.tsx` (pantalla 4 real). Horas siempre en la zona de Diego (`/api/me`).
- Möbius: `apps/web/src/mobius/` (`Mobius.ts` motor y `TARGETS` por estado, `shaders.ts`, `presence.ts`). Nivel de audio real en `liveLevel` (no emite a React; la Möbius lo lee cada cuadro); null → simulador.
- **Voz**: servidor `apps/server/src/voice.ts` (proxy ElevenLabs: `POST /api/voice/tts` → enlace de un solo uso `GET /api/voice/tts/:id` que transmite el audio por partes; `POST /api/voice/stt` audio crudo → Scribe; costos en `usage_log` con modelo `elevenlabs:*`; `ELEVENLABS_BASE_URL` configurable). Web `apps/web/src/voice/voice.ts` (micrófono → AnalyserNode → `liveLevel`; MediaRecorder si STT=elevenlabs, si no `SpeechRecognition` es-MX; reproductor único conectado a analizador; `speechSynthesis` de respaldo) y `voice/ptt.ts` (mantener para hablar). Responde con voz solo si el canal fue voz. Silencio en localStorage `friday.voz`.
- iPhone: el audio se "desbloquea" UNA vez con un WAV silencioso durante un toque (`unlockAudio`); repetirlo pausaba la voz de FRIDAY (bug corregido).
- Diagnóstico solo en desarrollo: `window.__friday` (`presence`, `liveLevel`).

## Cómo correr
- Pruebas: `npm test` (simulado, gratis) · `npm run test:live` (Claude real, requiere `ANTHROPIC_API_KEY`, centavos).
- Desarrollo: copiar `.env.example` a `.env`, poner `FRIDAY_PASSWORD`; `npm run dev:server` y `npm run dev:web` → http://localhost:5173.

## Notas técnicas
- El minificador de CSS de Vite fusiona `-webkit-backdrop-filter` y `backdrop-filter`: escribir solo `backdrop-filter`.
- En JS `\b` no reconoce letras acentuadas: usar `(?=[^\p{L}]|$)` con bandera `u` (ver `AFFIRM` en `agent/run.ts`).
- Vista previa privada: artefacto claude.ai (slug fb6c693a-1a3b-4874-895d-65ab208a7545), publicado desde `apps/web/dist` (modo demo).

## Pendientes
- Prueba con Claude real (Diego crea cuenta en platform.claude.com, US$10 de saldo, límite mensual ~US$20).
- Conectar el Google real de Diego (`docs/google-setup.md`) — al final, según el plan de llaves.
- Conectar ElevenLabs (voz original con Voice Design) al final; verificar precios y nombres de modelo en elevenlabs.io (bloqueado desde el servidor de desarrollo).
- Ajustar la ganancia del medidor de micrófono (`startMeter(an, 7)`) con la voz real de Diego.
- Etapa 6: recordatorios y resumen programado de las 7:30 con notificaciones.
- Resumir historial por día (`summaries`) cuando las conversaciones crezcan.
