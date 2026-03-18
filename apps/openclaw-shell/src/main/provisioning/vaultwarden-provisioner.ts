// Vaultwarden provisioner — install, configure, auto-start embedded Bitwarden server

import { ChildProcess, spawn, execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import type { Provisioner, ProvisioningProgress } from './types.js';
import { ProvisioningStatus } from './types.js';
import {
  resolveVaultwardenBin,
  resolveBwBin,
  getVaultwardenDataDir,
  getDataDir,
} from './platform.js';
import { createLogger } from '../logging/logger.js';

const execFileAsync = promisify(execFile);
const log = createLogger('VaultwardenProvisioner');

const VW_PORT = 8222;
const VW_ADDRESS = '127.0.0.1';

export class VaultwardenProvisioner implements Provisioner {
  readonly id = 'vaultwarden';
  readonly name = 'Vaultwarden';

  private process: ChildProcess | null = null;
  private dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir ?? getVaultwardenDataDir();
  }

  async check(): Promise<boolean> {
    // Check if Vaultwarden is responding on its port
    try {
      const response = await fetch(`http://${VW_ADDRESS}:${VW_PORT}/alive`);
      return response.ok;
    } catch {
      // Check if data dir has been provisioned
      return existsSync(join(this.dataDir, 'config.json'));
    }
  }

  async provision(onProgress?: (p: ProvisioningProgress) => void): Promise<void> {
    const progress = (message: string, percent?: number) => {
      onProgress?.({ service: this.id, status: ProvisioningStatus.Running, message, percent });
    };

    // Step 1: Create data directory
    progress('Creating data directory...', 10);
    mkdirSync(this.dataDir, { recursive: true });

    // Step 2: Generate admin token
    progress('Generating admin token...', 30);
    const adminToken = randomBytes(32).toString('hex');
    const configPath = join(this.dataDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({
      adminToken,
      createdAt: new Date().toISOString(),
    }, null, 2), 'utf-8');

    // Step 3: Start Vaultwarden
    progress('Starting Vaultwarden...', 50);
    await this.start();

    // Step 4: Wait for Vaultwarden to be ready
    progress('Waiting for Vaultwarden...', 70);
    await this.waitForReady(15);

    // Step 5: Configure Bitwarden CLI to point at local server
    progress('Configuring Bitwarden CLI...', 85);
    await this.configureBwCli();

    progress('Vaultwarden ready', 100);
  }

  async start(): Promise<void> {
    // Check if already running
    try {
      const response = await fetch(`http://${VW_ADDRESS}:${VW_PORT}/alive`);
      if (response.ok) {
        log.info('Vaultwarden already running.');
        return;
      }
    } catch {
      // Not running, proceed
    }

    const vwBin = resolveVaultwardenBin();
    const logFile = join(getDataDir(), 'vaultwarden.log');

    // Read admin token from config
    let adminToken = '';
    const configPath = join(this.dataDir, 'config.json');
    if (existsSync(configPath)) {
      try {
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        adminToken = config.adminToken ?? '';
      } catch {
        // Ignore
      }
    }

    this.process = spawn(vwBin, [], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ROCKET_PORT: String(VW_PORT),
        ROCKET_ADDRESS: VW_ADDRESS,
        DATA_FOLDER: this.dataDir,
        ADMIN_TOKEN: adminToken,
        LOG_FILE: logFile,
        WEBSOCKET_ENABLED: 'false',
        SENDS_ALLOWED: 'false',
        EMERGENCY_ACCESS_ALLOWED: 'false',
        SIGNUPS_ALLOWED: 'true', // Needed for initial setup
      },
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      log.info('[vaultwarden]', data.toString().trimEnd());
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      log.error('[vaultwarden:err]', data.toString().trimEnd());
    });

    this.process.on('error', (err) => {
      log.error('Vaultwarden process error:', err.message);
      this.process = null;
    });

    this.process.on('exit', (code, signal) => {
      log.warn(`Vaultwarden exited (code=${code}, signal=${signal})`);
      this.process = null;
    });

    log.info('Vaultwarden spawned.');
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      // Wait up to 5s for graceful shutdown
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          if (this.process) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 5_000);
        this.process?.on('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
      this.process = null;
      log.info('Vaultwarden stopped.');
    }
  }

  private async waitForReady(maxRetries: number): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(`http://${VW_ADDRESS}:${VW_PORT}/alive`);
        if (response.ok) return;
      } catch {
        // Not ready yet
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    throw new Error(`Vaultwarden not ready after ${maxRetries} retries`);
  }

  private async configureBwCli(): Promise<void> {
    const bwBin = resolveBwBin();
    try {
      await execFileAsync(bwBin, ['config', 'server', `http://${VW_ADDRESS}:${VW_PORT}`], {
        timeout: 10_000,
      });
      log.info('Bitwarden CLI configured to use local Vaultwarden.');
    } catch (err) {
      log.warn('Failed to configure bw CLI (may not be available yet):', err);
    }
  }
}
