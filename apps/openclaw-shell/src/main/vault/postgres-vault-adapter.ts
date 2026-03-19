// Postgres Vault Adapter — replaces Bitwarden-backed VaultAdapter
// Same public interface, backed by vault_secrets table + pgcrypto encryption
// Zero external binary dependencies

import { createLogger } from '../logging/logger.js';
import {
  getVaultSecret,
  listVaultSecrets,
  countVaultSecrets,
  upsertVaultSecret,
  deleteVaultSecret,
} from './vault-db-repo.js';
import type { VaultSecretMeta } from '../../shared/types.js';

const log = createLogger('PostgresVaultAdapter');

// Standard folder structure (same as the old Bitwarden folder layout)
const FOLDER_STRUCTURE = [
  'openclaw/api-keys',
  'openclaw/oauth',
  'openclaw/tokens',
  'openclaw/device-auth',
] as const;

export class PostgresVaultAdapter {
  private _unlocked = false;

  get isUnlocked(): boolean {
    return this._unlocked;
  }

  // ─── Initialization ─────────────────────────────────────────────

  async initialize(): Promise<void> {
    // Verify master key is available (set by initMasterKey() at app startup)
    if (!process.env.VAULT_MASTER_KEY) {
      throw new Error('VAULT_MASTER_KEY not set — call initMasterKey() before initializing vault adapter');
    }

    // Verify Postgres connectivity by running a simple count query
    try {
      await countVaultSecrets();
      this._unlocked = true;
      log.info('Postgres vault adapter initialized');
    } catch (err) {
      this._unlocked = false;
      throw new Error(`Postgres vault adapter failed to connect: ${err instanceof Error ? err.message : err}`);
    }
  }

  /**
   * No-op — folders are derived from secret name prefixes.
   * Kept for interface compatibility with VaultBridge.
   */
  async ensureFolderStructure(): Promise<void> {
    // Folders are implicit in the naming convention (openclaw/api-keys/*, etc.)
    // No Bitwarden folder creation needed
  }

  // ─── Secret Operations ──────────────────────────────────────────

  async getSecret(name: string): Promise<string | null> {
    const row = await getVaultSecret(name);
    if (!row) return null;
    if (row.value === 'PLACEHOLDER') return null;
    return row.value;
  }

  async setSecret(name: string, value: string, folder?: string): Promise<string> {
    // Derive folder from name prefix if not provided
    const resolvedFolder = folder ?? this.deriveFolderFromName(name);

    const row = await upsertVaultSecret({
      name,
      value,
      description: resolvedFolder ? `folder: ${resolvedFolder}` : undefined,
    });

    return row.id;
  }

  async deleteSecret(name: string): Promise<boolean> {
    return deleteVaultSecret(name);
  }

  async listSecrets(folder?: string): Promise<VaultSecretMeta[]> {
    const rows = await listVaultSecrets();

    const secrets = rows.map((row) => ({
      id: row.id,
      name: row.name,
      folder: row.folder ?? this.deriveFolderFromName(row.name) ?? 'uncategorized',
      lastRotatedAt: row.rotated_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      hasActiveLease: false, // Populated by VaultBridge from LeaseCache
    }));

    if (folder) {
      return secrets.filter((s) => s.folder === folder || s.folder.startsWith(folder + '/'));
    }

    return secrets;
  }

  async getSecretCount(): Promise<number> {
    return countVaultSecrets();
  }

  // ─── Sync ───────────────────────────────────────────────────────

  /**
   * No-op — Postgres IS the source of truth. No external system to sync from.
   */
  async sync(): Promise<void> {
    // Nothing to sync — data lives in Postgres
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private deriveFolderFromName(name: string): string | null {
    const lastSlash = name.lastIndexOf('/');
    if (lastSlash <= 0) return null;
    return name.substring(0, lastSlash);
  }

  /**
   * Returns the standard folder structure for UI dropdowns.
   */
  static getFolderStructure(): readonly string[] {
    return FOLDER_STRUCTURE;
  }
}
