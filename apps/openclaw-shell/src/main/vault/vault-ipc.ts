// Vault IPC handlers — exposes vault operations to the renderer process
// Follows the same pattern as ipc-handlers.ts

import { ipcMain } from 'electron';
import type { VaultBridge } from './vault-bridge.js';
import type { VaultPolicy } from '../../shared/types.js';
import { getCredential } from '../security/secure-credentials-store.js';
import {
  CREDENTIAL_KEYS,
  SERVICE_CREDENTIAL_MAP,
} from '../../shared/constants.js';
import {
  upsertVaultSecret,
  deleteVaultSecret,
  getVaultSecret,
  appendAuditLogEntry,
} from './vault-db-repo.js';
import { appendVaultAuditEntry } from './vault-audit.js';
import {
  findCredentialsForUrl,
  logAutoFillAccess,
  saveCredentialFromForm,
  addCredentialUrl,
  removeCredentialUrl,
  listCredentialUrlsForSecret,
} from './vault-autofill.js';
import { importBitwardenExport } from './bitwarden-import.js';
import { exportVault } from './vault-export.js';
import { createBackup, restoreBackup, getLastBackupInfo } from './vault-backup.js';
import { generateTOTP } from './totp.js';
import { generatePassword, generatePassphrase } from './password-generator.js';

