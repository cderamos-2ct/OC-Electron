// One-time migration from plaintext api-credentials.json → safeStorage-encrypted blob.
// TRANSACTIONAL: backup → encrypt → verify decryption → delete plaintext.
// Rolls back to backup on any failure.

import { readFileSync, writeFileSync, renameSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { SHELL_CONFIG_DIR_NAME } from '../../shared/constants.js';
import {
  setCredential,
  getCredential,
  hasCredentialStore,
} from '../security/secure-credentials-store.js';

const CONFIG_DIR = join(homedir(), SHELL_CONFIG_DIR_NAME);
const PLAINTEXT_FILE = join(CONFIG_DIR, 'api-credentials.json');
const BACKUP_FILE = join(CONFIG_DIR, 'api-credentials.json.bak');
const MIGRATION_DONE_MARKER = join(CONFIG_DIR, '.credentials-migrated');

// Mapping from legacy JSON paths to safeStorage keys
// Extend this as new credential types are added.
interface LegacyCredentials {
  github?: { personal_access_token?: string };
  fireflies?: { api_key?: string };
  [key: string]: unknown;
}

const LEGACY_TO_KEY_MAP: Array<{
  key: string;
  extract: (creds: LegacyCredentials) => string | undefined;
}> = [
  {
    key: 'openclaw/api-keys/github-pat',
    extract: (c) => c.github?.personal_access_token,
  },
  {
    key: 'openclaw/api-keys/fireflies',
    extract: (c) => c.fireflies?.api_key,
  },
];

export interface MigrationResult {
  migrated: boolean;
  skipped: boolean;
  keysWritten: string[];
  error?: string;
}

/**
 * Run the one-time plaintext → safeStorage migration.
 *
 * Safe to call on every startup — it's a no-op if already done or if no
 * plaintext file exists.
 */
export async function runCredentialMigration(): Promise<MigrationResult> {
  // Already migrated
  if (existsSync(MIGRATION_DONE_MARKER)) {
    return { migrated: false, skipped: true, keysWritten: [] };
  }

  // No plaintext file to migrate
  if (!existsSync(PLAINTEXT_FILE)) {
    // Mark done so we don't re-check on every boot
    try { writeFileSync(MIGRATION_DONE_MARKER, new Date().toISOString()); } catch { /* ignore */ }
    return { migrated: false, skipped: true, keysWritten: [] };
  }

  // Already have encrypted store — don't clobber existing credentials
  if (hasCredentialStore()) {
    console.log('[CredMigration] Encrypted store already exists; skipping plaintext migration.');
    try { writeFileSync(MIGRATION_DONE_MARKER, new Date().toISOString()); } catch { /* ignore */ }
    return { migrated: false, skipped: true, keysWritten: [] };
  }

  console.log('[CredMigration] Migrating plaintext credentials to safeStorage...');

  // ── Step 1: Parse plaintext file ─────────────────────────────────────────

  let creds: LegacyCredentials;
  try {
    const raw = readFileSync(PLAINTEXT_FILE, 'utf-8');
    creds = JSON.parse(raw) as LegacyCredentials;
  } catch (err) {
    const msg = `Failed to read/parse plaintext credentials: ${err instanceof Error ? err.message : String(err)}`;
    console.error('[CredMigration]', msg);
    return { migrated: false, skipped: false, keysWritten: [], error: msg };
  }

  // ── Step 2: Backup ────────────────────────────────────────────────────────

  try {
    renameSync(PLAINTEXT_FILE, BACKUP_FILE);
    console.log('[CredMigration] Backed up plaintext file to', BACKUP_FILE);
  } catch (err) {
    const msg = `Failed to create backup: ${err instanceof Error ? err.message : String(err)}`;
    console.error('[CredMigration]', msg);
    return { migrated: false, skipped: false, keysWritten: [], error: msg };
  }

  // ── Step 3: Write to encrypted store ─────────────────────────────────────

  const keysWritten: string[] = [];

  try {
    for (const { key, extract } of LEGACY_TO_KEY_MAP) {
      const value = extract(creds);
      if (value && value !== 'PLACEHOLDER') {
        setCredential(key, value);
        keysWritten.push(key);
      }
    }
  } catch (err) {
    // Rollback: restore plaintext backup
    const rollbackMsg = rollback(BACKUP_FILE, PLAINTEXT_FILE);
    const msg = `Failed to write encrypted credentials: ${err instanceof Error ? err.message : String(err)}. ${rollbackMsg}`;
    console.error('[CredMigration]', msg);
    return { migrated: false, skipped: false, keysWritten: [], error: msg };
  }

  // ── Step 4: Verify decryption ─────────────────────────────────────────────

  try {
    for (const key of keysWritten) {
      const retrieved = getCredential(key);
      if (!retrieved) {
        throw new Error(`Verification failed: key "${key}" could not be read back`);
      }
    }
  } catch (err) {
    // Rollback
    const rollbackMsg = rollback(BACKUP_FILE, PLAINTEXT_FILE);
    const msg = `Credential verification failed: ${err instanceof Error ? err.message : String(err)}. ${rollbackMsg}`;
    console.error('[CredMigration]', msg);
    return { migrated: false, skipped: false, keysWritten: [], error: msg };
  }

  // ── Step 5: Remove backup and mark done ───────────────────────────────────

  try {
    unlinkSync(BACKUP_FILE);
  } catch {
    // Non-fatal — backup file can be cleaned up later
    console.warn('[CredMigration] Could not delete backup file:', BACKUP_FILE);
  }

  try {
    writeFileSync(MIGRATION_DONE_MARKER, new Date().toISOString());
  } catch {
    // Non-fatal
  }

  console.log(`[CredMigration] Migration complete. ${keysWritten.length} credential(s) migrated.`);
  return { migrated: true, skipped: false, keysWritten };
}

function rollback(backupPath: string, originalPath: string): string {
  try {
    if (existsSync(backupPath)) {
      renameSync(backupPath, originalPath);
      return 'Rolled back to plaintext backup.';
    }
    return 'No backup found for rollback.';
  } catch (rbErr) {
    return `Rollback also failed: ${rbErr instanceof Error ? rbErr.message : String(rbErr)}`;
  }
}
