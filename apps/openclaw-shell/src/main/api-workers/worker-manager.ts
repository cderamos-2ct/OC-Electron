import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { SHELL_CONFIG_DIR_NAME } from '../../shared/constants.js';
import type { APIWorkerStatus } from '../../shared/types.js';
import type { CredentialProvider } from './credential-provider.js';

const CREDENTIALS_FILE = join(homedir(), SHELL_CONFIG_DIR_NAME, 'api-credentials.json');

export interface APICredentials {
  [key: string]: unknown;
}

export interface APIWorker {
  name: string;
  pollIntervalMs: number;
  start(): void;
  stop(): void;
  getStatus(): APIWorkerStatus;
  refreshCredentials?(): Promise<void>;
}

interface WorkerEntry {
  worker: APIWorker;
  lastPollAt: string | null;
  errorCount: number;
  consecutiveErrors: number;
  isRunning: boolean;
  intervalHandle: ReturnType<typeof setInterval> | null;
}

export class WorkerManager {
  private workers = new Map<string, WorkerEntry>();
  private credentialProvider: CredentialProvider | null = null;

  setCredentialProvider(provider: CredentialProvider): void {
    this.credentialProvider = provider;
  }

  getCredentialProvider(): CredentialProvider | null {
    return this.credentialProvider;
  }

  static loadCredentials(): APICredentials {
    if (!existsSync(CREDENTIALS_FILE)) {
      return {};
    }
    try {
      const raw = readFileSync(CREDENTIALS_FILE, 'utf-8');
      return JSON.parse(raw) as APICredentials;
    } catch (err) {
      console.warn('[WorkerManager] Failed to load credentials file:', err);
      return {};
    }
  }

  register(worker: APIWorker): void {
    if (this.workers.has(worker.name)) {
      console.warn(`[WorkerManager] Worker "${worker.name}" already registered, skipping.`);
      return;
    }
    this.workers.set(worker.name, {
      worker,
      lastPollAt: null,
      errorCount: 0,
      consecutiveErrors: 0,
      isRunning: false,
      intervalHandle: null,
    });
  }

  startAll(): void {
    for (const [name, entry] of this.workers) {
      try {
        entry.worker.start();
        entry.isRunning = true;
        console.log(`[WorkerManager] Started worker: ${name}`);
      } catch (err) {
        console.error(`[WorkerManager] Failed to start worker "${name}":`, err);
        entry.errorCount++;
        entry.consecutiveErrors++;
      }
    }
  }

  stopAll(): void {
    for (const [name, entry] of this.workers) {
      try {
        entry.worker.stop();
        entry.isRunning = false;
        console.log(`[WorkerManager] Stopped worker: ${name}`);
      } catch (err) {
        console.error(`[WorkerManager] Failed to stop worker "${name}":`, err);
      }
    }
  }

  async refreshAllCredentials(): Promise<void> {
    for (const [name, entry] of this.workers) {
      if (entry.worker.refreshCredentials) {
        try {
          await entry.worker.refreshCredentials();
          console.log(`[WorkerManager] Refreshed credentials for: ${name}`);
        } catch (err) {
          console.error(`[WorkerManager] Failed to refresh credentials for "${name}":`, err);
        }
      }
    }
  }

  recordPoll(workerName: string, success: boolean): void {
    const entry = this.workers.get(workerName);
    if (!entry) return;
    entry.lastPollAt = new Date().toISOString();
    if (success) {
      entry.consecutiveErrors = 0;
    } else {
      entry.errorCount++;
      entry.consecutiveErrors++;
    }
  }

  getAllStatuses(): APIWorkerStatus[] {
    const statuses: APIWorkerStatus[] = [];
    for (const [, entry] of this.workers) {
      statuses.push({
        name: entry.worker.name,
        isRunning: entry.isRunning,
        lastPollAt: entry.lastPollAt,
        errorCount: entry.errorCount,
        consecutiveErrors: entry.consecutiveErrors,
      });
    }
    return statuses;
  }

  getWorker(name: string): APIWorker | undefined {
    return this.workers.get(name)?.worker;
  }
}
