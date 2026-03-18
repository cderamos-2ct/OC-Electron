// Credential provider interface — abstracts secret access for API workers
// Four implementations:
//   VaultCredentialProvider     — Bitwarden vault via VaultBridge (primary)
//   PostgresCredentialProvider  — Postgres vault_secrets (middle tier / offline cache)
//   SecureCredentialProvider    — safeStorage-encrypted local store (offline fallback)
//   LegacyFileCredentialProvider — ~/.openclaw-shell/api-credentials.json (legacy fallback)

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { SHELL_CONFIG_DIR_NAME } from '../../shared/constants.js';
import { getCredential as safeGetCredential } from '../security/secure-credentials-store.js';
import type { VaultBridge } from '../vault/vault-bridge.js';
import { getVaultSecret } from '../vault/vault-db-repo.js';

const CREDENTIALS_FILE = join(homedir(), SHELL_CONFIG_DIR_NAME, 'api-credentials.json');

export interface CredentialProvider {
  getCredential(secretName: string, agentId: string): Promise<string>;
  onRotated(secretName: string, callback: () => void): void;
  dispose(): void;
}

/**
 * Production provider — fetches credentials from Vaultwarden via VaultBridge.
 * Leases are managed by the bridge (TTL, policy enforcement, audit logging).
 */
export class VaultCredentialProvider implements CredentialProvider {
  private vaultBridge: VaultBridge;
  private rotationCallbacks = new Map<string, Set<() => void>>();

  constructor(vaultBridge: VaultBridge) {
    this.vaultBridge = vaultBridge;
  }

  async getCredential(secretName: string, agentId: string): Promise<string> {
    const lease = await this.vaultBridge.requestSecret(agentId, secretName, `worker:${agentId}`);
    if (!lease) {
      throw new Error(`Failed to obtain credential "${secretName}" for agent "${agentId}" from vault`);
    }
    return lease.value;
  }

  onRotated(secretName: string, callback: () => void): void {
    if (!this.rotationCallbacks.has(secretName)) {
      this.rotationCallbacks.set(secretName, new Set());
    }
    this.rotationCallbacks.get(secretName)!.add(callback);
  }

  /** Called by rotation scheduler when a secret is rotated */
  notifyRotation(secretName: string): void {
    const callbacks = this.rotationCallbacks.get(secretName);
    if (callbacks) {
      for (const cb of callbacks) {
        try { cb(); } catch { /* ignore callback errors */ }
      }
    }
  }

  dispose(): void {
    this.rotationCallbacks.clear();
  }
}

/**
 * Middle-tier provider — reads from Postgres vault_secrets table.
 * Used when VaultBridge (Bitwarden) is unavailable but DB is reachable.
 * Secrets are synced from Bitwarden by VaultBridge.syncSecretsToDb() on unlock.
 */
export class PostgresCredentialProvider implements CredentialProvider {
  private rotationCallbacks = new Map<string, Set<() => void>>();

  async getCredential(secretName: string, agentId: string): Promise<string> {
    const row = await getVaultSecret(secretName);
    if (!row) {
      throw new Error(`Credential "${secretName}" not found in Postgres vault for agent "${agentId}"`);
    }
    if (row.value === 'PLACEHOLDER') {
      throw new Error(`Credential "${secretName}" is a placeholder — set the real value via Bitwarden vault`);
    }
    return row.value;
  }

  onRotated(secretName: string, callback: () => void): void {
    if (!this.rotationCallbacks.has(secretName)) {
      this.rotationCallbacks.set(secretName, new Set());
    }
    this.rotationCallbacks.get(secretName)!.add(callback);
  }

  /** Called externally when rotation-scheduler persists a new value */
  notifyRotation(secretName: string): void {
    const callbacks = this.rotationCallbacks.get(secretName);
    if (callbacks) {
      for (const cb of callbacks) {
        try { cb(); } catch { /* ignore */ }
      }
    }
  }

  dispose(): void {
    this.rotationCallbacks.clear();
  }
}

/**
 * Secure local provider — reads from safeStorage-encrypted credentials blob.
 * Used when vault is unreachable but credentials have been migrated from plaintext.
 * Falls back gracefully if a key isn't present in the store.
 */
export class SecureCredentialProvider implements CredentialProvider {
  private rotationCallbacks = new Map<string, Set<() => void>>();

  async getCredential(secretName: string, agentId: string): Promise<string> {
    const value = safeGetCredential(secretName);
    if (!value) {
      throw new Error(`Credential "${secretName}" not found in secure store for agent "${agentId}"`);
    }
    return value;
  }

  onRotated(secretName: string, callback: () => void): void {
    if (!this.rotationCallbacks.has(secretName)) {
      this.rotationCallbacks.set(secretName, new Set());
    }
    this.rotationCallbacks.get(secretName)!.add(callback);
  }

  dispose(): void {
    this.rotationCallbacks.clear();
  }
}

/**
 * Legacy fallback provider — reads from ~/.openclaw-shell/api-credentials.json.
 * Used during migration period or when vault is unreachable.
 */
export class LegacyFileCredentialProvider implements CredentialProvider {
  private credentials: Record<string, unknown> = {};

  constructor() {
    this.reload();
  }

  private reload(): void {
    if (!existsSync(CREDENTIALS_FILE)) {
      this.credentials = {};
      return;
    }
    try {
      const raw = readFileSync(CREDENTIALS_FILE, 'utf-8');
      this.credentials = JSON.parse(raw);
    } catch {
      this.credentials = {};
    }
  }

  async getCredential(secretName: string, _agentId: string): Promise<string> {
    // Map vault-style names to legacy credential paths
    // e.g., "openclaw/api-keys/github-pat" -> credentials.github.personal_access_token
    const mapping: Record<string, () => string | undefined> = {
      'openclaw/api-keys/github-pat': () => (this.credentials.github as Record<string, string>)?.personal_access_token,
      'openclaw/api-keys/fireflies': () => (this.credentials.fireflies as Record<string, string>)?.api_key,
    };

    const getter = mapping[secretName];
    if (getter) {
      const value = getter();
      if (value) return value;
    }

    throw new Error(`Credential "${secretName}" not found in legacy credentials file`);
  }

  onRotated(_secretName: string, _callback: () => void): void {
    // Legacy provider doesn't support rotation — no-op
  }

  dispose(): void {
    this.credentials = {};
  }
}
