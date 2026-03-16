// Append-only JSONL audit log for vault secret access
// File: ~/.openclaw-shell/vault-audit.jsonl

import { appendFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { SHELL_CONFIG_DIR_NAME, VAULT_AUDIT_LOG_FILE } from '../../shared/constants.js';
import type { VaultAuditEntry } from '../../shared/types.js';

const AUDIT_LOG_PATH = join(homedir(), SHELL_CONFIG_DIR_NAME, VAULT_AUDIT_LOG_FILE);

function ensureDir(): void {
  const dir = join(homedir(), SHELL_CONFIG_DIR_NAME);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function appendVaultAuditEntry(entry: VaultAuditEntry): void {
  ensureDir();
  const line = JSON.stringify(entry) + '\n';
  appendFileSync(AUDIT_LOG_PATH, line, 'utf-8');
}

export function readVaultAuditLog(limit = 100): VaultAuditEntry[] {
  if (!existsSync(AUDIT_LOG_PATH)) return [];
  try {
    const raw = readFileSync(AUDIT_LOG_PATH, 'utf-8');
    const lines = raw.trim().split('\n').filter(Boolean);
    const entries = lines
      .map((line) => {
        try {
          return JSON.parse(line) as VaultAuditEntry;
        } catch {
          return null;
        }
      })
      .filter((e): e is VaultAuditEntry => e !== null);
    return entries.slice(-limit).reverse();
  } catch {
    return [];
  }
}
