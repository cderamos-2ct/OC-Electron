import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock fs/promises ─────────────────────────────────────────────────────────
const mockReadFile = vi.fn();
vi.mock('node:fs/promises', () => ({
  readFile: mockReadFile,
}));

// ─── Mock pool module ─────────────────────────────────────────────────────────
const mockWithTransaction = vi.fn();
const mockQuery = vi.fn();
vi.mock('../pool.js', () => ({
  query: mockQuery,
  withTransaction: mockWithTransaction,
}));

const { runMigrations } = await import('../migrations/index.js');

const MIGRATION_FILES = [
  '001_initial_schema',
  '002_api_worker_tables',
  '003_vault_encryption',
  '004_vault_runtime_tables',
];

// Helper: build a mock PoolClient
function makeMockClient(appliedVersions: string[] = []) {
  const client = { query: vi.fn() };

  client.query
    .mockResolvedValueOnce(undefined) // CREATE TABLE schema_migrations
    .mockResolvedValueOnce({
      rows: appliedVersions.map((v) => ({ version: v })),
    }); // SELECT version FROM schema_migrations

  return client;
}

describe('migrations/index.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runMigrations', () => {
    it('runs all migrations when none are applied', async () => {
      const client = makeMockClient([]);

      // Each migration: SQL execution + INSERT INTO schema_migrations
      for (let i = 0; i < MIGRATION_FILES.length; i++) {
        client.query
          .mockResolvedValueOnce(undefined) // migration SQL
          .mockResolvedValueOnce(undefined); // INSERT version
      }

      mockReadFile.mockResolvedValue('CREATE TABLE test (id SERIAL);');
      mockWithTransaction.mockImplementationOnce(async (fn) => fn(client));

      await runMigrations();

      expect(mockWithTransaction).toHaveBeenCalledOnce();

      // CREATE TABLE schema_migrations
      expect(client.query.mock.calls[0][0]).toContain(
        'CREATE TABLE IF NOT EXISTS schema_migrations'
      );

      // SELECT version
      expect(client.query.mock.calls[1][0]).toContain(
        'SELECT version FROM schema_migrations'
      );

      // Verify each migration was applied in order
      for (let i = 0; i < MIGRATION_FILES.length; i++) {
        const sqlCallIdx = 2 + i * 2;
        const insertCallIdx = 3 + i * 2;

        // SQL content was executed
        expect(client.query.mock.calls[sqlCallIdx][0]).toBe(
          'CREATE TABLE test (id SERIAL);'
        );

        // Version was recorded
        const insertParams = client.query.mock.calls[insertCallIdx][1];
        expect(insertParams[0]).toBe(MIGRATION_FILES[i]);
      }
    });

    it('skips already-applied migrations', async () => {
      const applied = ['001_initial_schema', '002_api_worker_tables'];
      const client = makeMockClient(applied);

      // Only 2 remaining migrations
      client.query
        .mockResolvedValueOnce(undefined) // 003 SQL
        .mockResolvedValueOnce(undefined) // INSERT 003
        .mockResolvedValueOnce(undefined) // 004 SQL
        .mockResolvedValueOnce(undefined); // INSERT 004

      mockReadFile.mockResolvedValue('ALTER TABLE foo ADD COLUMN bar TEXT;');
      mockWithTransaction.mockImplementationOnce(async (fn) => fn(client));

      await runMigrations();

      // 2 (setup) + 4 (2 migrations × 2) = 6 calls total
      expect(client.query).toHaveBeenCalledTimes(6);

      const insert1Params = client.query.mock.calls[3][1];
      expect(insert1Params[0]).toBe('003_vault_encryption');

      const insert2Params = client.query.mock.calls[5][1];
      expect(insert2Params[0]).toBe('004_vault_runtime_tables');
    });

    it('skips all migrations when all are applied', async () => {
      const client = makeMockClient(MIGRATION_FILES);
      mockWithTransaction.mockImplementationOnce(async (fn) => fn(client));

      await runMigrations();

      // Only CREATE TABLE + SELECT
      expect(client.query).toHaveBeenCalledTimes(2);
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it('is idempotent', async () => {
      // First run applies all
      const client1 = makeMockClient([]);
      for (let i = 0; i < MIGRATION_FILES.length; i++) {
        client1.query
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce(undefined);
      }
      mockReadFile.mockResolvedValue('CREATE TABLE x (id INT);');
      mockWithTransaction.mockImplementationOnce(async (fn) => fn(client1));
      await runMigrations();

      // Second run: all already applied
      const client2 = makeMockClient(MIGRATION_FILES);
      mockWithTransaction.mockImplementationOnce(async (fn) => fn(client2));
      await runMigrations();

      // readFile only called during first run
      expect(mockReadFile).toHaveBeenCalledTimes(MIGRATION_FILES.length);
      expect(client2.query).toHaveBeenCalledTimes(2);
    });

    it('records version as filename without .sql extension', async () => {
      const client = makeMockClient([]);
      for (let i = 0; i < MIGRATION_FILES.length; i++) {
        client.query
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce(undefined);
      }
      mockReadFile.mockResolvedValue('SELECT 1;');
      mockWithTransaction.mockImplementationOnce(async (fn) => fn(client));

      await runMigrations();

      for (let i = 0; i < MIGRATION_FILES.length; i++) {
        const insertCallIdx = 3 + i * 2;
        const insertParams = client.query.mock.calls[insertCallIdx][1];
        expect(insertParams[0]).toBe(MIGRATION_FILES[i]);
        // Verify no .sql suffix
        expect(insertParams[0]).not.toContain('.sql');
      }
    });

    it('runs inside a single transaction', async () => {
      const client = makeMockClient(MIGRATION_FILES);
      mockWithTransaction.mockImplementationOnce(async (fn) => fn(client));

      await runMigrations();

      expect(mockWithTransaction).toHaveBeenCalledOnce();
    });

    it('propagates errors from the transaction', async () => {
      mockWithTransaction.mockRejectedValueOnce(new Error('Migration failed'));

      await expect(runMigrations()).rejects.toThrow('Migration failed');
    });

    it('reads SQL from the correct path for each migration', async () => {
      const client = makeMockClient([]);
      for (let i = 0; i < MIGRATION_FILES.length; i++) {
        client.query
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce(undefined);
      }
      mockReadFile.mockResolvedValue('SELECT 1;');
      mockWithTransaction.mockImplementationOnce(async (fn) => fn(client));

      await runMigrations();

      // Each migration file should have been read
      expect(mockReadFile).toHaveBeenCalledTimes(MIGRATION_FILES.length);

      // Each call should pass 'utf-8' encoding
      for (const call of mockReadFile.mock.calls) {
        expect(call[1]).toBe('utf-8');
        // Path should contain the migration filename
        expect(call[0]).toMatch(/\d{3}_.*\.sql$/);
      }
    });
  });
});
