# Rediseño visual — Etapa 1: Exploración

*2026-11-02. El cerebro, la memoria, las herramientas, los permisos y las confirmaciones no cambian; solo la "cara". Se mantiene el nombre FRIDAY (el del repositorio).*

## Lo que tomé de las referencias (`referencia/estilo/`)
- **Cielo con el cubo:** azul profundo de lápiz de color, nubes crema con luz dorada, mar y montañas lejanas; saludo serif grande arriba, personaje al centro, píldora de papel abajo.
- **Diez cajas en perspectiva:** trazo de grafito seguro que se pasa un poco en las esquinas, líneas de construcción hacia puntos de fuga, achurado cruzado en las sombras.
- **Dos personajes:** ojos grandes y expresivos, cejas que cuentan la emoción, trazo suelto y color pintado.

## Diseño propuesto del personaje
Un **cubo de papel crema** visto en tres cuartos (tres caras), con:
- **Contorno de grafito que "hierve"** (se redibuja 8 veces por segundo, como animación a mano) y **diagonales de construcción** tenues en las caras, en lugar de un poliedro complejo: más simple y más legible.
- **Ojos grandes de tinta** con esclerótica de papel, pupila que se dilata, dos brillos y **párpados de papel**; **cejas de tinta** que llevan la emoción.
- **Boca solo al hablar** (una mancha de tinta que se abre con la voz).
- **Anillo de órbita a lápiz** con una cuenta que lo recorre; gira, vibra con la voz y se acelera al pensar.
- **"Pestañas" de papel** que se despliegan como manos para sostener la tarjeta de «Necesita tu sí» (en el prototipo la tarjeta aparece sola; las pestañas van en la etapa 2).

## Las tres direcciones

### A · Todo dibujado con código (procedural)
Personaje y mundo generados por shaders: cielo, nubes, mar, montañas, luz por hora, achurado y grano de papel.
- **Prototipo funcionando:** ver el enlace del prototipo y `prototipos/exploracion/`.
- **Costo de recursos:** US$0.
- **A favor:** control total de las 8 animaciones, luz por hora real sin límites, descarga mínima, cero licencias.
- **Riesgo:** el **cielo** se ve "generado" (bandas de nubes con textura de ruido); llegar a la riqueza pintada de la referencia requiere nubes volumétricas por raymarching, pesadas para iPhone (habría que bajar a capas 2D en calidad baja).

### B · Ilustración generada con IA (Higgsfield)
Cielo pintado en capas (fondo, nubes lejanas, nubes cercanas, mar/montañas) para 4 horas del día con mapas de profundidad; texturas del personaje pintadas; opcional: modelo 3D desde imagen.
- **A favor:** la riqueza pictórica de la referencia desde el primer día.
- **En contra:**
  - Para un cubo, convertir imagen a 3D no aporta (es geometría trivial y sin rig facial); ojos, cejas y boca se harían con código igual.
  - Las nubes pintadas son planas: solo se desplazan con paralaje, no cambian de forma ni de luz de verdad.
  - Mantener 4 horas del día coherentes cuesta muchas generaciones; descarga de 5–15 MB.
- **Costo:** tu cuenta tiene **0 créditos (plan gratuito)**: requiere comprar un plan. Calculo 40–80 generaciones con iteraciones. Confirmo precio y **licencia de uso comercial** del plan antes de gastar.

### C · Mixta — **recomendada**
- **Personaje procedural** (como el prototipo): todas las animaciones con resortes, ojos vivos y contorno que hierve.
- **Mundo pintado + vivo:** 1 o 2 pinturas base del cielo (día y noche) en capas, **animadas por shaders**: deriva y deformación lenta de nubes, reiluminación por hora (amanecer, mediodía, atardecer, noche) por gradación de color, rayos de sol, polvo a contraluz, pájaros dibujados, reflejos en el mar, estrellas.
- Un **postproceso común** (grano de papel, contorno de grafito, viñeta, desenfoque de profundidad suave) une ambos mundos.
- **Costo:** 15–25 generaciones (pocas imágenes, bien elegidas). Si prefieres no gastar, se puede empezar 100 % procedural y cambiar el fondo después sin tocar al personaje.
- **A favor:** el mejor equilibrio entre belleza, control y rendimiento en iPhone.
- **Riesgo:** que la pintura y el personaje no "casen"; se mitiga con la paleta y el postproceso compartidos.

## Rendimiento (las tres)
Niveles automáticos alto/medio/bajo; en calidad baja el cielo pasa a capas 2D sin efectos caros y el personaje conserva toda su animación. `prefers-reduced-motion`: cámara quieta, sin hervor de líneas, transiciones cortas.

## API del personaje (igual en las tres)
`presencia.estado('calma'|'escucha'|'piensa'|'habla'|'contento'|'confirma'|'error'|'duerme')`, `presencia.nivel(0..1)` para el audio, `presencia.entregar(tarjeta)`. El cerebro no conoce detalles visuales.

## Esfuerzo
Es un rediseño grande (etapas 2–6). Las etapas 2 (personaje) y 3 (mundo) son las más largas.
