# Etapa 2 — Interfaz y Möbius (cómo probarla)

## Qué hay
- **Inicio** (panel compacto ~420×660), **Resumen del día** (pantalla amplia) y **Confirmación** (vidrio difuso).
- La Möbius en tiempo real con sus cuatro estados: en calma, te escucha, pensando y hablando.
- Todo usa **datos ficticios**. Nada se conecta a Google ni a Claude todavía, y nada se envía.

## Cómo probarla
1. Abre la vista previa (enlace privado de claude.ai) en tu Mac y en tu iPhone.
2. En el **Simulador** (abajo a la derecha; en el teléfono, arriba):
   - "Pantalla" cambia entre Inicio, Resumen y Confirmación.
   - "Estado" cambia la Möbius. Fíjate en que las transiciones sean suaves.
   - "Volumen": quita "Voz simulada" y mueve la barra para ver cómo reacciona la cinta al volumen (en "Te escucha" y "Hablando").
3. Mantén presionado **Hablar** (o ⌥ + espacio en la Mac): la cinta escucha; al soltar piensa, luego habla y vuelve a la calma.
4. Toca "Correo" en la tarjeta del Inicio para ver la confirmación. Prueba Editar y Cancelar.
5. En la Mac: Ajustes del Sistema → Accesibilidad → Pantalla → "Reducir movimiento" y verás la cinta más quieta.

## Para correrla en local (opcional)
Requiere Node 22: `npm install` y luego `npm run dev:web`.

## Costo
US$0 de API (no se usa Claude ni voz en esta etapa).
