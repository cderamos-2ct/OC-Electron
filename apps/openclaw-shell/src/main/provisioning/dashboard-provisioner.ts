// Dashboard provisioner — bundle and serve Next.js standalone build

import { ChildProcess, spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import type { Provisioner, ProvisioningProgress } from './types.js';
import { ProvisioningStatus } from './types.js';
import { resolveResourcePath } from './platform.js';
import { createLogger } from '../logging/logger.js';

const log = createLogger('DashboardProvisioner');

const DASHBOARD_PORT = 3000;

export class DashboardProvisioner implements Provisioner {
  readonly id = 'dashboard';
  readonly name = 'OpenClaw Dashboard';

  private process: ChildProcess | null = null;

  /** Path to the bundled standalone Next.js server */
  private get serverPath(): string {
    return resolveResourcePath('dashboard', 'server.js');
  }

  /** Path to the bundled dashboard public dir */
  private get publicPath(): string {
    return resolveResourcePath('dashboard', 'public');
  }

  async check(): Promise<boolean> {
    // Check if dashboard server file exists in resources
    if (!existsSync(this.serverPath)) return false;

    // Check if dashboard is responding
    try {
      const response = await fetch(`http://127.0.0.1:${DASHBOARD_PORT}/`);
      return response.ok;
    } catch {
      return existsSync(this.serverPath);
    }
  }

  async provision(onProgress?: (p: ProvisioningProgress) => void): Promise<void> {
    const progress = (message: string, percent?: number) => {
      onProgress?.({ service: this.id, status: ProvisioningStatus.Running, message, percent });
    };

    progress('Checking dashboard bundle...', 20);

    if (!existsSync(this.serverPath)) {
      // In development, the dashboard is served by Next.js dev server
      // In production, it's pre-built into extraResources
      progress('Dashboard bundle not found (will serve from dev server in dev mode)', 100);
      log.warn('Dashboard server.js not found in resources. In production, run `npm run build` in dashboard/ first.');
      return;
    }

    progress('Starting dashboard...', 50);
    await this.start();

    // Wait for dashboard to be ready
    progress('Waiting for dashboard...', 70);
    await this.waitForReady(10);

    progress('Dashboard ready', 100);
  }

  async start(): Promise<void> {
    // Check if already running
    try {
      const response = await fetch(`http://127.0.0.1:${DASHBOARD_PORT}/`);
      if (response.ok) {
        log.info('Dashboard already running.');
        return;
      }
    } catch {
      // Not running
    }

    if (!existsSync(this.serverPath)) {
      log.warn('Dashboard server.js not found, skipping start.');
      return;
    }

    this.process = spawn('node', [this.serverPath], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: String(DASHBOARD_PORT),
        HOSTNAME: '127.0.0.1',
        NODE_ENV: 'production',
      },
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      log.info('[dashboard]', data.toString().trimEnd());
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      log.error('[dashboard:err]', data.toString().trimEnd());
    });

    this.process.on('error', (err) => {
      log.error('Dashboard process error:', err.message);
      this.process = null;
    });

    this.process.on('exit', (code, signal) => {
      log.warn(`Dashboard exited (code=${code}, signal=${signal})`);
      this.process = null;
    });

    log.info('Dashboard spawned.');
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
      log.info('Dashboard stopped.');
    }
  }

  private async waitForReady(maxRetries: number): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(`http://127.0.0.1:${DASHBOARD_PORT}/`);
        if (response.ok) return;
      } catch {
        // Not ready
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    log.warn(`Dashboard not ready after ${maxRetries} retries — may need manual start.`);
  }
}