export function registerVaultIpcHandlers(vaultBridge: VaultBridge): void {
  ipcMain.handle('vault:status', async () => {
    try {
      return await vaultBridge.getStatus();
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('vault:list-secrets', async () => {
    try {
      return await vaultBridge.listSecrets();
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('vault:list-policies', async () => {
    try {
      return vaultBridge.listPolicies();
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('vault:update-policy', async (_event, policy: VaultPolicy) => {
    try {
      const updated = vaultBridge.updatePolicy(policy);
      return updated ?? { error: 'Policy not found' };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('vault:delete-policy', async (_event, policyId: string) => {
    try {
      const deleted = vaultBridge.deletePolicy(policyId);
      return { ok: deleted };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('vault:get-audit-log', async (_event, limit?: number) => {
    try {
      return vaultBridge.getAuditLog(limit);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('vault:revoke-lease', async (_event, leaseId: string) => {
    try {
      const revoked = vaultBridge.revokeLease(leaseId);
      return { ok: revoked };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('vault:revoke-all', async () => {
    try {
      const count = vaultBridge.revokeAll();
      return { ok: true, revokedCount: count };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('vault:pending-approvals', async () => {
    try {
      return vaultBridge.listPendingApprovals();
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('vault:decide-approval', async (_event, approvalId: string, decision: 'approved' | 'denied') => {
    try {
      const decided = await vaultBridge.decideApproval(approvalId, decision);
      return { ok: decided };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('vault:add-secret', async (_event, input: { name: string; value: string; folder?: string; description?: string }) => {
    try {
      const secret = await upsertVaultSecret(input);
      appendVaultAuditEntry({ timestamp: new Date().toISOString(), agentId: 'user', secretName: input.name, action: 'create', result: 'success' });
      await appendAuditLogEntry({ agentId: 'user', action: 'create', secretName: input.name, result: 'success' });
      return secret;
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('vault:update-secret', async (_event, input: { name: string; value: string; folder?: string; description?: string }) => {
    try {
      const secret = await upsertVaultSecret(input);
      vaultBridge.revokeBySecret(input.name);
      appendVaultAuditEntry({ timestamp: new Date().toISOString(), agentId: 'user', secretName: input.name, action: 'update', result: 'success' });
      await appendAuditLogEntry({ agentId: 'user', action: 'update', secretName: input.name, result: 'success' });
      return secret;
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('vault:delete-secret', async (_event, name: string) => {
    try {
      const deleted = await deleteVaultSecret(name);
      if (deleted) {
        vaultBridge.revokeBySecret(name);
        appendVaultAuditEntry({ timestamp: new Date().toISOString(), agentId: 'user', secretName: name, action: 'delete', result: 'success' });
        await appendAuditLogEntry({ agentId: 'user', action: 'delete', secretName: name, result: 'success' });
      }
      return { ok: deleted };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('vault:reveal-secret', async (_event, name: string) => {
    try {
      const secret = await getVaultSecret(name);
      appendVaultAuditEntry({ timestamp: new Date().toISOString(), agentId: 'user', secretName: name, action: 'access', result: secret ? 'success' : 'denied' });
      await appendAuditLogEntry({ agentId: 'user', action: 'access', secretName: name, result: secret ? 'success' : 'denied' });
      return secret ?? { error: 'Secret not found' };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ─── Auto-Fill Handlers ──────────────────────────────────────────

  ipcMain.handle('vault:autofill-query', async (_event, input: { url: string }) => {
    try {
      const matches = await findCredentialsForUrl(input.url);
      return matches.length > 0 ? matches[0] : null;
    } catch (err) {
      return null;
    }
  });

  ipcMain.handle('vault:autofill-used', async (_event, input: { secretName: string; url: string }) => {
    try {
      logAutoFillAccess(input.secretName, input.url);
      return { ok: true };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('vault:autofill-offer-save', async (_event, input: { url: string; username: string; password: string }) => {
    try {
      return await saveCredentialFromForm(input);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ─── URL Mapping Handlers ───────────────────────────────────────

  ipcMain.handle('vault:add-credential-url', async (_event, input: { secretName: string; urlPattern: string; username?: string }) => {
    try {
      return await addCredentialUrl(input.secretName, input.urlPattern, input.username);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('vault:remove-credential-url', async (_event, input: { id: string }) => {
    try {
      const removed = await removeCredentialUrl(input.id);
      return { ok: removed };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('vault:list-credential-urls', async (_event, input: { secretName: string }) => {
    try {
      return await listCredentialUrlsForSecret(input.secretName);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ─── Import Handler ─────────────────────────────────────────────

  ipcMain.handle('vault:import-bitwarden', async (_event, input: { filePath: string }) => {
    try {
      return await importBitwardenExport(input.filePath);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ─── Export / Backup / Restore ────────────────────────────────────

  ipcMain.handle('vault:export', async (_event, input: { format: 'json' | 'csv'; filePath: string }) => {
    try {
      return await exportVault(input.format, input.filePath);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('vault:create-backup', async () => {
    try {
      return await createBackup();
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('vault:restore-backup', async (_event, input: { filePath: string }) => {
    try {
      return await restoreBackup(input.filePath);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('vault:last-backup-info', async () => {
    try {
      return getLastBackupInfo();
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ─── TOTP ───────────────────────────────────────────────────────

  ipcMain.handle('vault:get-totp', async (_event, input: { secretName: string }) => {
    try {
      const { query: dbQuery } = await import('openclaw-db');
      const result = await dbQuery<{ totp_secret: string | null }>(
        'SELECT totp_secret FROM vault_secrets WHERE name = $1',
        [input.secretName],
      );
      const totpSecret = result.rows[0]?.totp_secret;
      if (!totpSecret) return { error: 'No TOTP secret configured' };
      return generateTOTP(totpSecret);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ─── Password Generator ─────────────────────────────────────────

  ipcMain.handle('vault:generate-password', async (_event, input?: {
    length?: number; uppercase?: boolean; lowercase?: boolean; numbers?: boolean;
    symbols?: boolean; excludeAmbiguous?: boolean; mode?: 'password' | 'passphrase';
    wordCount?: number; delimiter?: string;
  }) => {
    try {
      if (input?.mode === 'passphrase') {
        return { password: generatePassphrase({ wordCount: input.wordCount, delimiter: input.delimiter }) };
      }
      return { password: generatePassword(input) };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Test whether a named service credential is present in the secure store.
  // Does NOT make a live network call — verifies the credential key exists and is non-empty.
  ipcMain.handle('credentials:test-connection', async (_event, serviceId: string) => {
    try {
      const credKey = SERVICE_CREDENTIAL_MAP[serviceId];
      if (!credKey) {
        return { ok: false, message: `Unknown service "${serviceId}"` };
      }
      const value = getCredential(credKey);
      if (!value) {
        return { ok: false, message: 'Credential not found in secure store' };
      }
      return { ok: true, message: 'Credential present' };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  });
}
