import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** Comparación en tiempo constante (evita adivinar contraseñas midiendo tiempos). */
export function safeEqual(a: string, b: string) {
  const x = createHash('sha256').update(a).digest();
  const y = createHash('sha256').update(b).digest();
  return timingSafeEqual(x, y);
}

/** Cifrado AES-256-GCM para guardar tokens de Google en la base de datos. */
export function encrypt(plain: string, keyB64: string) {
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY debe ser de 32 bytes en base64');
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), data.toString('base64')].join('.');
}

export function decrypt(blob: string, keyB64: string) {
  const [v, iv, tag, data] = blob.split('.');
  if (v !== 'v1') throw new Error('Formato de cifrado desconocido');
  const d = createDecipheriv('aes-256-gcm', Buffer.from(keyB64, 'base64'), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
}
