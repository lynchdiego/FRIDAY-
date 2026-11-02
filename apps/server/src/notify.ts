import webpush from 'web-push';
import type { Db } from './db';
import type { Config } from './config';
import { encrypt, decrypt } from './security/crypto';

/**
 * Avisos de FRIDAY: se guardan en la base (la app los muestra al abrirse) y, si Diego
 * activó las notificaciones en ese dispositivo, se envían como notificación push
 * (Mac y iPhone con la app instalada en la pantalla de inicio).
 */
export interface PushSender { send(sub: { endpoint: string; keys: any }, payload: string): Promise<void> }
export interface Notice { kind: 'recordatorio' | 'resumen' | 'aviso'; title: string; body: string; url?: string }

/** Llaves VAPID (identifican a FRIDAY ante Apple/Google). Se generan una vez y se guardan (cifradas si hay ENCRYPTION_KEY). */
export async function vapidKeys(db: Db, c: Config) {
  const r = await db.query<any>(`SELECT value FROM settings WHERE user_id=1 AND key='vapid'`);
  if (r.rows[0]) {
    const v = r.rows[0].value;
    return { publicKey: v.publicKey as string, privateKey: v.enc && c.ENCRYPTION_KEY ? decrypt(v.privateKey, c.ENCRYPTION_KEY) : (v.privateKey as string) };
  }
  const k = webpush.generateVAPIDKeys();
  const stored = { publicKey: k.publicKey, privateKey: c.ENCRYPTION_KEY ? encrypt(k.privateKey, c.ENCRYPTION_KEY) : k.privateKey, enc: !!c.ENCRYPTION_KEY };
  await db.query(`INSERT INTO settings(user_id, key, value) VALUES (1,'vapid',$1) ON CONFLICT (user_id, key) DO NOTHING`, [JSON.stringify(stored)]);
  return k;
}

export function webPushSender(db: Db, c: Config): PushSender {
  return {
    async send(sub, payload) {
      const k = await vapidKeys(db, c);
      await webpush.sendNotification(sub, payload, { vapidDetails: { subject: c.VAPID_SUBJECT, publicKey: k.publicKey, privateKey: k.privateKey }, TTL: 3600 });
    },
  };
}

/** Guarda el aviso y lo envía a todos los dispositivos suscritos. Devuelve cuántos lo recibieron. */
export async function notify(db: Db, sender: PushSender, userId: number, n: Notice) {
  const url = n.url ?? '/';
  const r = await db.query<{ id: number }>('INSERT INTO notifications(user_id, kind, title, body, url) VALUES ($1,$2,$3,$4,$5) RETURNING id', [userId, n.kind, n.title, n.body, url]);
  const subs = (await db.query<any>('SELECT endpoint, keys FROM push_subscriptions WHERE user_id=$1', [userId])).rows;
  let delivered = 0;
  const payload = JSON.stringify({ id: r.rows[0].id, title: n.title, body: n.body, url });
  for (const s of subs) {
    try { await sender.send({ endpoint: s.endpoint, keys: s.keys }, payload); delivered++; }
    catch (err: any) {
      // 404/410: el dispositivo ya no acepta avisos (se desinstaló o revocó el permiso).
      if (err?.statusCode === 404 || err?.statusCode === 410) await db.query('DELETE FROM push_subscriptions WHERE endpoint=$1', [s.endpoint]);
    }
  }
  return delivered;
}
