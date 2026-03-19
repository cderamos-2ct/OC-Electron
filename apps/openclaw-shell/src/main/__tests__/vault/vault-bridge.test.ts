// Tests for vault-bridge.ts
// Mocks: electron, openclaw-db, vault-audit, vault-db-repo, vault-policy, lease-cache

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock electron ────────────────────────────────────────────────────────────
vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  app: { getPath: vi.fn(() => '/tmp') },
}));

// ─── Mock vault-audit ─────────────────────────────────────────────────────────
vi.mock('../../vault/vault-audit.js', () => ({
  appendVaultAuditEntry: vi.fn(),
  readVaultAuditLog: vi.fn().mockReturnValue([]),
}));

// ─── Mock vault-db-repo ───────────────────────────────────────────────────────
vi.mock('../../vault/vault-db-repo.js', () => ({
  getVaultSecret: vi.fn(),
  countVaultSecrets: vi.fn().mockResolvedValue(5),
  appendAuditLogEntry: vi.fn().mockResolvedValue(undefined),
  createApprovalRecord: vi.fn().mockResolvedValue(undefined),
  resolveApprovalRecord: vi.fn().mockResolvedValue(undefined),
  listPendingApprovalRecords: vi.fn().mockResolvedValue([]),
}));

// ─── Mock shared constants ────────────────────────────────────────────────────
vi.mock('../../../shared/constants.js', () => ({
  VAULT_DEFAULT_LEASE_TTL: 3600,
  SHELL_CONFIG_DIR_NAME: '.openclaw-shell',
  VAULT_POLICIES_FILE_NAME: 'vault-policies.json',
}));

// ─── Mock vault-policy (file-based store) ─────────────────────────────────────
vi.mock('../../vault/vault-policy.js', () => ({
  VaultPolicyStore: vi.fn().mockImplementation(() => ({
    evaluate: vi.fn().mockImplementation((_agentId: string, secretName: string) => {
      // Mirror the real prod-pattern guard so require-approval tests work
      if (/prod|master|production/i.test(secretName)) {
        return { action: 'require-approval', policy: null, maxLeaseTTL: 3600 };
      }
      return { action: 'auto-approve', policy: null, maxLeaseTTL: 3600 };
    }),
    listPolicies: vi.fn().mockReturnValue([]),
    addPolicy: vi.fn(),
    updatePolicy: vi.fn(),
    deletePolicy: vi.fn(),
  })),
}));

// ─── Mock node:crypto ─────────────────────────────────────────────────────────
vi.mock('node:crypto', () => ({
  randomUUID: vi.fn().mockReturnValue('mock-uuid-1234'),
}));

import { getVaultSecret, countVaultSecrets, listPendingApprovalRecords, createApprovalRecord, resolveApprovalRecord } from '../../vault/vault-db-repo.js';
import { VaultPolicyStore } from '../../vault/vault-policy.js';
import { VaultBridge } from '../../vault/vault-bridge.js';

const mockGetVaultSecret = vi.mocked(getVaultSecret);
const mockListPendingApprovalRecords = vi.mocked(listPendingApprovalRecords);

// Helper to get the evaluate mock from the VaultPolicyStore mock constructor
function getMockEvaluate() {
  const MockStore = vi.mocked(VaultPolicyStore);
  const instance = MockStore.mock.results[MockStore.mock.results.length - 1]?.value;
  return instance?.evaluate as ReturnType<typeof vi.fn>;
}

