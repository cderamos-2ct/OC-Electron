import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock pool module ─────────────────────────────────────────────────────────
const mockQuery = vi.fn();
const mockWithTransaction = vi.fn();

vi.mock('../pool.js', () => ({
  query: mockQuery,
  withTransaction: mockWithTransaction,
}));

const {
  upsertAgent,
  getAgentById,
  getAgentBySlug,
  listAgents,
  setAgentStatus,
  insertConversation,
  insertConversationsBatch,
  listConversations,
  getSessionThread,
  getAgentSessions,
  insertAuditLog,
  listAuditLog,
} = await import('../agent-sessions.js');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const fakeAgent = {
  id: 'agent-uuid-1',
  name: 'Test Agent',
  slug: 'test-agent',
  model: 'claude-opus-4-6',
  provider: 'anthropic' as const,
  role: 'specialist' as const,
  persona: null,
  system_prompt: null,
  capabilities: [],
  config: {},
  status: 'inactive' as const,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
};

const fakeConversation = {
  id: 'conv-uuid-1',
  agent_id: 'agent-uuid-1',
  session_id: 'session-1',
  channel: 'cli',
  direction: 'inbound' as const,
  role: 'user' as const,
  content: 'Hello, agent!',
  metadata: {},
  task_id: null,
  created_at: new Date('2026-01-01'),
};

