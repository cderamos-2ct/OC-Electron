import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock pg module ───────────────────────────────────────────────────────────
const mockPoolInstance = {
  query: vi.fn(),
  connect: vi.fn(),
  end: vi.fn(),
  on: vi.fn(),
};

const MockPool = vi.fn(() => mockPoolInstance);

vi.mock('pg', () => ({
  default: {
    Pool: MockPool,
  },
}));

// Import AFTER mock is set up
const { getPool, query, getClient, withTransaction, closePool } = await import('../pool.js');

describe('pool.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset pool singleton between tests by closing it
  });

  afterEach(async () => {
    mockPoolInstance.end.mockResolvedValueOnce(undefined);
    await closePool();
  });

  describe('getPool', () => {
    it('creates a new Pool with default config', () => {
      const pool = getPool();
      expect(MockPool).toHaveBeenCalledOnce();
      expect(MockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 20,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
        })
      );
      expect(pool).toBe(mockPoolInstance);
    });

    it('returns same pool instance on second call (singleton)', () => {
      const pool1 = getPool();
      const pool2 = getPool();
      expect(MockPool).toHaveBeenCalledOnce();
      expect(pool1).toBe(pool2);
    });

    it('registers error handler on pool', () => {
      getPool();
      expect(mockPoolInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('uses provided config', () => {
      getPool({
        host: 'myhost',
        port: 5433,
        database: 'mydb',
        user: 'myuser',
        password: 'mypass',
        ssl: true,
      });
      expect(MockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'myhost',
          port: 5433,
          database: 'mydb',
          user: 'myuser',
          password: 'mypass',
          ssl: true,
        })
      );
    });

    it('uses connectionString when provided', () => {
      getPool({ connectionString: 'postgres://user:pass@host/db' });
      expect(MockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionString: 'postgres://user:pass@host/db',
        })
      );
    });
  });

  describe('query', () => {
    it('calls pool.query with text and params', async () => {
      const mockResult = { rows: [{ id: '1' }], rowCount: 1 };
      mockPoolInstance.query.mockResolvedValueOnce(mockResult);

      const result = await query('SELECT * FROM agents WHERE id = $1', ['1']);

      expect(mockPoolInstance.query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE id = $1',
        ['1']
      );
      expect(result).toBe(mockResult);
    });

    it('calls pool.query with only text when no params', async () => {
      const mockResult = { rows: [], rowCount: 0 };
      mockPoolInstance.query.mockResolvedValueOnce(mockResult);

      await query('SELECT 1');
      expect(mockPoolInstance.query).toHaveBeenCalledWith('SELECT 1', undefined);
    });

    it('propagates query errors', async () => {
      mockPoolInstance.query.mockRejectedValueOnce(new Error('DB error'));
      await expect(query('SELECT 1')).rejects.toThrow('DB error');
    });
  });

  describe('getClient', () => {
    it('calls pool.connect and returns client', async () => {
      const mockClient = { query: vi.fn(), release: vi.fn() };
      mockPoolInstance.connect.mockResolvedValueOnce(mockClient);

      const client = await getClient();
      expect(mockPoolInstance.connect).toHaveBeenCalledOnce();
      expect(client).toBe(mockClient);
    });
  });

  describe('withTransaction', () => {
    it('commits on success', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      };
      mockPoolInstance.connect.mockResolvedValueOnce(mockClient);

      const result = await withTransaction(async (client) => {
        await client.query('INSERT INTO agents VALUES ($1)', ['test']);
        return 'success';
      });

      expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(
        2,
        'INSERT INTO agents VALUES ($1)',
        ['test']
      );
      expect(mockClient.query).toHaveBeenNthCalledWith(3, 'COMMIT');
      expect(mockClient.release).toHaveBeenCalledOnce();
      expect(result).toBe('success');
    });

    it('rolls back on error', async () => {
      const mockClient = {
        query: vi.fn(),
        release: vi.fn(),
      };
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce(undefined); // ROLLBACK

      mockPoolInstance.connect.mockResolvedValueOnce(mockClient);

      await expect(
        withTransaction(async () => {
          throw new Error('fn failed');
        })
      ).rejects.toThrow('fn failed');

      expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(2, 'ROLLBACK');
      expect(mockClient.release).toHaveBeenCalledOnce();
    });

    it('releases client even if rollback fails', async () => {
      const mockClient = {
        query: vi.fn(),
        release: vi.fn(),
      };
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error('ROLLBACK error'));

      mockPoolInstance.connect.mockResolvedValueOnce(mockClient);

      await expect(
        withTransaction(async () => {
          throw new Error('fn failed');
        })
      ).rejects.toThrow('fn failed');

      expect(mockClient.release).toHaveBeenCalledOnce();
    });
  });

  describe('closePool', () => {
    it('calls pool.end and sets pool to null', async () => {
      getPool(); // ensure pool exists
      mockPoolInstance.end.mockResolvedValueOnce(undefined);

      await closePool();
      expect(mockPoolInstance.end).toHaveBeenCalledOnce();

      // After closing, creating pool again calls MockPool again
      MockPool.mockClear();
      getPool();
      expect(MockPool).toHaveBeenCalledOnce();
    });

    it('does nothing when pool is null', async () => {
      // pool is null after afterEach closes it — call closePool again
      await closePool();
      expect(mockPoolInstance.end).not.toHaveBeenCalled();
    });
  });
});
