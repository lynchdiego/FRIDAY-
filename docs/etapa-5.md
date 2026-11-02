# Etapa 5 — Voz (cómo probarla)

## Qué hay
- **Hablarle:** mantén presionado **Hablar** (o **⌥ + espacio** en la Mac) mientras hablas; al soltar, FRIDAY transcribe y responde. Un toque corto no hace nada (evita activaciones por accidente).
- **Te responde con voz** cuando le hablaste (2 o 3 frases; el detalle queda en pantalla). Si escribiste, responde solo por texto.
- **La Möbius sigue el volumen real:** de tu micrófono mientras hablas y de la voz de FRIDAY mientras responde (medido: el nivel real llega a la cinta en ~95% de los cuadros).
- **Silencio** (botón redondo con bocina): apaga la voz de FRIDAY en ese dispositivo; todo sigue por texto.
- **Leer en voz alta** (pantalla Resumen): lee el saludo, el resumen y la prioridad del día.
- **«Sí, envíalo» por voz** confirma acciones (salvo las preparadas tras leer un correo: esas solo con el botón).

## Dos modos
| | Sin llave de ElevenLabs (hoy) | Con ElevenLabs |
|---|---|---|
| Entender tu voz | Reconocimiento del navegador (Chrome y Safari) | Scribe v2 (servidor) |
| Voz de FRIDAY | Voz del navegador (la cinta usa un movimiento simulado) | Voz original, por partes mientras se genera; la cinta sigue el audio real |
| Costo | Gratis | Ver abajo |

La llave de ElevenLabs vive solo en el servidor. El navegador recibe audio, nunca la llave.

## Si algo falla
- Sin permiso de micrófono → te lo dice y pone el cursor en el campo de texto.
- ElevenLabs no responde → intenta con la voz del navegador; si tampoco, la respuesta queda en pantalla.
- No se entendió el audio → «Escríbemelo, por favor».

## Probarla en tu Mac
Igual que en `docs/etapa-3.md` (servidor + app). En Chrome o Safari, la primera vez el navegador te pedirá permiso para el micrófono.

## Conectar ElevenLabs (al final, según el plan)
1. Crea una cuenta en elevenlabs.io y elige el plan más bajo que incluya API (confirmamos precios ese día).
2. **Voice Design** (Diseño de voz): describe la voz, p. ej. *«Voz femenina en español de México, calmada, cálida, segura y elegante; ritmo pausado; tono de asistente ejecutiva»*. Genera opciones, elige una y guárdala. **No clones la voz de ninguna persona ni personaje.**
3. Copia el **Voice ID** de esa voz y crea una **API key** (Profile → API Keys). No los pegues en el chat.
4. En `.env`: `ELEVENLABS_API_KEY=...` y `ELEVENLABS_VOICE_ID=...`. Reinicia el servidor.
5. Prueba: mantén Hablar y di «¿Qué tengo hoy?».

## Costos (estimados; no pude abrir la página oficial de ElevenLabs desde el servidor)
- Voz de FRIDAY (Flash v2.5): ≈ US$0.04–0.05 por 1,000 caracteres → una respuesta típica (≈250 caracteres) ≈ US$0.01.
- Entender tu voz (Scribe v2): ≈ US$0.22 por hora → 10 segundos ≈ US$0.0006.
- Uso diario fuerte (30 respuestas habladas) ≈ US$0.30/día ≈ US$9/mes. Se registra en los costos de FRIDAY junto con Claude.
- Construcción de esta etapa: US$0.

## Pruebas
`npm test` → 28 (5 nuevas de voz: llave solo en servidor, audio por partes, enlace de un solo uso, costo registrado, transcripción en español, fallas). Además se probó de punta a punta en navegador con micrófono simulado y un ElevenLabs simulado.
