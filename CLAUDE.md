# FRIDAY — contexto para sesiones futuras

Asistente ejecutivo personal de Diego Lynch (piloto; luego paquete premium de NODO). Prompt original: `docs/prompt-original.md`. Diego no programa: explicar en español sencillo, probar cada etapa, no avanzar sin su aprobación, cuidar el presupuesto.

## Estado de etapas
1. Plan — **hecho, pendiente de aprobación** (`docs/plan-etapa-1.md`).
2–7. Sin empezar.

## Decisiones tomadas
- TypeScript, Fastify, Postgres+Drizzle, Vite+React PWA, Three.js. SDK de Anthropic con ciclo de herramientas propio (no Agent SDK).
- Modelos por variable de entorno: Sonnet 5.5 por defecto, Opus 5.5 para tareas pesadas.
- Permisos: lista única en `packages/shared/skills.ts`; ACTÚA exige token de un solo uso validado por el servidor.

## Pendientes
- Decisión de Diego sobre Google Testing (caduca a 7 días) vs. producción sin verificar.
- Verificar precios en páginas oficiales antes de la etapa 5.
- Diseño: ver sección 5 del prompt original (colores, vidrio, Inter Tight, Möbius). Referencia visual en `referencia/`.
