// Vault IPC handlers — exposes vault operations to the renderer process
// Follows the same pattern as ipc-handlers.ts

import { ipcMain } from 'electron';
import type { VaultBridge } from './vault-bridge.js';
import type { VaultPolicy } from '../../shared/types.js';

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
}
