# Etapa 4 — Google (cómo probarla)

## Qué hay
- **Google real listo** (Calendar, Gmail y Tasks) con permisos mínimos y tokens cifrados. Se activa con `INTEGRATIONS=google` cuando sigas `docs/google-setup.md`. Mientras tanto, todo funciona con datos ficticios.
- **Pendientes en Google Tasks** (aparecen en tu iPhone y en Gmail).
- **Resumen del día real:** Inicio y Resumen muestran tu agenda de hoy, correos sin leer, pendientes, recordatorios y **una sola prioridad**. Sin Claude real, la prioridad sale por regla (lo que vence hoy > correo sin leer > siguiente evento). Con Claude, la elige el modelo una vez al día (≈ US$0.003).
- **Pantalla 5 — Habilidades y permisos:** la lista real de lo que FRIDAY puede hacer, con su permiso, y las conexiones (Google, Claude, voz). Botón para conectar o desconectar Google.
- Los botones Agenda, Correo y Pendientes del Resumen ya le preguntan a FRIDAY.

## Seguridad agregada
- Conexión con Google protegida con un código de un solo uso de 10 minutos (anti-falsificación).
- Correos salientes: imposible inyectar destinatarios ocultos (Bcc) desde el texto.
- Los correos HTML se limpian, pero los comentarios escondidos se conservan para que el detector de trampas los vea.
- Si Google retira el acceso, FRIDAY lo dice claramente y sigue en modo texto.

## Pruebas
`npm test` → 23 pruebas (15 de la etapa 3 + 8 nuevas de Google y resumen). Todas pasan.

## Costo
Construcción: US$0 de API. Google: gratis.
