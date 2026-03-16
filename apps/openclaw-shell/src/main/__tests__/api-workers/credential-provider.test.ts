// Tests for api-workers/credential-provider.ts
// Three provider implementations: VaultCredentialProvider, PostgresCredentialProvider, LegacyFileCredentialProvider

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock vault-db-repo ───────────────────────────────────────────────────────
vi.mock('../../vault/vault-db-repo.js', () => ({
  getVaultSecret: vi.fn(),
}));

// ─── Mock fs (for LegacyFileCredentialProvider) ───────────────────────────────
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn(),
}));

// ─── Mock shared constants ────────────────────────────────────────────────────
vi.mock('../../../shared/constants.js', () => ({
  SHELL_CONFIG_DIR_NAME: '.openclaw-shell',
}));

import { existsSync, readFileSync } from 'fs';
import { getVaultSecret } from '../../vault/vault-db-repo.js';
import {
  VaultCredentialProvider,
  PostgresCredentialProvider,
  LegacyFileCredentialProvider,
} from '../../api-workers/credential-provider.js';

const mockGetVaultSecret = vi.mocked(getVaultSecret);
const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

beforeEach(() => {
  vi.clearAllMocks();
  mockExistsSync.mockReturnValue(false);
});

// ─── VaultCredentialProvider ──────────────────────────────────────────────────

