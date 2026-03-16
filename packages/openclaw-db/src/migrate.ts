#!/usr/bin/env node
// CLI: pnpm --filter openclaw-db migrate
import { runMigrations } from './migrations/index.js';
import { closePool } from './pool.js';

runMigrations()
  .then(() => closePool())
  .catch((err) => {
    console.error('[openclaw-db] Migration failed:', err);
    process.exit(1);
  });
