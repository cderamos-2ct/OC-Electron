import { spawn, execSync, ChildProcess } from 'child_process';
import { writeFileSync, readFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { app } from 'electron';
import WebSocket from 'ws';
import {
  GATEWAY_URL,
  GATEWAY_PID_FILE,
  GATEWAY_PROBE_TIMEOUT_MS,
  GATEWAY_HEALTH_INTERVAL_MS,
  RUNTIME_DIR,
} from '../shared/constants.js';
import { createLogger } from './logging/logger.js';

const log = createLogger('GatewayProcessManager');

const BACKOFF_INITIAL_MS = 1_000;
const BACKOFF_CEILING_MS = 15_000;

// Auto-provisioned gateway lives in the app's data directory
const GATEWAY_INSTALL_DIR = join(homedir(), '.aegilume', 'gateway');
const GATEWAY_ENTRY = join(GATEWAY_INSTALL_DIR, 'node_modules', 'openclaw', 'openclaw.mjs');

export class GatewayProcessManager {
  private gatewayProcess: ChildProcess | null = null;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private weStartedIt = false;
  private backoffMs = BACKOFF_INITIAL_MS;
  private stopping = false;

  async probe(): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        ws.terminate();
        resolve(false);
      }, GATEWAY_PROBE_TIMEOUT_MS);

      const ws = new WebSocket(GATEWAY_URL);

      ws.on('open', () => {
        clearTimeout(timer);
        ws.close();
        resolve(true);
      });

      ws.on('error', () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
  }

  async start(): Promise<void> {
    const alive = await this.probe();
    if (alive) {
      log.info('Gateway already running, connecting to existing.');
      this.weStartedIt = false;
      this.startHealthCheck();
      return;
    }

    // Kill stale gateway from previous session
    this.cleanupStaleGateway();

    log.info('Gateway not found, starting child process.');
    this.weStartedIt = true;

    // Ensure gateway is installed before spawning
    if (app.isPackaged) {
      await this.ensureGatewayInstalled();
    }

    this.spawnGateway();
    this.startHealthCheck();
  }

  /**
   * Auto-provision: install openclaw into ~/.aegilume/gateway/ on first launch.
   * Like VS Code installing extensions — uses npm to pull the package.
   */
  private async ensureGatewayInstalled(): Promise<void> {
    if (existsSync(GATEWAY_ENTRY)) {
      log.info('Gateway already provisioned.');
      return;
    }

    log.info('First launch — installing openclaw gateway...');

    if (!existsSync(GATEWAY_INSTALL_DIR)) {
      mkdirSync(GATEWAY_INSTALL_DIR, { recursive: true });
    }

    // Create a minimal package.json so npm installs into this directory
    const pkgJsonPath = join(GATEWAY_INSTALL_DIR, 'package.json');
    if (!existsSync(pkgJsonPath)) {
      writeFileSync(pkgJsonPath, JSON.stringify({
        name: 'aegilume-gateway',
        version: '1.0.0',
        private: true,
      }), 'utf-8');
    }

    try {
      // Use system npm to install openclaw
      const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      execSync(`${npmBin} install openclaw --omit=dev --ignore-scripts`, {
        cwd: GATEWAY_INSTALL_DIR,
        stdio: 'pipe',
        timeout: 120_000, // 2 minute timeout
        env: { ...process.env, NODE_ENV: 'production' },
      });
      log.info('Gateway installed successfully.');
    } catch (err) {
      log.error('Failed to install gateway:', err);
      throw new Error('Gateway auto-provision failed. Check network connectivity.');
    }
  }

  private spawnGateway(): void {
    if (this.stopping) return;

    let gatewayBin: string;
    let gatewayArgs: string[];

    if (process.env.GATEWAY_BIN) {
      // Explicit override
      gatewayBin = process.env.GATEWAY_BIN;
      gatewayArgs = process.env.GATEWAY_ARGS?.split(' ') ?? [];
    } else if (app.isPackaged) {
      // Packaged: use auto-provisioned gateway or system-installed openclaw
      if (existsSync(GATEWAY_ENTRY)) {
        gatewayBin = 'node';
        gatewayArgs = [GATEWAY_ENTRY, 'gateway', '--port', '18789'];
        log.info('Using auto-provisioned gateway.');
      } else {
        // Fallback: check system PATH
        const systemPaths = ['/opt/homebrew/bin/openclaw', '/usr/local/bin/openclaw'];
        const found = systemPaths.find((p) => existsSync(p));
        if (found) {
          gatewayBin = found;
          gatewayArgs = ['gateway', '--port', '18789'];
          log.info(`Using system openclaw at ${found}`);
        } else {
          log.warn('Gateway not available — app will run in offline mode.');
          this.weStartedIt = false;
          return;
        }
      }
    } else {
      // Development: spawn the local dashboard server
      gatewayBin = 'node';
      gatewayArgs = process.env.GATEWAY_ARGS?.split(' ') ?? [
        '/Volumes/Storage/OpenClaw/dashboard/server.cjs',
      ];
    }

    try {
      this.gatewayProcess = spawn(gatewayBin, gatewayArgs, {
        detached: false,
        stdio: 'pipe',
        env: { ...process.env },
      });
    } catch (err) {
      log.warn('Failed to spawn gateway — app will run in offline mode:', err);
      this.gatewayProcess = null;
      this.weStartedIt = false;
      return;
    }

    if (this.gatewayProcess.pid !== undefined) {
      this.writePidFile(this.gatewayProcess.pid);
    }

    this.gatewayProcess.stdout?.on('data', (data: Buffer) => {
      log.info('[gateway]', data.toString().trimEnd());
    });

    this.gatewayProcess.stderr?.on('data', (data: Buffer) => {
      log.error('[gateway:err]', data.toString().trimEnd());
    });

    this.gatewayProcess.on('error', (err) => {
      log.warn('Gateway process error — running in offline mode:', err.message);
      this.gatewayProcess = null;
      this.weStartedIt = false;
    });

    this.gatewayProcess.on('exit', (code, signal) => {
      log.warn(`Gateway exited (code=${code}, signal=${signal})`);
      this.gatewayProcess = null;

      if (!this.stopping && this.weStartedIt) {
        log.info(`Restarting in ${this.backoffMs}ms...`);
        setTimeout(() => {
          this.backoffMs = Math.min(this.backoffMs * 2, BACKOFF_CEILING_MS);
          this.spawnGateway();
        }, this.backoffMs);
      }
    });

    // Reset backoff on successful start
    setTimeout(() => {
      this.backoffMs = BACKOFF_INITIAL_MS;
    }, 5_000);
  }

  private cleanupStaleGateway(): void {
    try {
      if (!existsSync(GATEWAY_PID_FILE)) return;
      const stalePid = parseInt(readFileSync(GATEWAY_PID_FILE, 'utf-8').trim(), 10);
      if (stalePid > 0) {
        try {
          process.kill(stalePid, 'SIGTERM');
          log.info(`Killed stale gateway (PID ${stalePid})`);
        } catch {
          // Already dead — fine
        }
      }
      unlinkSync(GATEWAY_PID_FILE);
    } catch (err) {
      log.warn('Stale gateway cleanup failed (non-fatal):', err);
    }
  }

  private writePidFile(pid: number): void {
    try {
      if (!existsSync(RUNTIME_DIR)) {
        mkdirSync(RUNTIME_DIR, { recursive: true });
      }
      writeFileSync(GATEWAY_PID_FILE, String(pid), 'utf-8');
    } catch (err) {
      log.error('Failed to write PID file:', err);
    }
  }

  private startHealthCheck(): void {
    if (this.healthTimer) return;

    this.healthTimer = setInterval(async () => {
      const alive = await this.probe();
      if (!alive && this.weStartedIt && !this.gatewayProcess && !this.stopping) {
        log.warn('Health check failed, restarting gateway.');
        this.spawnGateway();
      }
    }, GATEWAY_HEALTH_INTERVAL_MS);
  }

  stop(): void {
    this.stopping = true;

    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }

    if (this.gatewayProcess) {
      this.gatewayProcess.removeAllListeners('exit');
      this.gatewayProcess.unref();
      this.gatewayProcess = null;
    }

    log.info('Disconnected from gateway (process left running).');
  }

  async healthCheck(): Promise<boolean> {
    return this.probe();
  }
}
