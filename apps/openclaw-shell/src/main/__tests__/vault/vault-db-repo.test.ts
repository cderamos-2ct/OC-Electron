// Tests for vault-db-repo.ts
// Mocks: openclaw-db (query, withTransaction)

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock openclaw-db ─────────────────────────────────────────────────────────
vi.mock('openclaw-db', () => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

import { query, withTransaction } from 'openclaw-db';
import {
  getVaultSecret,
  countVaultSecrets,
  listVaultSecrets,
  getVaultSecretsByAgent,
  upsertVaultSecret,
  recordRotation,
  deleteVaultSecret,
  updateVaultSecretAcl,
  canAgentReadSecret,
  syncVaultSecretsFromBitwarden,
  appendAuditLogEntry,
  createApprovalRecord,
  resolveApprovalRecord,
  listPendingApprovalRecords,
} from '../../vault/vault-db-repo.js';

const mockQuery = vi.mocked(query);
const mockWithTransaction = vi.mocked(withTransaction);

const MASTER_KEY = 'test-master-key';

function makeSecretRow(overrides = {}) {
  return {
    id: 'secret-uuid',
    name: 'openclaw/api-keys/github-pat',
    value: 'ghp_secret123',
    description: 'GitHub PAT',
    owner_agent: null,
    acl: [],
    rotated_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.VAULT_MASTER_KEY = MASTER_KEY;
});

// ─── getVaultMasterKey guard ───────────────────────────────────────────────────

describe('VAULT_MASTER_KEY guard', () => {
  it('throws when VAULT_MASTER_KEY is not set', async () => {
    delete process.env.VAULT_MASTER_KEY;
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    await expect(getVaultSecret('any')).rejects.toThrow('VAULT_MASTER_KEY');
  });
});

// ─── getVaultSecret ────────────────────────────────────────────────────────────

describe('getVaultSecret', () => {
  it('returns the secret row when found', async () => {
    const row = makeSecretRow();
    mockQuery.mockResolvedValueOnce({ rows: [row] } as any);

    const result = await getVaultSecret('openclaw/api-keys/github-pat');

    expect(result).toEqual(row);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('vault_decrypt'),
      ['openclaw/api-keys/github-pat', MASTER_KEY],
    );
  });

  it('returns null when secret not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    const result = await getVaultSecret('nonexistent');
    expect(result).toBeNull();
  });
});

// ─── countVaultSecrets ────────────────────────────────────────────────────────

describe('countVaultSecrets', () => {
  it('returns parsed count', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '42' }] } as any);
    expect(await countVaultSecrets()).toBe(42);
  });

  it('returns 0 when no rows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    expect(await countVaultSecrets()).toBe(0);
  });
});

// ─── listVaultSecrets ─────────────────────────────────────────────────────────

describe('listVaultSecrets', () => {
  it('returns all secret rows', async () => {
    const rows = [makeSecretRow(), makeSecretRow({ name: 'other/secret', value: 'val2' })];
    mockQuery.mockResolvedValueOnce({ rows } as any);

    const result = await listVaultSecrets();
    expect(result).toHaveLength(2);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY name ASC'),
      [MASTER_KEY],
    );
  });
});

// ─── getVaultSecretsByAgent ───────────────────────────────────────────────────

describe('getVaultSecretsByAgent', () => {
  it('returns secrets accessible to agent', async () => {
    const rows = [makeSecretRow()];
    mockQuery.mockResolvedValueOnce({ rows } as any);

    const result = await getVaultSecretsByAgent('hermes');
    expect(result).toEqual(rows);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('acl ? $1'),
      ['hermes', MASTER_KEY],
    );
  });
});

// ─── upsertVaultSecret ────────────────────────────────────────────────────────

describe('upsertVaultSecret', () => {
  it('upserts and returns the row with encrypted value', async () => {
    const row = makeSecretRow();
    mockQuery.mockResolvedValueOnce({ rows: [row] } as any);

    const result = await upsertVaultSecret({
      name: 'openclaw/api-keys/github-pat',
      value: 'ghp_secret123',
      description: 'GitHub PAT',
      ownerAgentSlug: 'build',
      acl: ['build', 'karoline'],
    });

    expect(result).toEqual(row);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('vault_encrypt'),
      [
        'openclaw/api-keys/github-pat',
        'ghp_secret123',
        'openclaw/api-keys',           // folder derived from name
        'GitHub PAT',
        'build',
        JSON.stringify(['build', 'karoline']),
        MASTER_KEY,
      ],
    );
  });

  it('defaults acl to empty array and ownerAgentSlug to null', async () => {
    const row = makeSecretRow();
    mockQuery.mockResolvedValueOnce({ rows: [row] } as any);

    await upsertVaultSecret({ name: 'sec', value: 'val' });

    const callArgs = mockQuery.mock.calls[0][1] as unknown[];
    expect(callArgs[2]).toBeNull();   // folder (no slash in 'sec')
    expect(callArgs[4]).toBeNull();   // ownerAgentSlug
    expect(callArgs[5]).toBe('[]');   // acl
  });
});

// ─── recordRotation ───────────────────────────────────────────────────────────

