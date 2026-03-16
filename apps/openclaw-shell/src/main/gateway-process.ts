import { spawn, ChildProcess } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { app } from 'electron';
import WebSocket from 'ws';
import {
  GATEWAY_URL,
  GATEWAY_PID_FILE,
  GATEWAY_PROBE_TIMEOUT_MS,
  GATEWAY_HEALTH_INTERVAL_MS,
  RUNTIME_DIR,
} from '../shared/constants.js';

const BACKOFF_INITIAL_MS = 1_000;
const BACKOFF_CEILING_MS = 15_000;

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
      console.log('[GatewayProcessManager] Gateway already running, connecting to existing.');
      this.weStartedIt = false;
      this.startHealthCheck();
      return;
    }

    console.log('[GatewayProcessManager] Gateway not found, starting child process.');
    this.weStartedIt = true;
    this.spawnGateway();
    this.startHealthCheck();
  }

  private spawnGateway(): void {
    if (this.stopping) return;

    // In a packaged app, bare 'node' is not on PATH — use process.execPath
    // (Electron's own Node runtime) when no explicit GATEWAY_BIN is set and
    // the app is packaged. In development, fall back to bare 'node'.
    let gatewayBin: string;
    let gatewayArgs: string[];

    if (process.env.GATEWAY_BIN) {
      gatewayBin = process.env.GATEWAY_BIN;
      gatewayArgs = process.env.GATEWAY_ARGS?.split(' ') ?? [];
    } else if (app.isPackaged) {
      // Packaged: no gateway to spawn — gateway must be run externally.
      // Log a warning and bail out gracefully; the app will show "offline".
      console.warn('[GatewayProcessManager] Running packaged — no bundled gateway to spawn. Connect to an external gateway or set GATEWAY_BIN.');
      this.weStartedIt = false;
      return;
    } else {
      // Development: try to spawn the local dashboard server
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
      console.warn('[GatewayProcessManager] Failed to spawn gateway — app will run in offline mode:', err);
      this.gatewayProcess = null;
      this.weStartedIt = false;
      return;
    }

    if (this.gatewayProcess.pid !== undefined) {
      this.writePidFile(this.gatewayProcess.pid);
    }

    this.gatewayProcess.stdout?.on('data', (data: Buffer) => {
      console.log('[gateway]', data.toString().trimEnd());
    });

    this.gatewayProcess.stderr?.on('data', (data: Buffer) => {
      console.error('[gateway:err]', data.toString().trimEnd());
    });

    this.gatewayProcess.on('error', (err) => {
      // Catches ENOENT / EACCES at the OS level after spawn() returns
      console.warn('[GatewayProcessManager] Gateway process error — running in offline mode:', err.message);
      this.gatewayProcess = null;
      this.weStartedIt = false;
    });

    this.gatewayProcess.on('exit', (code, signal) => {
      console.warn(`[GatewayProcessManager] Gateway exited (code=${code}, signal=${signal})`);
      this.gatewayProcess = null;

      if (!this.stopping && this.weStartedIt) {
        console.log(`[GatewayProcessManager] Restarting in ${this.backoffMs}ms...`);
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

  private writePidFile(pid: number): void {
    try {
      if (!existsSync(RUNTIME_DIR)) {
        mkdirSync(RUNTIME_DIR, { recursive: true });
      }
      writeFileSync(GATEWAY_PID_FILE, String(pid), 'utf-8');
    } catch (err) {
      console.error('[GatewayProcessManager] Failed to write PID file:', err);
    }
  }

  private startHealthCheck(): void {
    if (this.healthTimer) return;

    this.healthTimer = setInterval(async () => {
      const alive = await this.probe();
      if (!alive && this.weStartedIt && !this.gatewayProcess && !this.stopping) {
        console.warn('[GatewayProcessManager] Health check failed, restarting gateway.');
        this.spawnGateway();
      }
    }, GATEWAY_HEALTH_INTERVAL_MS);
  }

  stop(): void {
    // Disconnect only — do NOT kill the gateway (other clients may be connected)
    this.stopping = true;

    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }

    // Remove exit listeners so we don't auto-restart
    if (this.gatewayProcess) {
      this.gatewayProcess.removeAllListeners('exit');
      // Detach from the process without killing it
      this.gatewayProcess.unref();
      this.gatewayProcess = null;
    }

    console.log('[GatewayProcessManager] Disconnected from gateway (process left running).');
  }

  async healthCheck(): Promise<boolean> {
    return this.probe();
  }
}