function makeVaultAdapter(overrides: Record<string, unknown> = {}) {
  return {
    getSecret: vi.fn().mockResolvedValue('secret-value'),
    setSecret: vi.fn().mockResolvedValue(undefined),
    listSecrets: vi.fn().mockResolvedValue([]),
    sync: vi.fn().mockResolvedValue(undefined),
    getSecretCount: vi.fn().mockResolvedValue(3),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── state transitions ────────────────────────────────────────────────────────

describe('VaultBridge state', () => {
  it('starts in disconnected state', () => {
    const bridge = new VaultBridge(makeVaultAdapter() as any);
    expect(bridge.state).toBe('disconnected');
    bridge.stop();
  });

  it('transitions to unlocked after start()', async () => {
    const bridge = new VaultBridge(makeVaultAdapter() as any);
    await bridge.start();
    expect(bridge.state).toBe('unlocked');
    await bridge.stop();
  });

  it('returns to disconnected after stop()', async () => {
    const bridge = new VaultBridge(makeVaultAdapter() as any);
    await bridge.start();
    await bridge.stop();
    expect(bridge.state).toBe('disconnected');
  });
});

// ─── requestSecret — auto-approve path ───────────────────────────────────────

describe('requestSecret (auto-approve)', () => {
  it('returns a lease when vault has the secret', async () => {
    const vault = makeVaultAdapter();
    const bridge = new VaultBridge(vault as any);
    await bridge.start();

    const lease = await bridge.requestSecret('hermes', 'openclaw/tokens/gmail', 'send email');

    expect(lease).not.toBeNull();
    expect(lease?.value).toBe('secret-value');
    expect(lease?.leasedBy).toBe('hermes');
    expect(lease?.secretName).toBe('openclaw/tokens/gmail');

    await bridge.stop();
  });

  it('falls back to Postgres when vault.getSecret throws', async () => {
    const vault = makeVaultAdapter({ getSecret: vi.fn().mockRejectedValue(new Error('BW offline')) });
    mockGetVaultSecret.mockResolvedValueOnce({
      id: 'row-id',
      name: 'openclaw/tokens/gmail',
      value: 'pg-secret-value',
      description: null,
      owner_agent: null,
      acl: [],
      rotated_at: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    });

    const bridge = new VaultBridge(vault as any);
    await bridge.start();

    const lease = await bridge.requestSecret('hermes', 'openclaw/tokens/gmail', 'send email');
    expect(lease?.value).toBe('pg-secret-value');

    await bridge.stop();
  });

  it('returns null when both vault and Postgres have no secret', async () => {
    const vault = makeVaultAdapter({ getSecret: vi.fn().mockRejectedValue(new Error('BW offline')) });
    mockGetVaultSecret.mockResolvedValueOnce(null);

    const bridge = new VaultBridge(vault as any);
    await bridge.start();

    const lease = await bridge.requestSecret('hermes', 'openclaw/tokens/missing', 'purpose');
    expect(lease).toBeNull();

    await bridge.stop();
  });

  it('returns existing active lease without creating a new one', async () => {
    const vault = makeVaultAdapter();
    const bridge = new VaultBridge(vault as any);
    await bridge.start();

    const lease1 = await bridge.requestSecret('hermes', 'openclaw/tokens/gmail', 'send');
    const lease2 = await bridge.requestSecret('hermes', 'openclaw/tokens/gmail', 'send again');

    expect(lease1?.id).toBe(lease2?.id);
    expect(vault.getSecret).toHaveBeenCalledTimes(1); // only first request hits vault

    await bridge.stop();
  });
});

// ─── requestSecret — require-approval path ───────────────────────────────────

describe('requestSecret (require-approval)', () => {
  it('queues approval for prod secrets and resolves on decision', async () => {
    const vault = makeVaultAdapter();
    const bridge = new VaultBridge(vault as any);
    await bridge.start();
    // Override policy to require approval for this test
    getMockEvaluate()?.mockReturnValue({ action: 'require-approval', policy: null, maxLeaseTTL: 3600 });

    // prod secrets always require approval per vault-policy
    const requestPromise = bridge.requestSecret('hermes', 'prod/master-key', 'dangerous op');

    // Give the promise a tick to queue
    await Promise.resolve(); await Promise.resolve();

    const pending = bridge.listPendingApprovals();
    expect(pending).toHaveLength(1);
    expect(pending[0].secretName).toBe('prod/master-key');

    // Approve
    await bridge.decideApproval(pending[0].id, 'approved');
    const lease = await requestPromise;

    expect(lease).not.toBeNull();
    expect(lease?.value).toBe('secret-value');

    await bridge.stop();
  });

  it('resolves to null when approval is denied', async () => {
    const vault = makeVaultAdapter();
    const bridge = new VaultBridge(vault as any);
    await bridge.start();
    // Override policy to require approval for this test
    getMockEvaluate()?.mockReturnValue({ action: 'require-approval', policy: null, maxLeaseTTL: 3600 });

    const requestPromise = bridge.requestSecret('rogue', 'prod/master-key', 'exfil');

    await Promise.resolve(); await Promise.resolve();
    const pending = bridge.listPendingApprovals();
    await bridge.decideApproval(pending[0].id, 'denied');

    const lease = await requestPromise;
    expect(lease).toBeNull();

    await bridge.stop();
  });

  it('decideApproval returns false for unknown id', async () => {
    const vault = makeVaultAdapter();
    const bridge = new VaultBridge(vault as any);
    await bridge.start();

    const result = await bridge.decideApproval('nonexistent-id', 'approved');
    expect(result).toBe(false);

    await bridge.stop();
  });
});

// ─── lease management ─────────────────────────────────────────────────────────

describe('lease management', () => {
  it('revokeLease removes the lease', async () => {
    const vault = makeVaultAdapter();
    const bridge = new VaultBridge(vault as any);
    await bridge.start();

    const lease = await bridge.requestSecret('hermes', 'openclaw/tokens/gmail', 'send');
    expect(lease).not.toBeNull();

    const revoked = bridge.revokeLease(lease!.id);
    expect(revoked).toBe(true);

    await bridge.stop();
  });

  it('revokeAll returns count of revoked leases', async () => {
    const vault = makeVaultAdapter();
    const bridge = new VaultBridge(vault as any);
    await bridge.start();

    await bridge.requestSecret('agent-a', 'openclaw/tokens/gmail', 'op1');

    const count = bridge.revokeAll();
    expect(count).toBeGreaterThanOrEqual(1);

    await bridge.stop();
  });

  it('revokeBySecret removes leases for that secret name', async () => {
    const vault = makeVaultAdapter();
    const bridge = new VaultBridge(vault as any);
    await bridge.start();

    await bridge.requestSecret('agent-a', 'openclaw/tokens/gmail', 'op1');
    const count = bridge.revokeBySecret('openclaw/tokens/gmail');
    expect(count).toBe(1);

    await bridge.stop();
  });
});

// ─── getStatus ────────────────────────────────────────────────────────────────

describe('getStatus', () => {
  it('returns status with vault count when unlocked', async () => {
    const vault = makeVaultAdapter();
    const bridge = new VaultBridge(vault as any);
    await bridge.start();

    const status = await bridge.getStatus();
    expect(status.state).toBe('unlocked');
    expect(status.secretCount).toBe(3); // from mock getSecretCount

    await bridge.stop();
  });

  it('falls back to Postgres count when vault.getSecretCount throws', async () => {
    const vault = makeVaultAdapter({ getSecretCount: vi.fn().mockRejectedValue(new Error('BW offline')) });
    vi.mocked(countVaultSecrets).mockResolvedValueOnce(7);

    const bridge = new VaultBridge(vault as any);
    await bridge.start();

    const status = await bridge.getStatus();
    expect(status.secretCount).toBe(7);

    await bridge.stop();
  });

  it('uses Postgres count when locked', async () => {
    vi.mocked(countVaultSecrets).mockResolvedValueOnce(4);
    const vault = makeVaultAdapter();
    const bridge = new VaultBridge(vault as any);
    // Don't call start — remains in disconnected/locked state

    const status = await bridge.getStatus();
    expect(status.state).toBe('disconnected');
    expect(status.secretCount).toBe(4);
  });
});

// ─── restoreApprovalQueue ─────────────────────────────────────────────────────

describe('restoreApprovalQueue', () => {
  it('re-queues pending approvals from Postgres on start', async () => {
    mockListPendingApprovalRecords.mockResolvedValueOnce([
      {
        id: 'persisted-id',
        agent_id: 'hermes',
        secret_name: 'openclaw/tokens/gmail',
        purpose: 'restored',
        requested_at: '2024-01-01T00:00:00Z',
        decided_at: null,
        decision: 'pending',
      },
    ]);

    const vault = makeVaultAdapter();
    const bridge = new VaultBridge(vault as any);
    await bridge.start();

    // Wait for restoreApprovalQueue to complete (async non-blocking)
    await Promise.resolve(); await Promise.resolve();

    const pending = bridge.listPendingApprovals();
    expect(pending.some((p) => p.id === 'persisted-id')).toBe(true);

    await bridge.stop();
  });
});

// ─── policy management ────────────────────────────────────────────────────────

describe('policy management', () => {
  it('listPolicies delegates to policyStore', async () => {
    const bridge = new VaultBridge(makeVaultAdapter() as any);
    const policies = bridge.listPolicies();
    expect(Array.isArray(policies)).toBe(true);
  });

  it('deletePolicy delegates to policyStore', async () => {
    const bridge = new VaultBridge(makeVaultAdapter() as any);
    // Returns false for unknown id (mock default)
    bridge.deletePolicy('unknown-policy-id');
  });

  it('getAuditLog returns entries from vault-audit', async () => {
    const bridge = new VaultBridge(makeVaultAdapter() as any);
    const log = bridge.getAuditLog(10);
    expect(Array.isArray(log)).toBe(true);
  });
});
