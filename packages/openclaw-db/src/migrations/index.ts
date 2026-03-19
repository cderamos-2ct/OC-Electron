import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, withTransaction } from '../pool.js';
import type { PoolClient } from 'pg';

// In packaged Electron app, __dirname resolves inside the asar bundle
// which doesn't contain SQL files. Use process.resourcesPath to find them.
const __dirname = typeof process !== 'undefined' && 'resourcesPath' in process
  ? join((process as { resourcesPath: string }).resourcesPath, 'packages', 'openclaw-db', 'migrations')
  : dirname(fileURLToPath(import.meta.url));

async function ensureMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(client: PoolClient): Promise<Set<string>> {
  await ensureMigrationsTable(client);
  const result = await client.query<{ version: string }>(
    'SELECT version FROM schema_migrations ORDER BY version'
  );
  return new Set(result.rows.map((r) => r.version));
}

const MIGRATION_FILES = [
  '001_initial_schema.sql',
  '002_api_worker_tables.sql',
  '003_vault_encryption.sql',
  '004_vault_runtime_tables.sql',
] as const;

export async function runMigrations(): Promise<void> {
  console.log('[openclaw-db] Running migrations...');

  await withTransaction(async (client) => {
    const applied = await getAppliedMigrations(client);

    for (const file of MIGRATION_FILES) {
      const version = file.replace('.sql', '');
      if (applied.has(version)) {
        console.log(`  [skip] ${version} already applied`);
        continue;
      }

      const sqlPath = join(__dirname, file);
      const sql = await readFile(sqlPath, 'utf-8');

      console.log(`  [apply] ${version}`);
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (version) VALUES ($1)',
        [version]
      );
      console.log(`  [done] ${version}`);
    }
  });

  console.log('[openclaw-db] Migrations complete.');
}
