/**
 * Shared Postgres pool for the Electron main process.
 * Delegates to the canonical openclaw-db pool so there is a single pool
 * instance across the process instead of a competing one.
 */
import { getPool, closePool } from 'openclaw-db';

export function getMainPool() {
  return getPool();
}

export async function closeMainPool(): Promise<void> {
  await closePool();
}
