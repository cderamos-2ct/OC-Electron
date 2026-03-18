// GWS (Google Workspace CLI) provisioner — resolve binary from app resources

import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import type { Provisioner, ProvisioningProgress } from './types.js';
import { ProvisioningStatus } from './types.js';
import { resolveGwsBin } from './platform.js';
import { createLogger } from '../logging/logger.js';

const execFileAsync = promisify(execFile);
const log = createLogger('GwsProvisioner');

export class GwsProvisioner implements Provisioner {
  readonly id = 'gws';
  readonly name = 'Google Workspace CLI';

  async check(): Promise<boolean> {
    const gwsBin = resolveGwsBin();
    try {
      await execFileAsync(gwsBin, ['auth', 'status'], { timeout: 10_000 });
      return true;
    } catch {
      // Binary exists but not authenticated — still "provisioned"
      return existsSync(gwsBin) && gwsBin !== 'gws';
    }
  }

  async provision(onProgress?: (p: ProvisioningProgress) => void): Promise<void> {
    const progress = (message: string, percent?: number) => {
      onProgress?.({ service: this.id, status: ProvisioningStatus.Running, message, percent });
    };

    const gwsBin = resolveGwsBin();
    progress('Checking GWS CLI binary...', 20);

    // The GWS binary is bundled in extraResources — just verify it exists
    if (!existsSync(gwsBin) && gwsBin === 'gws') {
      // In development, gws should be in node_modules/.bin/
      progress('GWS CLI not found in extraResources, checking node_modules...', 40);
      try {
        await execFileAsync('npx', ['gws', '--version'], { timeout: 10_000 });
        progress('GWS CLI available via npx', 80);
      } catch {
        log.warn('GWS CLI not available — Google Workspace features will be limited.');
        progress('GWS CLI not available (skippable)', 100);
        return;
      }
    }

    // Verify the binary works
    progress('Verifying GWS CLI...', 60);
    try {
      const { stdout } = await execFileAsync(gwsBin, ['--version'], { timeout: 10_000 });
      log.info(`GWS CLI version: ${stdout.trim()}`);
      progress(`GWS CLI ready (${stdout.trim()})`, 100);
    } catch (err) {
      log.warn('GWS CLI version check failed:', err);
      progress('GWS CLI binary found', 100);
    }
  }

  async start(): Promise<void> {
    // GWS is a CLI tool, not a daemon — no-op
  }

  async stop(): Promise<void> {
    // No-op
  }
}
