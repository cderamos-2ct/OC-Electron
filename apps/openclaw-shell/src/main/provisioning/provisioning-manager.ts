// Provisioning manager — orchestrates all provisioners in dependency order

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { BrowserWindow } from 'electron';
import type { Provisioner, ProvisioningProgress, ProvisioningState, ProvisioningStepState } from './types.js';
import { ProvisioningStatus } from './types.js';
import { getProvisioningStatePath } from './platform.js';
import { createLogger } from '../logging/logger.js';

const log = createLogger('ProvisioningManager');

export class ProvisioningManager {
  private provisioners: Provisioner[] = [];
  private state: ProvisioningState;
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    this.state = this.loadState() ?? {
      version: 1,
      startedAt: new Date().toISOString(),
      steps: {},
    };
  }

  setMainWindow(win: BrowserWindow): void {
    this.mainWindow = win;
  }

  /** Register provisioners in dependency order */
  register(provisioner: Provisioner): void {
    this.provisioners.push(provisioner);
    if (!this.state.steps[provisioner.id]) {
      this.state.steps[provisioner.id] = {
        status: ProvisioningStatus.Pending,
        message: 'Not started',
      };
    }
  }

  getState(): ProvisioningState {
    return this.state;
  }

  getStepState(serviceId: string): ProvisioningStepState | undefined {
    return this.state.steps[serviceId];
  }

  getProvisioner(serviceId: string): Provisioner | undefined {
    return this.provisioners.find((p) => p.id === serviceId);
  }

  isComplete(): boolean {
    return this.provisioners.every(
      (p) => {
        const step = this.state.steps[p.id];
        return step?.status === ProvisioningStatus.Success || step?.status === ProvisioningStatus.Skipped;
      }
    );
  }

  /** Run all provisioners in order, skipping already-completed steps */
  async runAll(): Promise<void> {
    for (const provisioner of this.provisioners) {
      const step = this.state.steps[provisioner.id];
      if (step?.status === ProvisioningStatus.Success || step?.status === ProvisioningStatus.Skipped) {
        log.info(`[${provisioner.id}] Already complete, skipping.`);
        continue;
      }
      await this.runStep(provisioner.id);
    }
    this.state.completedAt = new Date().toISOString();
    this.saveState();
  }

  /** Run a single provisioning step */
  async runStep(serviceId: string): Promise<void> {
    const provisioner = this.provisioners.find((p) => p.id === serviceId);
    if (!provisioner) {
      throw new Error(`Unknown provisioner: ${serviceId}`);
    }

    this.updateStep(serviceId, ProvisioningStatus.Running, 'Checking...');

    try {
      // Check if already provisioned
      const alreadyDone = await provisioner.check();
      if (alreadyDone) {
        this.updateStep(serviceId, ProvisioningStatus.Success, 'Already provisioned');
        log.info(`[${serviceId}] Already provisioned.`);
        return;
      }

      // Run provisioning
      this.updateStep(serviceId, ProvisioningStatus.Running, 'Provisioning...');
      await provisioner.provision((progress) => {
        this.emitProgress(progress);
      });

      this.updateStep(serviceId, ProvisioningStatus.Success, 'Complete');
      log.info(`[${serviceId}] Provisioning complete.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.updateStep(serviceId, ProvisioningStatus.Failed, message);
      log.error(`[${serviceId}] Provisioning failed:`, err);
      throw err;
    }
  }

  /** Skip a provisioning step */
  skipStep(serviceId: string): void {
    this.updateStep(serviceId, ProvisioningStatus.Skipped, 'Skipped by user');
    this.saveState();
  }

  /** Retry a failed step */
  async retryStep(serviceId: string): Promise<void> {
    this.updateStep(serviceId, ProvisioningStatus.Pending, 'Retrying...');
    await this.runStep(serviceId);
  }

  /** Start all successfully provisioned services in order */
  async startAll(): Promise<void> {
    for (const provisioner of this.provisioners) {
      const step = this.state.steps[provisioner.id];
      if (step?.status === ProvisioningStatus.Success) {
        try {
          await provisioner.start();
          log.info(`[${provisioner.id}] Started.`);
        } catch (err) {
          log.error(`[${provisioner.id}] Failed to start:`, err);
        }
      }
    }
  }

  /** Stop all services in reverse order */
  async stopAll(): Promise<void> {
    for (const provisioner of [...this.provisioners].reverse()) {
      try {
        await provisioner.stop();
        log.info(`[${provisioner.id}] Stopped.`);
      } catch (err) {
        log.error(`[${provisioner.id}] Failed to stop:`, err);
      }
    }
  }

  private updateStep(serviceId: string, status: ProvisioningStatus, message: string): void {
    this.state.steps[serviceId] = {
      status,
      message,
      ...(status === ProvisioningStatus.Success ? { completedAt: new Date().toISOString() } : {}),
      ...(status === ProvisioningStatus.Failed ? { error: message } : {}),
    };
    this.saveState();
    this.emitProgress({
      service: serviceId,
      status,
      message,
    });
  }

  private emitProgress(progress: ProvisioningProgress): void {
    this.mainWindow?.webContents.send('provisioning:progress', progress);
  }

  private loadState(): ProvisioningState | null {
    const path = getProvisioningStatePath();
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, 'utf-8')) as ProvisioningState;
    } catch {
      return null;
    }
  }

  private saveState(): void {
    try {
      writeFileSync(getProvisioningStatePath(), JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      log.error('Failed to save provisioning state:', err);
    }
  }
}
