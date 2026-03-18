// code-server provisioner — download, install, and manage embedded IDE

import { ChildProcess, spawn, execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { Provisioner, ProvisioningProgress } from './types.js';
import { ProvisioningStatus } from './types.js';
import { getCodeServerDir } from './platform.js';
import { createLogger } from '../logging/logger.js';

const execFileAsync = promisify(execFile);
const log = createLogger('CodeServerProvisioner');

const CODE_SERVER_PORT = 8443;
const CODE_SERVER_VERSION = '4.96.4';

export class CodeServerProvisioner implements Provisioner {
  readonly id = 'code-server';
  readonly name = 'code-server (IDE)';

  private process: ChildProcess | null = null;
  private installDir: string;

  constructor(installDir?: string) {
    this.installDir = installDir ?? getCodeServerDir();
  }

  private get binPath(): string {
    return join(this.installDir, 'bin', 'code-server');
  }

  async check(): Promise<boolean> {
    if (!existsSync(this.binPath)) return false;

    try {
      const response = await fetch(`http://127.0.0.1:${CODE_SERVER_PORT}/healthz`);
      return response.ok;
    } catch {
      return existsSync(this.binPath);
    }
  }

  async provision(onProgress?: (p: ProvisioningProgress) => void): Promise<void> {
    const progress = (message: string, percent?: number) => {
      onProgress?.({ service: this.id, status: ProvisioningStatus.Running, message, percent });
    };

    // Step 1: Create install directory
    progress('Creating install directory...', 5);
    mkdirSync(this.installDir, { recursive: true });

    // Step 2: Download and install code-server
    if (!existsSync(this.binPath)) {
      progress('Downloading code-server...', 10);
      await this.downloadAndInstall(onProgress);
    }

    // Step 3: Verify binary
    progress('Verifying installation...', 85);
    try {
      const { stdout } = await execFileAsync(this.binPath, ['--version'], { timeout: 10_000 });
      log.info(`code-server version: ${stdout.trim()}`);
    } catch (err) {
      throw new Error(`code-server binary verification failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Step 4: Start code-server
    progress('Starting code-server...', 90);
    await this.start();
    await this.waitForReady(10);

    progress('code-server ready', 100);
  }

  async start(): Promise<void> {
    // Check if already running
    try {
      const response = await fetch(`http://127.0.0.1:${CODE_SERVER_PORT}/healthz`);
      if (response.ok) {
        log.info('code-server already running.');
        return;
      }
    } catch {
      // Not running
    }

    if (!existsSync(this.binPath)) {
      log.warn('code-server binary not found, skipping start.');
      return;
    }

    this.process = spawn(this.binPath, [
      '--bind-addr', `127.0.0.1:${CODE_SERVER_PORT}`,
      '--auth', 'none',
      '--disable-telemetry',
      '--disable-update-check',
    ], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      log.info('[code-server]', data.toString().trimEnd());
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      log.error('[code-server:err]', data.toString().trimEnd());
    });

    this.process.on('error', (err) => {
      log.error('code-server process error:', err.message);
      this.process = null;
    });

    this.process.on('exit', (code, signal) => {
      log.warn(`code-server exited (code=${code}, signal=${signal})`);
      this.process = null;
    });

    log.info('code-server spawned.');
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          if (this.process) this.process.kill('SIGKILL');
          resolve();
        }, 5_000);
        this.process?.on('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
      this.process = null;
      log.info('code-server stopped.');
    }
  }

  private async downloadAndInstall(
    onProgress?: (p: ProvisioningProgress) => void,
  ): Promise<void> {
    // Use the official code-server install script approach
    const platform = process.platform === 'darwin' ? 'darwin' : 'linux';
    const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
    const tarball = `code-server-${CODE_SERVER_VERSION}-${platform}-${arch}.tar.gz`;
    const url = `https://github.com/coder/code-server/releases/download/v${CODE_SERVER_VERSION}/${tarball}`;

    onProgress?.({
      service: this.id,
      status: ProvisioningStatus.Running,
      message: `Downloading ${tarball}...`,
      percent: 20,
    });

    return new Promise<void>((resolve, reject) => {
      const child = spawn('sh', ['-c', [
        `cd "${this.installDir}"`,
        `curl -fsSL "${url}" -o "${tarball}"`,
        `tar xzf "${tarball}" --strip-components=1`,
        `rm -f "${tarball}"`,
      ].join(' && ')], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('error', (err) => {
        reject(new Error(`code-server download failed: ${err.message}`));
      });

      child.on('exit', (code) => {
        if (code === 0) {
          log.info('code-server downloaded and extracted.');
          resolve();
        } else {
          reject(new Error(`code-server download failed (exit ${code}): ${stderr.slice(0, 500)}`));
        }
      });

      // 5 minute timeout for download
      setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('code-server download timed out'));
      }, 300_000);
    });
  }

  private async waitForReady(maxRetries: number): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(`http://127.0.0.1:${CODE_SERVER_PORT}/healthz`);
        if (response.ok) return;
      } catch {
        // Not ready
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    log.warn(`code-server not ready after ${maxRetries} retries.`);
  }
}
