# Etapa 6 — Recordatorios y resumen de las 7:30 (cómo probarla)

## Qué hay
- **Recordatorios que te avisan:** «Recuérdame mañana a las 9 llamar al proveedor» → a esa hora llega el aviso (una sola vez).
- **Resumen del día a las 7:30:** «Tu día: tienes 4 compromisos. 3 correos sin leer. Prioridad: …». Se envía una vez al día, entre las 7:30 y el mediodía (si el servidor estuvo apagado toda la mañana, no te llega en la tarde). Tocar el aviso abre el Resumen.
- **Dos formas de recibir avisos:**
  - **Notificación del sistema** (con FRIDAY cerrada): actívala en Habilidades y permisos → Avisos → Activar. Mac: Chrome o Safari. **iPhone: primero hay que agregar FRIDAY a la pantalla de inicio** (etapa 7); es una regla de Apple.
  - **Dentro de la app:** si FRIDAY está abierta, el aviso aparece arriba. Nada se pierde: los avisos quedan guardados hasta que los veas.
- **Listo para n8n:** con `SCHEDULER=off` el servidor no programa nada y n8n llama `POST /api/hooks/briefing` y `/api/hooks/reminders` con `Authorization: Bearer <HOOKS_SECRET>`. Sin esa clave, los webhooks están cerrados.

## Seguridad
- Notificaciones solo a direcciones seguras (https). Los dispositivos que desinstalaron FRIDAY se eliminan solos.
- La llave privada de avisos se guarda cifrada.

## Pruebas
`npm test` → 34 (6 nuevas: recordatorio a la hora y sin repetirse, resumen 7:30 una vez al día, no en la tarde, limpieza de dispositivos, webhooks con clave, llave estable). Se probó en navegador el aviso dentro de la app. La notificación push real no se puede probar aquí (el navegador de pruebas no tiene servicio de notificaciones): la probamos en tu Mac/iPhone al publicar.

## Costo
US$0. El resumen con Claude real cuesta ≈ US$0.003 al día (prioridad elegida por el modelo).
