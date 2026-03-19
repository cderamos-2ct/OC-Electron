// Vault Backup & Restore — encrypted backup files independent of pg_dump
// Uses the vault master key for encryption, stored in ~/.openclaw-shell/backups/

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { query } from 'openclaw-db';
import { listVaultSecrets } from './vault-db-repo.js';
import { listAllCredentialUrls } from './vault-autofill.js';
import { appendVaultAuditEntry } from './vault-audit.js';
import { createLogger } from '../logging/logger.js';
import { SHELL_CONFIG_DIR_NAME } from '../../shared/constants.js';

const log = createLogger('VaultBackup');

const BACKUP_DIR = join(homedir(), SHELL_CONFIG_DIR_NAME, 'backups');
const MAX_BACKUPS = 10;
const ALGORITHM = 'aes-256-gcm';

// ─── Types ──────────────────────────────────────────────────────

interface BackupData {
  version: 1;
  createdAt: string;
  secrets: Array<{
    name: string;
    value: string;
    folder: string | null;
    description: string | null;
    owner_agent: string | null;
    acl: string[];
    rotated_at: string | null;
    created_at: string;
    updated_at: string;
  }>;
  credentialUrls: Array<{
    secretName: string;
    urlPattern: string;
    username: string | null;
  }>;
  rotationSchedules: Array<{
    secret_name: string;
    mode: string;
    interval_ms: number;
    last_rotated_at: string | null;
    next_rotation_at: string | null;
  }>;
}

export interface BackupResult {
  filePath: string;
  secretCount: number;
  createdAt: string;
}

export interface RestoreResult {
  restored: number;
  urlMappings: number;
  errors: string[];
}

// ─── Encryption ─────────────────────────────────────────────────

function getMasterKey(): Buffer {
  const key = process.env.VAULT_MASTER_KEY;
  if (!key) throw new Error('VAULT_MASTER_KEY not set');
  // Derive a 32-byte key from the hex master key
  return scryptSync(key, 'openclaw-vault-backup', 32);
}

function encrypt(plaintext: string): Buffer {
  const key = getMasterKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: [16 bytes IV][16 bytes auth tag][encrypted data]
  return Buffer.concat([iv, authTag, encrypted]);
}

function decrypt(data: Buffer): string {
  const key = getMasterKey();
  const iv = data.subarray(0, 16);
  const authTag = data.subarray(16, 32);
  const encrypted = data.subarray(32);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf-8');
}

// ─── Backup ─────────────────────────────────────────────────────

function ensureBackupDir(): void {
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
  }
}

export async function createBackup(): Promise<BackupResult> {
  ensureBackupDir();

  // Gather data
  const secrets = await listVaultSecrets();
  const credentialUrls = await listAllCredentialUrls();

  // Load rotation schedules
  const schedResult = await query<{
    secret_name: string;
    mode: string;
    interval_ms: string;
    last_rotated_at: string | null;
    next_rotation_at: string | null;
  }>('SELECT * FROM rotation_schedules ORDER BY secret_name');

  const backupData: BackupData = {
    version: 1,
    createdAt: new Date().toISOString(),
    secrets: secrets.map((s) => ({
      name: s.name,
      value: s.value,
      folder: s.folder ?? null,
      description: s.description,
      owner_agent: s.owner_agent,
      acl: s.acl,
      rotated_at: s.rotated_at,
      created_at: s.created_at,
      updated_at: s.updated_at,
    })),
    credentialUrls: credentialUrls.map((u) => ({
      secretName: u.secretName,
      urlPattern: u.urlPattern,
      username: u.username,
    })),
    rotationSchedules: schedResult.rows.map((r) => ({
      secret_name: r.secret_name,
      mode: r.mode,
      interval_ms: parseInt(r.interval_ms, 10),
      last_rotated_at: r.last_rotated_at,
      next_rotation_at: r.next_rotation_at,
    })),
  };

  // Encrypt and write
  const json = JSON.stringify(backupData);
  const encrypted = encrypt(json);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').substring(0, 19);
  const fileName = `vault-backup-${timestamp}.enc`;
  const filePath = join(BACKUP_DIR, fileName);

  writeFileSync(filePath, encrypted, { mode: 0o600 });

  // Prune old backups
  pruneOldBackups();

  // Audit
  appendVaultAuditEntry({
    timestamp: new Date().toISOString(),
    agentId: 'user',
    secretName: '*',
    action: 'access',
    result: 'success',
    purpose: `backup: ${fileName}`,
  });

  log.info(`Created vault backup: ${fileName} (${secrets.length} secrets)`);

  return {
    filePath,
    secretCount: secrets.length,
    createdAt: backupData.createdAt,
  };
}

