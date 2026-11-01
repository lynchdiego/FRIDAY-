# Etapa 3 — Cerebro por texto (cómo probarla)

## Qué hay
- Conversación por texto con FRIDAY (personalidad en `apps/server/prompts/friday.md`).
- Memoria en base de datos (perfil, personas, proyectos, pendientes, recordatorios, historial).
- Permisos reales: Lee / Propone / Actúa con tu sí / Nunca. Nada que actúe en tu nombre sale sin tu confirmación.
- Registro de auditoría (qué propuso, qué confirmaste, qué se ejecutó) y de costos, con límite diario.
- Pantalla de conversación (3) y confirmación real (4). Inicio de sesión con contraseña.
- Google todavía es simulado (agenda y correos ficticios, incluido un correo con una trampa).

## Pruebas automáticas (15)
`npm test` — todas pasan con el Claude simulado:
preguntas normales, información incompleta, acción sin confirmación (token falso, vencido, reutilizado, sin sesión), "sí"/"no" escrito, correo con instrucciones maliciosas, falla de Google, falla de Claude, pregunta sin respuesta, inicio de sesión, permisos, costos y límite, cifrado.

## Prueba con Claude real (pendiente, ~US$0.50 o menos)
Cuando tengas la llave: `ANTHROPIC_API_KEY=... npm run test:live`. Corre las mismas pruebas con el modelo real.

## Probarla tú en tu Mac (opcional, ~15 min la primera vez)
1. Instala Node.js 22 desde nodejs.org.
2. Descarga el repositorio (GitHub → botón "Code" → "Download ZIP" de la rama `claude/friday-personal-assistant-4wqsqe`) y descomprímelo.
3. Abre Terminal en esa carpeta y escribe: `npm install`
4. Duplica `.env.example`, renómbralo `.env` y escribe una contraseña en `FRIDAY_PASSWORD=`.
5. En Terminal: `npm run dev:server`. En otra pestaña: `npm run dev:web`.
6. Abre http://localhost:5173, entra con tu contraseña y prueba:
   - "¿Qué tengo hoy?"
   - "Agenda una reunión con Julio" (te preguntará el día)
   - "Manda un correo a julio@ejemplo.com con la cotización" → se abre la confirmación; prueba Editar, Cancelar y Enviar.
   - "Revisa el correo de la factura de Renta de Equipo" (trae una trampa escondida)
Sin llave de Claude usa el Claude simulado (respuestas básicas, pero todo el flujo es real).

## Costo
- Construcción: US$0 de API.
- Uso real estimado: ~US$0.005–0.02 por mensaje con Sonnet 5.5 (con caché). Límite diario: US$2.
