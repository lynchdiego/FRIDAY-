# FRIDAY — contexto para sesiones futuras

Asistente ejecutivo personal de Diego Lynch (piloto; luego paquete premium de NODO). Prompt original: `docs/prompt-original.md`. Diego no programa: explicar en español sencillo, probar cada etapa, no avanzar sin su aprobación, cuidar el presupuesto.

## Estado de etapas
1. Plan — **aprobado** (`docs/plan-etapa-1.md`).
2. Interfaz y Möbius — **aprobado** (2026-11-01; Diego pidió estados más distintos: ajustados en `TARGETS` de `Mobius.ts`) (`docs/etapa-2.md`). Pantallas 1, 2 y 4 con datos ficticios, Möbius en tiempo real con 4 estados y simulador.
3–7. Sin empezar.

## Decisiones tomadas
- TypeScript, Fastify, Postgres+Drizzle, Vite+React PWA, Three.js. SDK de Anthropic con ciclo de herramientas propio (no Agent SDK).
- Modelos por variable de entorno: Sonnet 5.5 por defecto, Opus 5.5 para tareas pesadas.
- Permisos: lista única en `packages/shared/skills.ts`; ACTÚA exige token de un solo uso validado por el servidor.

- Google: app "En producción sin verificar" (decidido por Diego 2026-11-01); evita la caducidad de 7 días de Testing. Verificación formal después, para NODO.
- Límite de gasto diario en Claude: US$2 (piloto).
- Web: `apps/web` (Vite 8 + React 19 + three 0.187). Möbius en `apps/web/src/mobius/` (`Mobius.ts` motor, `shaders.ts`, `presence.ts` estado global calma/escucha/piensa/habla + nivel de audio). En etapa 5 `presence.set` recibirá el nivel real del analizador de audio.
- Postproceso: UnrealBloom + pase final propio (aberración, viñeta, grano, fusión con #0A0A0A). Calidad automática en 3 niveles; `prefers-reduced-motion` reduce movimiento.
- Ojo: el minificador de CSS de Vite fusiona `-webkit-backdrop-filter` y `backdrop-filter`; escribir solo `backdrop-filter` en el código.
- Vista previa privada: artefacto de claude.ai (slug fb6c693a-1a3b-4874-895d-65ab208a7545), publicado desde `apps/web/dist`.

## Pendientes
- Verificar precios en páginas oficiales antes de la etapa 5.
- Diseño: ver sección 5 del prompt original (colores, vidrio, Inter Tight, Möbius). Referencia visual en `referencia/`.