function pruneOldBackups(): void {
  try {
    const files = readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('vault-backup-') && f.endsWith('.enc'))
      .sort()
      .reverse();

    // Keep only the latest MAX_BACKUPS
    for (const file of files.slice(MAX_BACKUPS)) {
      unlinkSync(join(BACKUP_DIR, file));
      log.info(`Pruned old backup: ${file}`);
    }
  } catch {
    // Non-fatal
  }
}

// ─── Restore ────────────────────────────────────────────────────

export async function restoreBackup(filePath: string): Promise<RestoreResult> {
  const result: RestoreResult = { restored: 0, urlMappings: 0, errors: [] };

  // Read and decrypt
  let data: BackupData;
  try {
    const encrypted = readFileSync(filePath);
    const json = decrypt(encrypted);
    data = JSON.parse(json) as BackupData;
  } catch (err) {
    throw new Error(`Failed to read backup: ${err instanceof Error ? err.message : err}`);
  }

  if (data.version !== 1) {
    throw new Error(`Unsupported backup version: ${data.version}`);
  }

  // Import dynamically to avoid circular deps
  const { upsertVaultSecret } = await import('./vault-db-repo.js');
  const { addCredentialUrl } = await import('./vault-autofill.js');

  // Restore secrets (upsert — newer wins)
  for (const secret of data.secrets) {
    try {
      await upsertVaultSecret({
        name: secret.name,
        value: secret.value,
        folder: secret.folder ?? undefined,
        description: secret.description ?? undefined,
      });
      result.restored++;
    } catch (err) {
      result.errors.push(`${secret.name}: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Restore URL mappings
  for (const mapping of data.credentialUrls) {
    try {
      await addCredentialUrl(mapping.secretName, mapping.urlPattern, mapping.username ?? undefined);
      result.urlMappings++;
    } catch {
      // Duplicate or FK error — skip silently
    }
  }

  // Restore rotation schedules
  for (const sched of data.rotationSchedules) {
    try {
      await query(
        `INSERT INTO rotation_schedules (secret_name, mode, interval_ms, last_rotated_at, next_rotation_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (secret_name) DO UPDATE SET
           mode = EXCLUDED.mode,
           interval_ms = EXCLUDED.interval_ms,
           updated_at = NOW()`,
        [sched.secret_name, sched.mode, sched.interval_ms, sched.last_rotated_at, sched.next_rotation_at],
      );
    } catch {
      // Non-fatal
    }
  }

  // Audit
  appendVaultAuditEntry({
    timestamp: new Date().toISOString(),
    agentId: 'user',
    secretName: '*',
    action: 'create',
    result: 'success',
    purpose: `restore: ${result.restored} secrets from backup`,
  });

  log.info(`Restored vault backup: ${result.restored} secrets, ${result.urlMappings} URL mappings, ${result.errors.length} errors`);

  return result;
}

// ─── Status ─────────────────────────────────────────────────────

export function getLastBackupInfo(): { filePath: string; createdAt: string } | null {
  if (!existsSync(BACKUP_DIR)) return null;

  const files = readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('vault-backup-') && f.endsWith('.enc'))
    .sort()
    .reverse();

  if (files.length === 0) return null;

  const filePath = join(BACKUP_DIR, files[0]);
  // Extract timestamp from filename: vault-backup-2026-03-18_14-30-00.enc
  const match = files[0].match(/vault-backup-(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/);
  const createdAt = match ? match[1].replace('_', 'T').replace(/-/g, (m, i) => i > 9 ? ':' : m) : '';

  return { filePath, createdAt };
}

// ─── Debounced Auto-Backup ──────────────────────────────────────

let autoBackupTimer: ReturnType<typeof setTimeout> | null = null;
const AUTO_BACKUP_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

export function scheduleAutoBackup(): void {
  if (autoBackupTimer) {
    clearTimeout(autoBackupTimer);
  }

  autoBackupTimer = setTimeout(() => {
    autoBackupTimer = null;
    void createBackup().catch((err) => {
      log.warn('Auto-backup failed:', err);
    });
  }, AUTO_BACKUP_DEBOUNCE_MS);
}