describe('VaultCredentialProvider', () => {
  function makeBridge() {
    return {
      requestSecret: vi.fn(),
    };
  }

  it('returns lease value on successful secret request', async () => {
    const bridge = makeBridge();
    bridge.requestSecret.mockResolvedValueOnce({ id: 'lease-1', value: 'ghp_abc123' });

    const provider = new VaultCredentialProvider(bridge as any);
    const value = await provider.getCredential('openclaw/api-keys/github-pat', 'build');

    expect(value).toBe('ghp_abc123');
    expect(bridge.requestSecret).toHaveBeenCalledWith('build', 'openclaw/api-keys/github-pat', 'worker:build');
  });

  it('throws when requestSecret returns null (denied/not found)', async () => {
    const bridge = makeBridge();
    bridge.requestSecret.mockResolvedValueOnce(null);

    const provider = new VaultCredentialProvider(bridge as any);
    await expect(provider.getCredential('openclaw/api-keys/missing', 'build')).rejects.toThrow(
      'Failed to obtain credential',
    );
  });

  it('registers rotation callbacks and fires them on notifyRotation', () => {
    const bridge = makeBridge();
    const provider = new VaultCredentialProvider(bridge as any);

    const cb1 = vi.fn();
    const cb2 = vi.fn();
    provider.onRotated('openclaw/api-keys/github-pat', cb1);
    provider.onRotated('openclaw/api-keys/github-pat', cb2);

    provider.notifyRotation('openclaw/api-keys/github-pat');

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('does not fire callbacks for a different secret name', () => {
    const bridge = makeBridge();
    const provider = new VaultCredentialProvider(bridge as any);
    const cb = vi.fn();
    provider.onRotated('openclaw/api-keys/github-pat', cb);

    provider.notifyRotation('openclaw/api-keys/other-secret');
    expect(cb).not.toHaveBeenCalled();
  });

  it('silently ignores errors thrown by rotation callbacks', () => {
    const bridge = makeBridge();
    const provider = new VaultCredentialProvider(bridge as any);
    const badCb = vi.fn().mockImplementation(() => { throw new Error('callback error'); });
    provider.onRotated('sec', badCb);

    expect(() => provider.notifyRotation('sec')).not.toThrow();
  });

  it('dispose clears all rotation callbacks', () => {
    const bridge = makeBridge();
    const provider = new VaultCredentialProvider(bridge as any);
    const cb = vi.fn();
    provider.onRotated('sec', cb);
    provider.dispose();

    provider.notifyRotation('sec');
    expect(cb).not.toHaveBeenCalled();
  });
});

// ─── PostgresCredentialProvider ───────────────────────────────────────────────

describe('PostgresCredentialProvider', () => {
  it('returns value from Postgres vault_secrets', async () => {
    mockGetVaultSecret.mockResolvedValueOnce({
      id: 'row-1',
      name: 'openclaw/api-keys/github-pat',
      value: 'ghp_postgres_secret',
      description: null,
      owner_agent: null,
      acl: [],
      rotated_at: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    });

    const provider = new PostgresCredentialProvider();
    const value = await provider.getCredential('openclaw/api-keys/github-pat', 'build');
    expect(value).toBe('ghp_postgres_secret');
  });

  it('throws when secret not found in Postgres', async () => {
    mockGetVaultSecret.mockResolvedValueOnce(null);
    const provider = new PostgresCredentialProvider();
    await expect(provider.getCredential('missing/secret', 'agent')).rejects.toThrow('not found in Postgres');
  });

  it('throws when secret value is PLACEHOLDER', async () => {
    mockGetVaultSecret.mockResolvedValueOnce({
      id: 'row-2',
      name: 'sec',
      value: 'PLACEHOLDER',
      description: null,
      owner_agent: null,
      acl: [],
      rotated_at: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    });

    const provider = new PostgresCredentialProvider();
    await expect(provider.getCredential('sec', 'agent')).rejects.toThrow('placeholder');
  });

  it('supports rotation callbacks', () => {
    const provider = new PostgresCredentialProvider();
    const cb = vi.fn();
    provider.onRotated('sec', cb);
    provider.notifyRotation('sec');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('dispose clears rotation callbacks', () => {
    const provider = new PostgresCredentialProvider();
    const cb = vi.fn();
    provider.onRotated('sec', cb);
    provider.dispose();
    provider.notifyRotation('sec');
    expect(cb).not.toHaveBeenCalled();
  });
});

// ─── LegacyFileCredentialProvider ────────────────────────────────────────────

describe('LegacyFileCredentialProvider', () => {
  it('returns empty credentials when file does not exist', async () => {
    mockExistsSync.mockReturnValue(false);
    const provider = new LegacyFileCredentialProvider();
    await expect(provider.getCredential('openclaw/api-keys/github-pat', 'build')).rejects.toThrow(
      'not found in legacy credentials file',
    );
  });

  it('reads github PAT from legacy credentials file', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ github: { personal_access_token: 'ghp_legacy_token' } }),
    );

    const provider = new LegacyFileCredentialProvider();
    const value = await provider.getCredential('openclaw/api-keys/github-pat', 'build');
    expect(value).toBe('ghp_legacy_token');
  });

  it('reads fireflies api key from legacy credentials file', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ fireflies: { api_key: 'ff_legacy_key' } }),
    );

    const provider = new LegacyFileCredentialProvider();
    const value = await provider.getCredential('openclaw/api-keys/fireflies', 'notes');
    expect(value).toBe('ff_legacy_key');
  });

  it('throws for unmapped secret names', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ github: { personal_access_token: 'tok' } }));

    const provider = new LegacyFileCredentialProvider();
    await expect(provider.getCredential('openclaw/api-keys/openai', 'agent')).rejects.toThrow(
      'not found in legacy credentials file',
    );
  });

  it('falls back to empty credentials when JSON is malformed', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{ invalid json }');

    const provider = new LegacyFileCredentialProvider();
    await expect(provider.getCredential('openclaw/api-keys/github-pat', 'build')).rejects.toThrow(
      'not found in legacy credentials file',
    );
  });

  it('onRotated is a no-op (no rotation support)', () => {
    const provider = new LegacyFileCredentialProvider();
    expect(() => provider.onRotated('sec', vi.fn())).not.toThrow();
  });

  it('dispose clears credentials', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ github: { personal_access_token: 'tok' } }),
    );

    const provider = new LegacyFileCredentialProvider();
    provider.dispose();

    await expect(provider.getCredential('openclaw/api-keys/github-pat', 'build')).rejects.toThrow();
  });
});
