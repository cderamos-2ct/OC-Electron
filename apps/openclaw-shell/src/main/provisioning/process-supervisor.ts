// Process Supervisor — manages all service processes with lifecycle + health monitoring

import type { Provisioner, ProvisioningProgress } from './types.js';
import { ProvisioningStatus } from './types.js';
import { createLogger } from '../logging/logger.js';

const log = createLogger('ProcessSupervisor');

const HEALTH_CHECK_INTERVAL_MS = 30_000; // 30 seconds
const MAX_RESTART_ATTEMPTS = 3;
const RESTART_BACKOFF_MS = 5_000;

interface ManagedService {
  provisioner: Provisioner;
  running: boolean;
  restartCount: number;
  lastRestart?: number;
}

export class ProcessSupervisor {
  private services: ManagedService[] = [];
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private stopping = false;

  /** Register a provisioner to be supervised (call in dependency order) */
  register(provisioner: Provisioner): void {
    this.services.push({
      provisioner,
      running: false,
      restartCount: 0,
    });
  }

  /** Start all services in registration (dependency) order */
  async startAll(): Promise<void> {
    this.stopping = false;
    log.info('Starting all services in dependency order...');

    for (const svc of this.services) {
      try {
        await svc.provisioner.start();
        svc.running = true;
        svc.restartCount = 0;
        log.info(`[${svc.provisioner.id}] Started.`);
      } catch (err) {
        log.error(`[${svc.provisioner.id}] Failed to start:`, err);
        svc.running = false;
      }
    }

    this.startHealthMonitoring();
    log.info('All services started.');
  }

  /** Stop all services in reverse dependency order */
  async stopAll(): Promise<void> {
    this.stopping = true;
    this.stopHealthMonitoring();

    log.info('Stopping all services in reverse order...');

    for (const svc of [...this.services].reverse()) {
      try {
        await svc.provisioner.stop();
        svc.running = false;
        log.info(`[${svc.provisioner.id}] Stopped.`);
      } catch (err) {
        log.error(`[${svc.provisioner.id}] Failed to stop:`, err);
      }
    }

    log.info('All services stopped.');
  }

  /** Start a single service by id */
  async startService(id: string): Promise<void> {
    const svc = this.services.find((s) => s.provisioner.id === id);
    if (!svc) {
      log.warn(`Unknown service: ${id}`);
      return;
    }

    try {
      await svc.provisioner.start();
      svc.running = true;
      svc.restartCount = 0;
      log.info(`[${id}] Started.`);
    } catch (err) {
      log.error(`[${id}] Failed to start:`, err);
      svc.running = false;
    }
  }

  /** Stop a single service by id */
  async stopService(id: string): Promise<void> {
    const svc = this.services.find((s) => s.provisioner.id === id);
    if (!svc) {
      log.warn(`Unknown service: ${id}`);
      return;
    }

    try {
      await svc.provisioner.stop();
      svc.running = false;
      log.info(`[${id}] Stopped.`);
    } catch (err) {
      log.error(`[${id}] Failed to stop:`, err);
    }
  }

  /** Get status of all managed services */
  getStatus(): Array<{ id: string; name: string; running: boolean; restartCount: number }> {
    return this.services.map((svc) => ({
      id: svc.provisioner.id,
      name: svc.provisioner.name,
      running: svc.running,
      restartCount: svc.restartCount,
    }));
  }

  private startHealthMonitoring(): void {
    if (this.healthTimer) return;

    this.healthTimer = setInterval(async () => {
      if (this.stopping) return;

      for (const svc of this.services) {
        if (!svc.running || this.stopping) continue;

        try {
          const healthy = await svc.provisioner.check();
          if (!healthy && svc.running && !this.stopping) {
            log.warn(`[${svc.provisioner.id}] Health check failed, attempting restart...`);
            await this.restartService(svc);
          }
        } catch (err) {
          log.error(`[${svc.provisioner.id}] Health check error:`, err);
        }
      }
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  private stopHealthMonitoring(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  private async restartService(svc: ManagedService): Promise<void> {
    if (svc.restartCount >= MAX_RESTART_ATTEMPTS) {
      log.error(`[${svc.provisioner.id}] Max restart attempts (${MAX_RESTART_ATTEMPTS}) reached. Service disabled.`);
      svc.running = false;
      return;
    }

    // Backoff: don't restart too quickly
    const now = Date.now();
    if (svc.lastRestart && now - svc.lastRestart < RESTART_BACKOFF_MS) {
      return;
    }

    svc.restartCount++;
    svc.lastRestart = now;

    try {
      await svc.provisioner.stop();
    } catch {
      // Ignore stop errors during restart
    }

    try {
      await svc.provisioner.start();
      svc.running = true;
      log.info(`[${svc.provisioner.id}] Restarted (attempt ${svc.restartCount}).`);
    } catch (err) {
      log.error(`[${svc.provisioner.id}] Restart failed:`, err);
      svc.running = false;
    }
  }
}
