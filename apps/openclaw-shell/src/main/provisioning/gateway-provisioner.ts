// Gateway provisioner — async install with progress tracking
// Replaces the execSync approach in gateway-process.ts

import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import type { Provisioner, ProvisioningProgress } from './types.js';
import { ProvisioningStatus } from './types.js';
import { getGatewayDir } from './platform.js';
import { createLogger } from '../logging/logger.js';

const execFileAsync = promisify(execFile);
const log = createLogger('GatewayProvisioner');

const GATEWAY_ENTRY_RELATIVE = join('node_modules', 'openclaw', 'openclaw.mjs');

export class GatewayProvisioner implements Provisioner {
  readonly id = 'gateway';
  readonly name = 'OpenClaw Gateway';

  private installDir: string;

  constructor(installDir?: string) {
    this.installDir = installDir ?? getGatewayDir();
  }

  get entryPath(): string {
    return join(this.installDir, GATEWAY_ENTRY_RELATIVE);
  }

  async check(): Promise<boolean> {
    return existsSync(this.entryPath);
  }

  async provision(onProgress?: (p: ProvisioningProgress) => void): Promise<void> {
    const progress = (message: string, percent?: number) => {
      onProgress?.({ service: this.id, status: ProvisioningStatus.Running, message, percent });
    };

    progress('Preparing gateway directory...', 5);
    mkdirSync(this.installDir, { recursive: true });

    // Create a minimal package.json so npm installs into this directory
    const pkgJsonPath = join(this.installDir, 'package.json');
    if (!existsSync(pkgJsonPath)) {
      writeFileSync(pkgJsonPath, JSON.stringify({
        name: 'aegilume-gateway',
        version: '1.0.0',
        private: true,
      }), 'utf-8');
    }

    // Check if already partially installed
    if (existsSync(this.entryPath)) {
      progress('Gateway already installed, checking for updates...', 50);
      const needsUpdate = await this.checkForUpdate();
      if (!needsUpdate) {
        progress('Gateway up to date', 100);
        return;
      }
    }

    // Install openclaw via npm with progress tracking
    progress('Installing openclaw gateway...', 10);
    await this.installWithProgress(onProgress);

    // Verify installation
    if (!existsSync(this.entryPath)) {
      throw new Error('Gateway installation failed — entry point not found');
    }

    progress('Gateway installed', 100);
  }

  async start(): Promise<void> {
    // Gateway startup is handled by GatewayProcessManager
    // This provisioner only handles installation
    log.info('Gateway provisioner: start() is a no-op (managed by GatewayProcessManager).');
  }

  async stop(): Promise<void> {
    // Gateway shutdown is handled by GatewayProcessManager
    log.info('Gateway provisioner: stop() is a no-op (managed by GatewayProcessManager).');
  }

  private async installWithProgress(
    onProgress?: (p: ProvisioningProgress) => void,
  ): Promise<void> {
    const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';

    return new Promise<void>((resolve, reject) => {
      const child = spawn(npmBin, ['install', 'openclaw', '--omit=dev', '--ignore-scripts'], {
        cwd: this.installDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'production' },
      });

      let stderr = '';
      let lastPercent = 10;

      child.stdout?.on('data', (data: Buffer) => {
        const line = data.toString().trim();
        log.info('[gateway:npm]', line);

        // Parse npm output for progress estimation
        if (line.includes('added')) {
          lastPercent = Math.min(lastPercent + 20, 90);
          onProgress?.({
            service: this.id,
            status: ProvisioningStatus.Running,
            message: line,
            percent: lastPercent,
          });
        }
      });

      child.stderr?.on('data', (data: Buffer) => {
        const line = data.toString().trim();
        if (line) {
          stderr += line + '\n';
          // npm writes progress to stderr
          if (line.includes('npm') && !line.includes('WARN')) {
            lastPercent = Math.min(lastPercent + 5, 85);
            onProgress?.({
              service: this.id,
              status: ProvisioningStatus.Running,
              message: line.slice(0, 100),
              percent: lastPercent,
            });
          }
        }
      });

      child.on('error', (err) => {
        reject(new Error(`Gateway npm install failed: ${err.message}`));
      });

      child.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Gateway npm install exited with code ${code}: ${stderr.slice(0, 500)}`));
        }
      });

      // Timeout after 3 minutes
      setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Gateway npm install timed out after 3 minutes'));
      }, 180_000);
    });
  }

  private async checkForUpdate(): Promise<boolean> {
    try {
      // Check installed version
      const pkgPath = join(this.installDir, 'node_modules', 'openclaw', 'package.json');
      if (!existsSync(pkgPath)) return true;

      const installed = JSON.parse(readFileSync(pkgPath, 'utf-8')).version;

      // Check latest version from npm
      const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      const { stdout } = await execFileAsync(npmBin, ['view', 'openclaw', 'version'], {
        timeout: 10_000,
      });
      const latest = stdout.trim();

      if (installed !== latest) {
        log.info(`Gateway update available: ${installed} → ${latest}`);
        return true;
      }
      return false;
    } catch {
      // Can't check — assume up to date
      return false;
    }
  }
}
