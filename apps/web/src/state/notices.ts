import { useEffect, useState } from 'react';
import { chat, useChat } from './chat';

/**
 * Avisos: notificaciones push (con la app cerrada) y avisos dentro de la app (con la app abierta).
 * iPhone: las notificaciones push solo funcionan con FRIDAY agregada a la pantalla de inicio (iOS 16.4+).
 */
export type PushStatus = 'sin-soporte' | 'instalar-primero' | 'bloqueado' | 'apagado' | 'activo';

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try { return await navigator.serviceWorker.register('sw.js'); } catch { return null; }
}

export async function pushStatus(): Promise<PushStatus> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window))
    return isIOS() && !standalone() ? 'instalar-primero' : 'sin-soporte';
  if (Notification.permission === 'denied') return 'bloqueado';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'activo' : 'apagado';
}

const b64ToBytes = (b64: string) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

/** Pide permiso (debe llamarse desde un toque) y suscribe este dispositivo. */
export async function enablePush(): Promise<PushStatus> {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'bloqueado' : 'apagado';
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await registerServiceWorker());
  if (!reg) return 'sin-soporte';
  await navigator.serviceWorker.ready;
  const { publicKey } = await fetch('/api/push/key').then((r) => r.json());
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
  const device = isIOS() ? 'iPhone' : /Mac/.test(navigator.userAgent) ? 'Mac' : 'Otro';
  await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...sub.toJSON(), device }) });
  return 'activo';
}

export async function disablePush(): Promise<PushStatus> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch('/api/push/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
    await sub.unsubscribe();
  }
  return 'apagado';
}

export async function testPush() {
  return fetch('/api/push/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then((r) => r.json());
}

/** Con la app abierta: revisa avisos nuevos cada minuto y los muestra. */
export function useInAppNotices() {
  const { mode, authed } = useChat();
  useEffect(() => {
    if (mode !== 'server' || !authed) return;
    const check = async () => {
      try {
        const list: { id: number; title: string; body: string }[] = await fetch('/api/notifications').then((r) => (r.ok ? r.json() : []));
        if (!list.length) return;
        const latest = list[0];
        chat.notify(`${latest.title}: ${latest.body}`);
        await fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: list.map((n) => n.id) }) });
      } catch { /* sin conexión: se intenta en el siguiente minuto */ }
    };
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [mode, authed]);
}

export function usePushStatus() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  useEffect(() => { pushStatus().then(setStatus).catch(() => setStatus('sin-soporte')); }, []);
  return [status, setStatus] as const;
}

export const PUSH_LABEL: Record<PushStatus, string> = {
  'sin-soporte': 'Este navegador no admite notificaciones',
  'instalar-primero': 'En iPhone: primero agrega FRIDAY a tu pantalla de inicio',
  bloqueado: 'Bloqueadas en los ajustes del navegador',
  apagado: 'Desactivadas en este dispositivo',
  activo: 'Activas en este dispositivo',
};
