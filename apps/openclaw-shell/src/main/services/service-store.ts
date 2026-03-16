import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import os from 'os';
import type { ServiceConfig } from '../../shared/types.js';

const SERVICES_DIR = join(os.homedir(), '.openclaw-shell');
const SERVICES_FILE = join(SERVICES_DIR, 'services.json');

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function ensureDir(): void {
  if (!existsSync(SERVICES_DIR)) {
    mkdirSync(SERVICES_DIR, { recursive: true });
  }
}

function persistNow(services: ServiceConfig[]): void {
  ensureDir();
  writeFileSync(SERVICES_FILE, JSON.stringify(services, null, 2), 'utf-8');
}

function scheduleSave(services: ServiceConfig[]): void {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    persistNow(services);
    saveTimer = null;
  }, 500);
}

export class ServiceStore {
  private services: ServiceConfig[];

  constructor() {
    this.services = this._load();
  }

  private _load(): ServiceConfig[] {
    if (!existsSync(SERVICES_FILE)) return [];
    try {
      const raw = readFileSync(SERVICES_FILE, 'utf-8');
      return JSON.parse(raw) as ServiceConfig[];
    } catch {
      return [];
    }
  }

  list(): ServiceConfig[] {
    return [...this.services];
  }

  get(id: string): ServiceConfig | undefined {
    return this.services.find((s) => s.id === id);
  }

  add(config: ServiceConfig): ServiceConfig {
    const existing = this.services.find((s) => s.id === config.id);
    if (existing) return existing;
    this.services.push(config);
    scheduleSave(this.services);
    return config;
  }

  update(id: string, patch: Partial<ServiceConfig>): ServiceConfig | undefined {
    const idx = this.services.findIndex((s) => s.id === id);
    if (idx === -1) return undefined;
    this.services[idx] = { ...this.services[idx], ...patch, id };
    scheduleSave(this.services);
    return this.services[idx];
  }

  remove(id: string): boolean {
    const before = this.services.length;
    this.services = this.services.filter((s) => s.id !== id);
    if (this.services.length !== before) {
      scheduleSave(this.services);
      return true;
    }
    return false;
  }

  reorder(orderedIds: string[]): ServiceConfig[] {
    const map = new Map(this.services.map((s) => [s.id, s]));
    const reordered: ServiceConfig[] = [];
    orderedIds.forEach((id, idx) => {
      const s = map.get(id);
      if (s) reordered.push({ ...s, order: idx });
    });
    // append any services not in orderedIds at the end
    this.services.forEach((s) => {
      if (!orderedIds.includes(s.id)) {
        reordered.push({ ...s, order: reordered.length });
      }
    });
    this.services = reordered;
    scheduleSave(this.services);
    return [...this.services];
  }
}
