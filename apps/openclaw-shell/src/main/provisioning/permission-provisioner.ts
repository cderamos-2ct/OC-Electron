// Permission provisioner — IPC handlers for macOS permission detection + deep links

import type { Provisioner, ProvisioningProgress } from './types.js';
import { ProvisioningStatus } from './types.js';
import { checkAllPermissions, checkPermission, getPermissionDeepLink } from './macos-permissions.js';
import { createLogger } from '../logging/logger.js';

const log = createLogger('PermissionProvisioner');

export class PermissionProvisioner implements Provisioner {
  readonly id = 'permissions';
  readonly name = 'System Permissions';

  async check(): Promise<boolean> {
    // Permissions are optional — always return true (don't block provisioning)
    if (process.platform !== 'darwin') return true;

    const perms = await checkAllPermissions();
    const allGranted = perms.every((p) => p.granted);
    if (allGranted) {
      log.info('All macOS permissions granted.');
    } else {
      const missing = perms.filter((p) => !p.granted).map((p) => p.name);
      log.info(`Missing macOS permissions: ${missing.join(', ')}`);
    }
    return true; // Non-blocking
  }

  async provision(onProgress?: (p: ProvisioningProgress) => void): Promise<void> {
    const progress = (message: string, percent?: number) => {
      onProgress?.({ service: this.id, status: ProvisioningStatus.Running, message, percent });
    };

    if (process.platform !== 'darwin') {
      progress('Skipped (not macOS)', 100);
      return;
    }

    progress('Checking permissions...', 30);
    const perms = await checkAllPermissions();

    const granted = perms.filter((p) => p.granted);
    const missing = perms.filter((p) => !p.granted);

    if (missing.length === 0) {
      progress('All permissions granted', 100);
    } else {
      progress(`${granted.length}/${perms.length} permissions granted — ${missing.map((p) => p.name).join(', ')} missing`, 100);
    }
  }

  async start(): Promise<void> {
    // No-op
  }

  async stop(): Promise<void> {
    // No-op
  }
}
