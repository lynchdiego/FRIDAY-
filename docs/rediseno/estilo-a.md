# Sistema visual — Estilo A «Cian táctico» (elegido 2026-11-02)

Inspirado en el espíritu de los hologramas de JARVIS, sin copiar diseños de Marvel.

## Principios
- **Cada elemento muestra un dato real** (eventos, correos, pendientes, estado). Nada decorativo que finja información.
- Cian = luz normal · **ámbar = necesita tu sí** · **rojo = algo falló**.
- Fondo: un taller original **fuera de foco** (como en cine), con paralaje leve.

## Piezas
- `apps/web/src/hud/HudCore.ts` — núcleo de luz en 2D: anillos segmentados, marcas de minutos, **reloj del día con tus eventos reales** y aguja de la hora, espectro de voz (escucha/habla), barrido (piensa), color ámbar/rojo por alerta, polvo de luz. Resplandor: copia a ¼ de resolución desenfocada por CSS (barato). Calidad automática (baja la resolución si no hay ~50 fps). `prefers-reduced-motion`: movimiento al 20 %.
- `HudCoreView.tsx` — lo conecta con `presence` (estado), `liveLevel` (voz real), `chat.action` (ámbar) y `alertFlash` (rojo).
- `Workshop.tsx` — fondo del taller dibujado una vez a media resolución. **Intercambiable** por una foto generada (Higgsfield) sin tocar nada más.
- `screens/Home.tsx` — Inicio único: Mac = saludo | núcleo | panel inclinado; iPhone = apilado con barra fija abajo.
- Estilos: `styles/base.css` (tokens, materiales HUD con esquinas cortadas) y `styles/screens.css`.

## Tokens
Fondo `#02070C` · texto `#DFF7FF` · secundario `#6A93A3` · cian `#7FE7FF` · ámbar `#FFB547` · rojo `#FF6B6B` · líneas `rgba(127,231,255,.18)`.
Tipografía: **Barlow Condensed** 300 (títulos, mayúsculas) · **IBM Plex Mono** (etiquetas y datos) · **IBM Plex Sans** (textos largos).

## Pendiente opcional
- Foto realista original del taller con IA (requiere créditos de Higgsfield; confirmar precio y uso comercial).
- Segunda ronda de pulido de Conversación y Ajustes con referencias propias.
