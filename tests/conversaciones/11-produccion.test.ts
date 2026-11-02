import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { harness } from './helpers';
import { loadConfig } from '../../apps/server/src/config';
import { buildApp } from '../../apps/server/src/app';

test('Encabezados de seguridad en todas las respuestas', async () => {
  const h = await harness();
  const r = await h.app.inject({ method: 'GET', url: '/api/health' });
  for (const k of ['content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy']) assert.ok(r.headers[k], k);
  assert.match(String(r.headers['content-security-policy']), /frame-ancestors 'none'/);
  assert.equal(r.headers['cache-control'], 'no-store', 'las respuestas de la API no se guardan en caché');
  await h.close();
});

test('El servidor entrega la app; rutas desconocidas → la app; API desconocida → 404', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'friday-web-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>FRIDAY</title>');
  writeFileSync(join(dir, 'assets', 'app-123.js'), 'console.log(1)');
  const h = await harness();
  const app = await buildApp(h.deps, { webDir: dir });
  assert.match((await app.inject({ method: 'GET', url: '/' })).body, /FRIDAY/);
  assert.match((await app.inject({ method: 'GET', url: '/ajustes' })).body, /FRIDAY/);
  const asset = await app.inject({ method: 'GET', url: '/assets/app-123.js' });
  assert.match(String(asset.headers['cache-control']), /immutable/);
  const api = await app.inject({ method: 'GET', url: '/api/no-existe' });
  assert.equal(api.statusCode, 404);
  assert.equal(api.json().error, 'No existe.');
  await app.close(); await h.close();
});

test('En producción no arranca con configuración insegura', () => {
  const base = { NODE_ENV: 'production', FRIDAY_PASSWORD: 'una-contrasena-larga-y-unica', ENCRYPTION_KEY: randomBytes(32).toString('base64'), PUBLIC_URL: 'https://friday.ejemplo.com', DATABASE_URL: 'postgres://u:p@db/friday', LLM_PROVIDER: 'mock' };
  assert.doesNotThrow(() => loadConfig(base));
  assert.throws(() => loadConfig({ ...base, FRIDAY_PASSWORD: 'corta-123' }), /14 caracteres/);
  assert.throws(() => loadConfig({ ...base, ENCRYPTION_KEY: undefined }), /ENCRYPTION_KEY/);
  assert.throws(() => loadConfig({ ...base, PUBLIC_URL: 'http://friday.ejemplo.com' }), /https/);
  assert.throws(() => loadConfig({ ...base, DATABASE_URL: undefined }), /DATABASE_URL/);
});

test('Ajustes: costos del mes separados por servicio', async () => {
  const h = await harness();
  await h.say('hola');
  await h.db.query(`INSERT INTO usage_log(user_id, conversation_id, model, input_tokens, output_tokens, cost_usd) VALUES (1,'voz','elevenlabs:eleven_flash_v2_5',250,0,0.0125)`);
  const cookie = await h.login();
  const s = (await h.app.inject({ method: 'GET', url: '/api/settings', headers: { cookie } })).json();
  const servicios = s.desglose.map((d: any) => d.servicio);
  assert.deepEqual(servicios, ['Claude', 'Voz']);
  assert.ok(s.costo.month >= 0.0125);
  await h.close();
});
