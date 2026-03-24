// Device identity management for Node.js (Electron Main process)
// Ported from dashboard/lib/device-identity.ts — replaces browser APIs with node:crypto + file persistence

import { createHash, createPrivateKey, createPublicKey } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform, hostname } from 'node:os';
import { getPublicKeyAsync, signAsync, utils } from '@noble/ed25519';

type StoredIdentity = {
  version: 1;
  deviceId: string;
  publicKey: string;
  privateKey: string;
  createdAtMs: number;
};

export type DeviceIdentity = {
  deviceId: string;
  publicKey: string;
  privateKey: string;
};

const CONFIG_DIR = join(homedir(), '.openclaw-shell');
const IDENTITY_FILE = join(CONFIG_DIR, 'device-identity.json');
const LEGACY_CONFIG_DIR = join(homedir(), '.openclaw', 'identity');
const LEGACY_IDENTITY_FILE = join(LEGACY_CONFIG_DIR, 'device.json');

type LegacyStoredIdentity = {
  version: 1;
  deviceId: string;
  publicKeyPem: string;
  privateKeyPem: string;
  createdAtMs: number;
};

function ensureConfigDir() {
  mkdirSync(CONFIG_DIR, { recursive: true });
}

function base64UrlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

function base64UrlDecode(input: string): Uint8Array {
  return new Uint8Array(Buffer.from(input, 'base64url'));
}

function fingerprintPublicKey(publicKey: Uint8Array): string {
  return createHash('sha256').update(publicKey).digest('hex');
}

async function generateIdentity(): Promise<DeviceIdentity> {
  const privateKey = utils.randomSecretKey();
  const publicKey = await getPublicKeyAsync(privateKey);
  const deviceId = fingerprintPublicKey(publicKey);
  return {
    deviceId,
    publicKey: base64UrlEncode(publicKey),
    privateKey: base64UrlEncode(privateKey),
  };
}

function readStoredIdentity(): StoredIdentity | null {
  try {
    const raw = readFileSync(IDENTITY_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as StoredIdentity;
    if (
      parsed?.version === 1 &&
      typeof parsed.deviceId === 'string' &&
      typeof parsed.publicKey === 'string' &&
      typeof parsed.privateKey === 'string'
    ) {
      return parsed;
    }
  } catch {
    // file doesn't exist or is corrupt — regenerate below
  }
  return null;
}

function readLegacyStoredIdentity(): LegacyStoredIdentity | null {
  try {
    const raw = readFileSync(LEGACY_IDENTITY_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as LegacyStoredIdentity;
    if (
      parsed?.version === 1 &&
      typeof parsed.deviceId === 'string' &&
      typeof parsed.publicKeyPem === 'string' &&
      typeof parsed.privateKeyPem === 'string'
    ) {
      return parsed;
    }
  } catch {
    // missing or unreadable legacy identity
  }
  return null;
}

export function convertLegacyIdentity(legacy: LegacyStoredIdentity): DeviceIdentity {
  const jwkPublic = createPublicKey(legacy.publicKeyPem).export({ format: 'jwk' }) as { x: string };
  const jwkPrivate = createPrivateKey(legacy.privateKeyPem).export({ format: 'jwk' }) as { d: string };
  const publicKey = jwkPublic.x;
  const privateKey = jwkPrivate.d;
  const derivedId = fingerprintPublicKey(base64UrlDecode(publicKey));

  return {
    deviceId: derivedId,
    publicKey,
    privateKey,
  };
}

function writeStoredIdentity(identity: StoredIdentity) {
  ensureConfigDir();
  writeFileSync(IDENTITY_FILE, JSON.stringify(identity, null, 2), 'utf-8');
}

export async function loadOrCreateDeviceIdentity(): Promise<DeviceIdentity> {
  const stored = readStoredIdentity();
  const legacy = readLegacyStoredIdentity();

  if (!stored && legacy) {
    const imported = convertLegacyIdentity(legacy);
    writeStoredIdentity({
      version: 1,
      deviceId: imported.deviceId,
      publicKey: imported.publicKey,
      privateKey: imported.privateKey,
      createdAtMs: legacy.createdAtMs,
    });
    return imported;
  }

  if (stored) {
    if (legacy) {
      const imported = convertLegacyIdentity(legacy);
      if (stored.deviceId !== imported.deviceId) {
        writeStoredIdentity({
          version: 1,
          deviceId: imported.deviceId,
          publicKey: imported.publicKey,
          privateKey: imported.privateKey,
          createdAtMs: legacy.createdAtMs,
        });
        return imported;
      }
    }

    const derivedId = fingerprintPublicKey(base64UrlDecode(stored.publicKey));
    if (derivedId !== stored.deviceId) {
      const updated: StoredIdentity = { ...stored, deviceId: derivedId };
      writeStoredIdentity(updated);
      return {
        deviceId: derivedId,
        publicKey: stored.publicKey,
        privateKey: stored.privateKey,
      };
    }
    return {
      deviceId: stored.deviceId,
      publicKey: stored.publicKey,
      privateKey: stored.privateKey,
    };
  }

  const identity = await generateIdentity();
  writeStoredIdentity({
    version: 1,
    deviceId: identity.deviceId,
    publicKey: identity.publicKey,
    privateKey: identity.privateKey,
    createdAtMs: Date.now(),
  });
  return identity;
}

export async function signDevicePayload(privateKeyBase64Url: string, payload: string): Promise<string> {
  const key = base64UrlDecode(privateKeyBase64Url);
  const data = new TextEncoder().encode(payload);
  const signature = await signAsync(data, key);
  return base64UrlEncode(signature);
}

/** Returns a user-agent-like string for this platform (replaces navigator.userAgent) */
export function getPlatformInfo(): { platform: string; userAgent: string; deviceFamily: string } {
  const p = platform();
  const h = hostname();
  return {
    platform: p,
    userAgent: `OpenClawShell/1.0 (${p}; ${h})`,
    deviceFamily: p === 'darwin' ? 'Mac' : p,
  };
}
