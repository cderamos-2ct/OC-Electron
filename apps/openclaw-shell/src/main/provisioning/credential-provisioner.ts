// Credential provisioner — validates external service credentials

import { execFile } from 'child_process';
import { promisify } from 'util';
import type { Provisioner, ProvisioningProgress } from './types.js';
import { ProvisioningStatus } from './types.js';
import { resolveBwBin, resolveGwsBin } from './platform.js';
import { createLogger } from '../logging/logger.js';

const execFileAsync = promisify(execFile);
const log = createLogger('CredentialProvisioner');

export interface CredentialStatus {
  githubPat: boolean;
  gwsAuth: boolean;
  bwSetup: boolean;
}

export class CredentialProvisioner implements Provisioner {
  readonly id = 'credentials';
  readonly name = 'Service Credentials';

  private status: CredentialStatus = {
    githubPat: false,
    gwsAuth: false,
    bwSetup: false,
  };

  async check(): Promise<boolean> {
    await this.validateAll();
    // Credentials are optional — always return true (don't block provisioning)
    return true;
  }

  async provision(onProgress?: (p: ProvisioningProgress) => void): Promise<void> {
    const progress = (message: string, percent?: number) => {
      onProgress?.({ service: this.id, status: ProvisioningStatus.Running, message, percent });
    };

    progress('Validating credentials...', 10);
    await this.validateAll();

    const results: string[] = [];
    if (this.status.githubPat) results.push('GitHub PAT');
    if (this.status.gwsAuth) results.push('GWS Auth');
    if (this.status.bwSetup) results.push('Bitwarden');

    const message = results.length > 0
      ? `Validated: ${results.join(', ')}`
      : 'No credentials configured yet (can be added later)';

    progress(message, 100);
  }

  async start(): Promise<void> {
    // No-op — credentials don't need starting
  }

  async stop(): Promise<void> {
    // No-op
  }

  getStatus(): CredentialStatus {
    return { ...this.status };
  }

  private async validateAll(): Promise<void> {
    // Validate in parallel
    const [githubPat, gwsAuth, bwSetup] = await Promise.all([
      this.validateGitHubPat(),
      this.validateGwsAuth(),
      this.validateBwSetup(),
    ]);

    this.status = { githubPat, gwsAuth, bwSetup };
  }

  private async validateGitHubPat(): Promise<boolean> {
    // Check if GitHub PAT is stored in safeStorage or environment
    const pat = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
    if (pat) {
      try {
        const response = await fetch('https://api.github.com/user', {
          headers: { Authorization: `token ${pat}` },
        });
        return response.ok;
      } catch {
        return false;
      }
    }
    return false;
  }

  private async validateGwsAuth(): Promise<boolean> {
    try {
      const gwsBin = resolveGwsBin();
      await execFileAsync(gwsBin, ['auth', 'status'], { timeout: 10_000 });
      return true;
    } catch {
      return false;
    }
  }

  private async validateBwSetup(): Promise<boolean> {
    try {
      const bwBin = resolveBwBin();
      const { stdout } = await execFileAsync(bwBin, ['status'], { timeout: 10_000 });
      const status = JSON.parse(stdout);
      return status.status !== 'unauthenticated';
    } catch {
      return false;
    }
  }
}
