import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withTransaction } from '../pool.js';
import type { PoolClient } from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SEED_FILES = [
  '001_agents.sql',
  '002_vault_secrets.sql',
] as const;

async function ensureSeedVersionsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS seed_versions (
      version     TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedSeeds(client: PoolClient): Promise<Set<string>> {
  await ensureSeedVersionsTable(client);
  const result = await client.query<{ version: string }>(
    'SELECT version FROM seed_versions ORDER BY version'
  );
  return new Set(result.rows.map((r) => r.version));
}

export async function runSeeds(): Promise<void> {
  console.log('[openclaw-db] Running seeds...');

  await withTransaction(async (client: PoolClient) => {
    const applied = await getAppliedSeeds(client);

    for (const file of SEED_FILES) {
      const version = file.replace('.sql', '');
      if (applied.has(version)) {
        console.log(`  [skip] ${version} already applied`);
        continue;
      }

      const sqlPath = join(__dirname, file);
      const sql = await readFile(sqlPath, 'utf-8');

      console.log(`  [seed] ${file}`);
      await client.query(sql);
      await client.query(
        'INSERT INTO seed_versions (version) VALUES ($1)',
        [version]
      );
      console.log(`  [done] ${file}`);
    }
  });

  console.log('[openclaw-db] Seeds complete.');
}
