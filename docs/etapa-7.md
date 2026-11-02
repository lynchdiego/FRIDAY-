# Etapa 7 — Pulido y despliegue

## Qué hay
- **Pantalla 6 — Ajustes:** costos de hoy y del mes (con barra contra el límite y desglose Claude / Voz), conexiones (Google, modelo, voz, avisos), actividad reciente (lo que FRIDAY propuso, confirmaste y ejecutó), exportar o borrar memoria, cerrar sesión. El botón redondo de arriba abre Ajustes; desde ahí, Habilidades y permisos.
- **App instalable (PWA):** ícono propio (tu Möbius), pantalla completa, color negro, funciona en Mac (Chrome/Safari) e iPhone (pantalla de inicio). Si no hay internet, muestra un aviso claro.
- **Listo para producción:** un solo contenedor con servidor + app, PostgreSQL, Caddy (HTTPS automático) y respaldos diarios. **Probado de verdad** con Docker: HTTPS, inicio de sesión, resumen, chat, respaldo y restauración.
- **Revisión de seguridad:** `docs/revision-seguridad.md`.
- **Guía para publicar:** `docs/despliegue.md`.

## Pruebas
`npm test` → 39. Más la prueba completa de producción con Docker.

## Errores encontrados y corregidos en esta etapa
- La regla que excluía la carpeta de datos también excluía los datos ficticios de la app: la construcción en el servidor habría fallado.
- El primer respaldo se hacía antes de que existieran las tablas (salía vacío): ahora espera 10 minutos.
- Memoria envenenada por correos: bloqueada.

## Costo
US$0 de API en esta etapa. Costos de operación: ver `docs/despliegue.md`.
