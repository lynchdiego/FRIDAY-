// FRIDAY — service worker. Recibe los avisos (recordatorios y resumen del día) aunque la app esté cerrada.
// También guarda la "cáscara" de la app para abrir rápido y mostrar un aviso claro si no hay internet.
// Nunca guarda datos personales: /api/* siempre va a la red.
const SHELL = 'friday-shell-v1';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(['./', 'manifest.webmanifest', 'icon-192.png'])).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== SHELL) await caches.delete(k);
  await self.clients.claim();
})()));

const OFFLINE = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FRIDAY</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0A0A0A;color:#F2F1EE;font-family:'Inter Tight',system-ui,sans-serif;text-align:center;padding:24px">
<div><p style="font-size:28px;font-weight:500;letter-spacing:-.04em;margin:0 0 8px">Sin conexión</p>
<p style="color:#A3A19C;margin:0">FRIDAY necesita internet. Tu agenda y correo siguen en Google.</p></div></body></html>`;

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    // Página: primero la red (siempre la versión más nueva); si no hay, la guardada; si no, el aviso.
    event.respondWith(fetch(req).then((res) => { caches.open(SHELL).then((c) => c.put('./', res.clone())); return res; })
      .catch(async () => (await caches.match('./')) || new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
    return;
  }
  if (url.pathname.includes('/assets/')) {
    // Archivos con huella (nombre cambia en cada versión): se guardan para abrir rápido.
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); }
      return res;
    })));
  }
});

self.addEventListener('push', (event) => {
  let data = { title: 'FRIDAY', body: '', url: '/' };
  try { data = { ...data, ...event.data.json() }; } catch { /* aviso sin datos */ }
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    tag: data.id ? `friday-${data.id}` : undefined,
    data: { url: data.url },
    icon: 'icon-192.png',
    badge: 'icon-192.png',
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = all.find((c) => c.url.startsWith(self.location.origin));
    if (open) { await open.focus(); open.navigate?.(url); return; }
    await self.clients.openWindow(url);
  })());
});
