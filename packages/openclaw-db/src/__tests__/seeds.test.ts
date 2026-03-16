import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock fs/promises ─────────────────────────────────────────────────────────
const mockReadFile = vi.fn();
vi.mock('node:fs/promises', () => ({
  readFile: mockReadFile,
}));

// ─── Mock pool module ─────────────────────────────────────────────────────────
const mockWithTransaction = vi.fn();
vi.mock('../pool.js', () => ({
  withTransaction: mockWithTransaction,
}));

const { runSeeds } = await import('../seeds/index.js');

// Helper: build a mock PoolClient that tracks queries
function makeMockClient(appliedVersions: string[] = []) {
  const client = {
    query: vi.fn(),
  };

  // Call sequence per test:
  // 1. CREATE TABLE IF NOT EXISTS seed_versions (ensureSeedVersionsTable)
  // 2. SELECT version FROM seed_versions (getAppliedSeeds)
  // Then for each unapplied seed file:
  //   3. The SQL from readFile
  //   4. INSERT INTO seed_versions

  client.query
    .mockResolvedValueOnce(undefined) // CREATE TABLE
    .mockResolvedValueOnce({
      rows: appliedVersions.map((v) => ({ version: v })),
    }); // SELECT version

  return client;
}

describe('seeds/index.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runSeeds', () => {
    it('runs all seeds when none are applied', async () => {
      const client = makeMockClient([]);

      // For each of the 2 seed files: SQL execution + INSERT INTO seed_versions
      client.query
        .mockResolvedValueOnce(undefined) // 001_agents.sql content
        .mockResolvedValueOnce(undefined) // INSERT 001_agents
        .mockResolvedValueOnce(undefined) // 002_vault_secrets.sql content
        .mockResolvedValueOnce(undefined); // INSERT 002_vault_secrets

      mockReadFile
        .mockResolvedValueOnce('INSERT INTO agents VALUES (1);')
        .mockResolvedValueOnce('INSERT INTO vault_secrets VALUES (1);');

      mockWithTransaction.mockImplementationOnce(async (fn) => fn(client));

      await runSeeds();

      expect(mockWithTransaction).toHaveBeenCalledOnce();

      // Check CREATE TABLE was called
      const createCall = client.query.mock.calls[0][0];
      expect(createCall).toContain('CREATE TABLE IF NOT EXISTS seed_versions');

      // Check SELECT was called
      const selectCall = client.query.mock.calls[1][0];
      expect(selectCall).toContain('SELECT version FROM seed_versions');

      // Check first seed file SQL was executed
      const seed1SqlCall = client.query.mock.calls[2][0];
      expect(seed1SqlCall).toBe('INSERT INTO agents VALUES (1);');

      // Check first seed version was recorded
      const insert1Call = client.query.mock.calls[3];
      expect(insert1Call[0]).toContain('INSERT INTO seed_versions');
      expect(insert1Call[1]).toEqual(['001_agents']);

      // Check second seed file SQL
      const seed2SqlCall = client.query.mock.calls[4][0];
      expect(seed2SqlCall).toBe('INSERT INTO vault_secrets VALUES (1);');

      // Check second seed version was recorded
      const insert2Call = client.query.mock.calls[5];
      expect(insert2Call[0]).toContain('INSERT INTO seed_versions');
      expect(insert2Call[1]).toEqual(['002_vault_secrets']);
    });

    it('skips already-applied seeds', async () => {
      const client = makeMockClient(['001_agents']);

      // Only seed 002 should run
      client.query
        .mockResolvedValueOnce(undefined) // 002_vault_secrets.sql
        .mockResolvedValueOnce(undefined); // INSERT 002_vault_secrets

      mockReadFile.mockResolvedValueOnce('INSERT INTO vault_secrets VALUES (1);');

      mockWithTransaction.mockImplementationOnce(async (fn) => fn(client));

      await runSeeds();

      // readFile should only be called once (for 002)
      expect(mockReadFile).toHaveBeenCalledOnce();

      // The SQL call should be for 002, not 001
      const sqlCall = client.query.mock.calls[2][0];
      expect(sqlCall).toBe('INSERT INTO vault_secrets VALUES (1);');

      const insertCall = client.query.mock.calls[3];
      expect(insertCall[1]).toEqual(['002_vault_secrets']);
    });

    it('skips all seeds when all are applied', async () => {
      const client = makeMockClient(['001_agents', '002_vault_secrets']);

      mockWithTransaction.mockImplementationOnce(async (fn) => fn(client));

      await runSeeds();

      // Only CREATE TABLE + SELECT version calls should be made
      expect(client.query).toHaveBeenCalledTimes(2);
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it('is idempotent — running twice does not re-apply seeds', async () => {
      // First run: both seeds applied fresh
      const client1 = makeMockClient([]);
      client1.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      mockReadFile
        .mockResolvedValueOnce('SQL 1;')
        .mockResolvedValueOnce('SQL 2;');

      mockWithTransaction.mockImplementationOnce(async (fn) => fn(client1));
      await runSeeds();

      // Second run: both seeds already applied
      const client2 = makeMockClient(['001_agents', '002_vault_secrets']);
      mockWithTransaction.mockImplementationOnce(async (fn) => fn(client2));
      await runSeeds();

      // readFile called only twice total (first run only)
      expect(mockReadFile).toHaveBeenCalledTimes(2);
      // Second client only called CREATE + SELECT
      expect(client2.query).toHaveBeenCalledTimes(2);
    });

    it('uses correct version string (filename without .sql extension)', async () => {
      const client = makeMockClient([]);
      client.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      mockReadFile.mockResolvedValue('SELECT 1;');

      mockWithTransaction.mockImplementationOnce(async (fn) => fn(client));
      await runSeeds();

      const insert1Params = client.query.mock.calls[3][1];
      const insert2Params = client.query.mock.calls[5][1];
      expect(insert1Params[0]).toBe('001_agents');
      expect(insert2Params[0]).toBe('002_vault_secrets');
    });

    it('propagates errors from the transaction', async () => {
      mockWithTransaction.mockRejectedValueOnce(new Error('DB connection failed'));

      await expect(runSeeds()).rejects.toThrow('DB connection failed');
    });

    it('runs inside a single transaction', async () => {
      const client = makeMockClient(['001_agents', '002_vault_secrets']);
      mockWithTransaction.mockImplementationOnce(async (fn) => fn(client));

      await runSeeds();

      // All work wrapped in withTransaction — called exactly once
      expect(mockWithTransaction).toHaveBeenCalledOnce();
    });
  });
});
