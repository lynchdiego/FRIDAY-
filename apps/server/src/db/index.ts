import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Interfaz mínima común a PGlite (desarrollo/pruebas) y PostgreSQL real (producción). */
export interface Db {
  query<T = any>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
  close(): Promise<void>;
}

const here = dirname(fileURLToPath(import.meta.url));

export async function openDb(opts: { url?: string; pgliteDir?: string; memory?: boolean }): Promise<Db> {
  let db: Db;
  if (opts.url) {
    const pg = await import('pg');
    const pool = new pg.default.Pool({ connectionString: opts.url });
    db = {
      query: (sql, params) => pool.query(sql, params as any[]) as any,
      exec: (sql) => pool.query(sql),
      close: () => pool.end(),
    };
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    if (!opts.memory && opts.pgliteDir) mkdirSync(opts.pgliteDir, { recursive: true });
    const lite = new PGlite(opts.memory ? undefined : opts.pgliteDir);
    db = {
      query: (sql, params) => lite.query(sql, params as any[]) as any,
      exec: (sql) => lite.exec(sql),
      close: () => lite.close(),
    };
  }
  await migrate(db);
  return db;
}

async function migrate(db: Db) {
  await db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, at TIMESTAMPTZ DEFAULT now())');
  const dir = join(here, 'migrations');
  const done = new Set((await db.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(f)) continue;
    await db.exec(readFileSync(join(dir, f), 'utf8'));
    await db.query('INSERT INTO schema_migrations(name) VALUES ($1)', [f]);
  }
  // Piloto: un solo usuario (id 1). Diseñado para varios.
  await db.query(`INSERT INTO users(id, name) VALUES (1, 'Diego') ON CONFLICT (id) DO NOTHING`);
}
