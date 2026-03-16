#!/usr/bin/env node
// CLI: pnpm --filter openclaw-db seed
import { runMigrations } from './migrations/index.js';
import { runSeeds } from './seeds/index.js';
import { closePool } from './pool.js';

runMigrations()
  .then(() => runSeeds())
  .then(() => closePool())
  .catch((err) => {
    console.error('[openclaw-db] Seed failed:', err);
    process.exit(1);
  });
