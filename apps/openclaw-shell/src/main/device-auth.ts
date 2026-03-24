// Device auth token management for Node.js (Electron Main process)
// Ported from dashboard/lib/device-auth.ts — replaces localStorage with file persistence
// Re-uses the platform-agnostic device-auth-store logic via adapter pattern

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import {
  clearDeviceAuthTokenFromStore,
  loadDeviceAuthTokenFromStore,
  storeDeviceAuthTokenInStore,
  type DeviceAuthEntry,
  type DeviceAuthStore,
} from './device-auth-store.js';

const CONFIG_DIR = join(homedir(), '.openclaw-shell');
const AUTH_FILE = join(CONFIG_DIR, 'device-auth.json');
const LEGACY_AUTH_FILE = join(homedir(), '.openclaw', 'identity', 'device-auth.json');

function ensureConfigDir() {
  mkdirSync(CONFIG_DIR, { recursive: true });
}

function readStore(): DeviceAuthStore | null {
  try {
    const raw = readFileSync(AUTH_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as DeviceAuthStore;
    if (
      !parsed ||
      parsed.version !== 1 ||
      typeof parsed.deviceId !== 'string' ||
      typeof parsed.tokens !== 'object'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function readLegacyStore(): DeviceAuthStore | null {
  try {
    const raw = readFileSync(LEGACY_AUTH_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as DeviceAuthStore;
    if (
      !parsed ||
      parsed.version !== 1 ||
      typeof parsed.deviceId !== 'string' ||
      typeof parsed.tokens !== 'object'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStore(store: DeviceAuthStore) {
  ensureConfigDir();
  writeFileSync(AUTH_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

const adapter = { readStore, writeStore };

export function loadDeviceAuthToken(params: {
  deviceId: string;
  role: string;
}): DeviceAuthEntry | null {
  const local = loadDeviceAuthTokenFromStore({
    adapter,
    deviceId: params.deviceId,
    role: params.role,
  });
  if (local) {
    return local;
  }

  const legacy = readLegacyStore();
  if (!legacy || legacy.deviceId !== params.deviceId) {
    return null;
  }

  const entry = legacy.tokens[params.role] ?? null;
  if (entry) {
    writeStore(legacy);
  }
  return entry;
}

export function storeDeviceAuthToken(params: {
  deviceId: string;
  role: string;
  token: string;
  scopes?: string[];
}): DeviceAuthEntry {
  return storeDeviceAuthTokenInStore({
    adapter,
    deviceId: params.deviceId,
    role: params.role,
    token: params.token,
    scopes: params.scopes,
  });
}

export function clearDeviceAuthToken(params: { deviceId: string; role: string }) {
  clearDeviceAuthTokenFromStore({
    adapter,
    deviceId: params.deviceId,
    role: params.role,
  });
}

export type { DeviceAuthEntry, DeviceAuthStore };