describe('recordRotation', () => {
  it('updates encrypted_value and rotated_at', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    await recordRotation({
      name: 'openclaw/api-keys/github-pat',
      value: 'ghp_newSecret',
      rotatedAt: '2024-06-01T00:00:00Z',
    });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('rotated_at'),
      ['openclaw/api-keys/github-pat', 'ghp_newSecret', '2024-06-01T00:00:00Z', MASTER_KEY],
    );
  });
});

// ─── deleteVaultSecret ────────────────────────────────────────────────────────

describe('deleteVaultSecret', () => {
  it('returns true when a row was deleted', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] } as any);
    expect(await deleteVaultSecret('sec')).toBe(true);
  });

  it('returns false when secret not found', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] } as any);
    expect(await deleteVaultSecret('nonexistent')).toBe(false);
  });
});

// ─── updateVaultSecretAcl ─────────────────────────────────────────────────────

describe('updateVaultSecretAcl', () => {
  it('returns true when updated', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] } as any);
    expect(await updateVaultSecretAcl('sec', ['agent-a'])).toBe(true);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('acl = $2::jsonb'),
      ['sec', JSON.stringify(['agent-a'])],
    );
  });

  it('returns false when secret not found', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] } as any);
    expect(await updateVaultSecretAcl('missing', [])).toBe(false);
  });
});

// ─── canAgentReadSecret ───────────────────────────────────────────────────────

describe('canAgentReadSecret', () => {
  it('returns true when agent has access', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ allowed: true }] } as any);
    expect(await canAgentReadSecret('hermes', 'openclaw/tokens/gmail')).toBe(true);
  });

  it('returns false when agent lacks access', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ allowed: false }] } as any);
    expect(await canAgentReadSecret('random-agent', 'prod/master-key')).toBe(false);
  });

  it('returns false on empty rows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    expect(await canAgentReadSecret('agent', 'sec')).toBe(false);
  });
});

// ─── syncVaultSecretsFromBitwarden ────────────────────────────────────────────

describe('syncVaultSecretsFromBitwarden', () => {
  it('upserts all entries within a transaction', async () => {
    const mockClient = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    mockWithTransaction.mockImplementationOnce(async (fn) => {
      await fn(mockClient as any);
    });

    const entries = [
      { name: 'sec1', value: 'val1' },
      { name: 'sec2', value: 'val2', description: 'desc2' },
    ];

    const result = await syncVaultSecretsFromBitwarden(entries, 'vesta');

    expect(result.upserted).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(mockClient.query).toHaveBeenCalledTimes(2);
  });

  it('records errors per entry without throwing', async () => {
    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockRejectedValueOnce(new Error('unique violation')),
    };
    mockWithTransaction.mockImplementationOnce(async (fn) => {
      await fn(mockClient as any);
    });

    const entries = [
      { name: 'sec1', value: 'val1' },
      { name: 'sec2', value: 'val2' },
    ];

    const result = await syncVaultSecretsFromBitwarden(entries);

    expect(result.upserted).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('sec2');
  });
});

// ─── appendAuditLogEntry ──────────────────────────────────────────────────────

describe('appendAuditLogEntry', () => {
  it('inserts audit log row', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    await appendAuditLogEntry({
      agentId: 'hermes',
      action: 'access',
      secretName: 'openclaw/tokens/gmail',
      result: 'success',
    });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('audit_log'),
      expect.arrayContaining(['hermes', 'access', 'openclaw/tokens/gmail']),
    );
  });

  it('silently ignores errors (non-fatal)', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB down'));
    await expect(
      appendAuditLogEntry({ agentId: 'a', action: 'access', secretName: 's', result: 'error' }),
    ).resolves.toBeUndefined();
  });
});

// ─── createApprovalRecord ─────────────────────────────────────────────────────

describe('createApprovalRecord', () => {
  it('inserts approval record with ON CONFLICT DO NOTHING', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    await createApprovalRecord({
      id: 'approval-uuid',
      agentId: 'hermes',
      secretName: 'openclaw/tokens/gmail',
      purpose: 'send email',
    });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('vault_approvals'),
      ['approval-uuid', 'hermes', 'openclaw/tokens/gmail', 'send email'],
    );
  });
});

// ─── resolveApprovalRecord ────────────────────────────────────────────────────

describe('resolveApprovalRecord', () => {
  it('updates decision to approved', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    await resolveApprovalRecord('approval-uuid', 'approved');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('decision = $2'),
      ['approval-uuid', 'approved'],
    );
  });

  it('updates decision to denied', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    await resolveApprovalRecord('approval-uuid', 'denied');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      ['approval-uuid', 'denied'],
    );
  });
});

// ─── listPendingApprovalRecords ───────────────────────────────────────────────

describe('listPendingApprovalRecords', () => {
  it('returns pending approvals ordered by requested_at', async () => {
    const rows = [
      { id: 'a1', agent_id: 'hermes', secret_name: 'tok/gmail', purpose: 'send', requested_at: '2024-01-01', decided_at: null, decision: 'pending' },
    ];
    mockQuery.mockResolvedValueOnce({ rows } as any);

    const result = await listPendingApprovalRecords();
    expect(result).toEqual(rows);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("decision = 'pending'"),
    );
  });
});
