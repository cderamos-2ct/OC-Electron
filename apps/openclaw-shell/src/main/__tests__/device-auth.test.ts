import { generateKeyPairSync, createHash, createPublicKey } from 'crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let fakeHome = '';

function makeLegacyIdentity() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const jwkPublic = createPublicKey(publicKeyPem).export({ format: 'jwk' }) as { x: string };
  const deviceId = createHash('sha256')
    .update(Buffer.from(jwkPublic.x, 'base64url'))
    .digest('hex');

  return {
    version: 1 as const,
    deviceId,
    publicKeyPem,
    privateKeyPem,
    createdAtMs: 1772810027185,
  };
}

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os');
  return {
    ...actual,
    homedir: () => fakeHome,
    hostname: () => 'test-host',
    platform: () => 'darwin',
  };
});

describe('shell device auth compatibility', () => {
  beforeEach(() => {
    vi.resetModules();
    fakeHome = mkdtempSync(join(tmpdir(), 'openclaw-auth-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('imports a legacy gateway identity into the shell identity store', async () => {
    mkdirSync(join(fakeHome, '.openclaw', 'identity'), { recursive: true });
    const legacyIdentity = makeLegacyIdentity();
    writeFileSync(
      join(fakeHome, '.openclaw', 'identity', 'device.json'),
      JSON.stringify(legacyIdentity, null, 2),
      'utf-8',
    );

    const mod = await import('../device-identity.js');
    const identity = await mod.loadOrCreateDeviceIdentity();

    expect(identity.deviceId).toBe(legacyIdentity.deviceId);
    const stored = JSON.parse(
      readFileSync(join(fakeHome, '.openclaw-shell', 'device-identity.json'), 'utf-8'),
    ) as { deviceId: string; publicKey: string; privateKey: string };
    expect(stored.deviceId).toBe(legacyIdentity.deviceId);
    expect(stored.publicKey).toBe(identity.publicKey);
    expect(stored.privateKey).toBe(identity.privateKey);
  });

  it('replaces a stale shell identity with the paired legacy gateway identity', async () => {
    mkdirSync(join(fakeHome, '.openclaw', 'identity'), { recursive: true });
    mkdirSync(join(fakeHome, '.openclaw-shell'), { recursive: true });
    const legacyIdentity = makeLegacyIdentity();
    writeFileSync(
      join(fakeHome, '.openclaw', 'identity', 'device.json'),
      JSON.stringify(legacyIdentity, null, 2),
      'utf-8',
    );
    writeFileSync(
      join(fakeHome, '.openclaw-shell', 'device-identity.json'),
      JSON.stringify({
        version: 1,
        deviceId: 'stale-shell-id',
        publicKey: 'stale-public',
        privateKey: 'stale-private',
        createdAtMs: 1,
      }),
      'utf-8',
    );

    const mod = await import('../device-identity.js');
    const identity = await mod.loadOrCreateDeviceIdentity();

    expect(identity.deviceId).toBe(legacyIdentity.deviceId);
    const stored = JSON.parse(
      readFileSync(join(fakeHome, '.openclaw-shell', 'device-identity.json'), 'utf-8'),
    ) as { deviceId: string };
    expect(stored.deviceId).toBe(legacyIdentity.deviceId);
  });

  it('falls back to the legacy gateway device-auth token store and migrates it locally', async () => {
    mkdirSync(join(fakeHome, '.openclaw', 'identity'), { recursive: true });
    const legacyStore = {
      version: 1,
      deviceId: 'device-123',
      tokens: {
        operator: {
          token: 'legacy-token',
          role: 'operator',
          scopes: ['operator.admin', 'operator.read'],
          updatedAtMs: 123,
        },
      },
    };
    writeFileSync(
      join(fakeHome, '.openclaw', 'identity', 'device-auth.json'),
      JSON.stringify(legacyStore, null, 2),
      'utf-8',
    );

    const mod = await import('../device-auth.js');
    const token = mod.loadDeviceAuthToken({ deviceId: 'device-123', role: 'operator' });

    expect(token?.token).toBe('legacy-token');
    const migrated = JSON.parse(
      readFileSync(join(fakeHome, '.openclaw-shell', 'device-auth.json'), 'utf-8'),
    ) as { deviceId: string; tokens: { operator: { token: string } } };
    expect(migrated.deviceId).toBe('device-123');
    expect(migrated.tokens.operator.token).toBe('legacy-token');
  });
});