describe('agent-sessions.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Agent Repository ─────────────────────────────────────────────────────

  describe('upsertAgent', () => {
    it('upserts agent and returns the row', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [fakeAgent] });

      const result = await upsertAgent({
        name: 'Test Agent',
        slug: 'test-agent',
        model: 'claude-opus-4-6',
        provider: 'anthropic',
        role: 'specialist',
      });

      expect(result).toBe(fakeAgent);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('INSERT INTO agents');
      expect(sql).toContain('ON CONFLICT (slug) DO UPDATE SET');
      expect(sql).toContain('RETURNING *');
      expect(params[0]).toBe('Test Agent');
      expect(params[1]).toBe('test-agent');
    });

    it('uses default status "inactive" when not provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [fakeAgent] });

      await upsertAgent({
        name: 'Agent',
        slug: 'agent',
        model: 'gpt-5',
        provider: 'openai',
        role: 'utility',
      });

      const [, params] = mockQuery.mock.calls[0];
      expect(params[9]).toBe('inactive'); // status is 10th param
    });

    it('serializes capabilities and config as JSON', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [fakeAgent] });

      await upsertAgent({
        name: 'Agent',
        slug: 'agent',
        model: 'gpt-5',
        provider: 'openai',
        role: 'utility',
        capabilities: ['search', 'code'],
        config: { temperature: 0.7 },
      });

      const [, params] = mockQuery.mock.calls[0];
      expect(params[7]).toBe(JSON.stringify(['search', 'code']));
      expect(params[8]).toBe(JSON.stringify({ temperature: 0.7 }));
    });
  });

  describe('getAgentById', () => {
    it('returns agent when found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [fakeAgent] });

      const result = await getAgentById('agent-uuid-1');
      expect(result).toBe(fakeAgent);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('WHERE id = $1');
      expect(params).toEqual(['agent-uuid-1']);
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await getAgentById('missing');
      expect(result).toBeNull();
    });
  });

  describe('getAgentBySlug', () => {
    it('returns agent by slug', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [fakeAgent] });

      const result = await getAgentBySlug('test-agent');
      expect(result).toBe(fakeAgent);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('WHERE slug = $1');
      expect(params).toEqual(['test-agent']);
    });

    it('returns null when slug not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await getAgentBySlug('no-such-agent');
      expect(result).toBeNull();
    });
  });

  describe('listAgents', () => {
    it('lists all agents when no status filter', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [fakeAgent] });

      const result = await listAgents();
      expect(result).toEqual([fakeAgent]);
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('ORDER BY name');
      expect(sql).not.toContain('WHERE');
    });

    it('filters by status when provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [fakeAgent] });

      const result = await listAgents('active');
      expect(result).toEqual([fakeAgent]);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('WHERE status = $1');
      expect(params).toEqual(['active']);
    });
  });

  describe('setAgentStatus', () => {
    it('updates agent status', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await setAgentStatus('agent-uuid-1', 'active');

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('UPDATE agents SET status = $1');
      expect(params).toEqual(['active', 'agent-uuid-1']);
    });
  });

  // ─── Conversation Repository ───────────────────────────────────────────────

  describe('insertConversation', () => {
    it('inserts conversation and returns the row', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [fakeConversation] });

      const result = await insertConversation({
        agent_id: 'agent-uuid-1',
        session_id: 'session-1',
        channel: 'cli',
        direction: 'inbound',
        role: 'user',
        content: 'Hello, agent!',
      });

      expect(result).toBe(fakeConversation);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('INSERT INTO conversations');
      expect(sql).toContain('RETURNING *');
      expect(params[3]).toBe('inbound');
      expect(params[4]).toBe('user');
      expect(params[5]).toBe('Hello, agent!');
    });

    it('defaults null for optional fields', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [fakeConversation] });

      await insertConversation({
        direction: 'internal',
        role: 'system',
        content: 'System message',
      });

      const [, params] = mockQuery.mock.calls[0];
      expect(params[0]).toBeNull(); // agent_id
      expect(params[1]).toBeNull(); // session_id
      expect(params[2]).toBeNull(); // channel
      expect(params[7]).toBeNull(); // task_id
      expect(params[6]).toBe('{}'); // metadata default
    });
  });

  describe('insertConversationsBatch', () => {
    it('returns empty array for empty input', async () => {
      const result = await insertConversationsBatch([]);
      expect(result).toEqual([]);
      expect(mockWithTransaction).not.toHaveBeenCalled();
    });

    it('inserts all messages in a transaction', async () => {
      const msgs = [fakeConversation, { ...fakeConversation, id: 'conv-uuid-2', content: 'Reply' }];
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [msgs[0]] })
          .mockResolvedValueOnce({ rows: [msgs[1]] }),
      };

      mockWithTransaction.mockImplementationOnce(async (fn) => fn(mockClient));

      const result = await insertConversationsBatch([
        { direction: 'inbound', role: 'user', content: 'Hello, agent!' },
        { direction: 'outbound', role: 'assistant', content: 'Reply' },
      ]);

      expect(result).toEqual(msgs);
      expect(mockClient.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('listConversations', () => {
    it('returns conversations with default limit', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [fakeConversation] });

      const result = await listConversations();
      expect(result).toEqual([fakeConversation]);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('ORDER BY created_at DESC');
      expect(params).toContain(50); // default limit
    });

    it('applies agent_id filter', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await listConversations({ agent_id: 'agent-uuid-1' });
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('agent_id = $1');
      expect(params).toContain('agent-uuid-1');
    });

    it('applies session_id filter', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await listConversations({ session_id: 'session-1' });
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('session_id = $');
      expect(params).toContain('session-1');
    });

    it('applies channel filter', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await listConversations({ channel: 'slack' });
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('channel = $');
      expect(params).toContain('slack');
    });

    it('applies before date filter', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const before = new Date('2026-06-01');
      await listConversations({ before });
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('created_at < $');
      expect(params).toContain(before);
    });

    it('applies custom limit', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await listConversations({ limit: 25 });
      const [, params] = mockQuery.mock.calls[0];
      expect(params).toContain(25);
    });

    it('combines multiple filters', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await listConversations({ agent_id: 'a-1', session_id: 's-1', channel: 'cli' });
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('agent_id = $1');
      expect(sql).toContain('session_id = $2');
      expect(sql).toContain('channel = $3');
      expect(params).toContain('a-1');
      expect(params).toContain('s-1');
      expect(params).toContain('cli');
    });
  });

  describe('getSessionThread', () => {
    it('returns messages ordered ASC by created_at', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [fakeConversation] });

      const result = await getSessionThread('session-1');
      expect(result).toEqual([fakeConversation]);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('ORDER BY created_at ASC');
      expect(params[0]).toBe('session-1');
      expect(params[1]).toBe(200); // default limit
    });

    it('accepts custom limit', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await getSessionThread('session-1', 50);
      const [, params] = mockQuery.mock.calls[0];
      expect(params[1]).toBe(50);
    });
  });

  describe('getAgentSessions', () => {
    it('returns session_ids ordered by MAX(created_at) DESC', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { session_id: 'session-3' },
          { session_id: 'session-1' },
          { session_id: 'session-2' },
        ],
      });

      const result = await getAgentSessions('agent-uuid-1');
      expect(result).toEqual(['session-3', 'session-1', 'session-2']);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('GROUP BY session_id');
      expect(sql).toContain('ORDER BY MAX(created_at) DESC');
      expect(params[0]).toBe('agent-uuid-1');
      expect(params[1]).toBe(20); // default limit
    });

    it('accepts custom limit', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await getAgentSessions('agent-uuid-1', 5);
      const [, params] = mockQuery.mock.calls[0];
      expect(params[1]).toBe(5);
    });

    it('filters out null session_ids', async () => {
      // The query uses WHERE session_id IS NOT NULL so the DB filters them
      mockQuery.mockResolvedValueOnce({
        rows: [{ session_id: 'session-1' }],
      });

      const result = await getAgentSessions('agent-uuid-1');
      expect(result).toEqual(['session-1']);
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('session_id IS NOT NULL');
    });
  });

  // ─── Audit Log Repository ─────────────────────────────────────────────────

  describe('insertAuditLog', () => {
    it('inserts audit log entry and returns the row', async () => {
      const fakeEntry = {
        id: 'log-uuid-1',
        agent_id: 'agent-uuid-1',
        action: 'agent.started',
        resource_type: 'agent',
        resource_id: 'agent-uuid-1',
        payload: {},
        ip_address: null,
        created_at: new Date(),
      };
      mockQuery.mockResolvedValueOnce({ rows: [fakeEntry] });

      const result = await insertAuditLog({
        agent_id: 'agent-uuid-1',
        action: 'agent.started',
        resource_type: 'agent',
        resource_id: 'agent-uuid-1',
      });

      expect(result).toBe(fakeEntry);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('INSERT INTO audit_log');
      expect(sql).toContain('RETURNING *');
      expect(params[1]).toBe('agent.started');
    });

    it('defaults null for optional fields', async () => {
      const fakeEntry = {
        id: 'log-uuid-2',
        agent_id: null,
        action: 'system.boot',
        resource_type: null,
        resource_id: null,
        payload: {},
        ip_address: null,
        created_at: new Date(),
      };
      mockQuery.mockResolvedValueOnce({ rows: [fakeEntry] });

      await insertAuditLog({ action: 'system.boot' });

      const [, params] = mockQuery.mock.calls[0];
      expect(params[0]).toBeNull(); // agent_id
      expect(params[2]).toBeNull(); // resource_type
      expect(params[3]).toBeNull(); // resource_id
      expect(params[4]).toBe('{}'); // payload default
      expect(params[5]).toBeNull(); // ip_address
    });
  });

  describe('listAuditLog', () => {
    it('lists audit log by resource_type only', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await listAuditLog('agent');
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('WHERE resource_type = $1');
      expect(sql).not.toContain('resource_id');
      expect(params[0]).toBe('agent');
      expect(params[1]).toBe(50); // default limit
    });

    it('lists audit log by resource_type and resource_id', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await listAuditLog('agent', 'agent-uuid-1', 10);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('resource_type = $1 AND resource_id = $2');
      expect(params[0]).toBe('agent');
      expect(params[1]).toBe('agent-uuid-1');
      expect(params[2]).toBe(10);
    });
  });
});
