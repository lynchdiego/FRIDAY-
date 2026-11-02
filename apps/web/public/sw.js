// FRIDAY — service worker. Recibe los avisos (recordatorios y resumen del día) aunque la app esté cerrada.
// En la etapa 7 se agrega aquí lo necesario para instalar la app (PWA).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

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
