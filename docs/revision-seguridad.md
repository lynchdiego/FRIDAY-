# Revisión de seguridad — FRIDAY v1 (2026-11-02)

## Controles implementados (y probados)
| Riesgo | Control | Prueba |
|---|---|---|
| Que FRIDAY actúe sin permiso | Permisos desde una lista única; `ACTÚA` solo propone; token de un solo uso (hash en BD, 5 min, atado a la sesión), ejecución atómica | 03-accion-sin-confirmacion |
| Instrucciones escondidas en correos/eventos | `<datos_no_confiables>` con `<` y `>` escapados; detector de patrones; tras leer contenido externo, el «sí» por voz/texto no basta | 04-correo-malicioso |
| Memoria envenenada | No se guarda memoria en turnos con contenido externo; la memoria va marcada como datos | 07 (memoria) |
| Robo de la sesión / acceso | Contraseña única (≥14 en producción), comparación en tiempo constante, 5 intentos / 15 min, cookie `HttpOnly; Secure; SameSite=Strict` | 07, 11 |
| Falsificación de peticiones (CSRF) | Cookie `SameSite=Strict`; la API solo acepta JSON/audio (requiere preflight entre sitios); sin CORS | — |
| Llaves y tokens | Solo en `.env` del servidor; tokens de Google y llave VAPID cifrados (AES-256-GCM); nunca en el navegador ni en GitHub | 07, 08, 09 |
| Conexión con Google falsificada | `state` aleatorio de un solo uso, 10 min | 08 |
| Correos con destinatarios ocultos | Limpieza de encabezados (sin saltos de línea) | 08 |
| Gasto descontrolado | Límite diario → modo básico sin llamar al modelo; costos por llamada | 07 |
| Webhooks abiertos | Cerrados salvo `HOOKS_SECRET` (≥24 caracteres) | 10 |
| Navegador | CSP estricta, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy: no-referrer`, permisos solo de micrófono, HSTS | 11 |
| Registros | Sin parámetros de URL ni cookies en los logs | — |
| Servidor | Contenedor sin privilegios (usuario `node`); base de datos sin puerto público; solo 80/443 abiertos; `/api/health` no revela detalles | Prueba con Docker |
| Pérdida de datos | Respaldo diario de PostgreSQL (14 días); restauración probada | Prueba con Docker |
| Configuración insegura | En producción no arranca sin `ENCRYPTION_KEY`, `DATABASE_URL`, HTTPS y contraseña larga | 11 |

## Riesgos aceptados (piloto) y qué haríamos para NODO
1. **Una sola contraseña, sin segundo factor.** Para NODO: inicio de sesión con passkey o código por correo.
2. **El límite de intentos vive en memoria** (se reinicia si el servidor se reinicia). Para NODO: guardarlo en la base.
3. **Inyección de instrucciones:** ningún filtro es perfecto. La defensa real es que nada importante se ejecuta sin tu «sí» viendo el contenido exacto.
4. **App de Google sin verificar** (máximo 100 usuarios de por vida por proyecto). Para NODO: un proyecto por cliente o verificación formal.
5. **Dependencias:** `npm audit` reporta 3 alertas moderadas en `glob`/`minimatch` usadas por `@fastify/static` para listar los archivos de la app al arrancar (no reciben datos externos → no explotables aquí). El «arreglo» automático es bajar a una versión vieja; se descarta. Revisar en cada actualización.
6. **Notificaciones:** el texto viaja cifrado de punta a punta (Web Push), pero aparece en la pantalla bloqueada. Si te preocupa, en iPhone: Ajustes → Notificaciones → FRIDAY → Mostrar vistas previas → «Si está desbloqueado».
