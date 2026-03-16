import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock pool module ─────────────────────────────────────────────────────────
const mockQuery = vi.fn();
const mockWithTransaction = vi.fn();

vi.mock('../pool.js', () => ({
  query: mockQuery,
  withTransaction: mockWithTransaction,
}));

const {
  insertEmbedding,
  upsertEmbedding,
  insertEmbeddingsBatch,
  searchSimilar,
  deleteEmbeddingsBySource,
  getEmbeddingById,
  countEmbeddingsByType,
} = await import('../embeddings.js');

// Helper: build a fake vector literal string
function vecLiteral(len = 3, val = 0.1) {
  return `[${Array(len).fill(val).join(',')}]`;
}

const FAKE_VEC = Array(1536).fill(0.1);
const FAKE_VEC_LITERAL = `[${FAKE_VEC.join(',')}]`;

describe('embeddings.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('insertEmbedding', () => {
    it('inserts embedding and returns id', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'abc-123' }] });

      const id = await insertEmbedding({
        source_type: 'conversation',
        source_id: 'conv-1',
        content: 'hello world',
        embedding: FAKE_VEC,
      });

      expect(id).toBe('abc-123');
      expect(mockQuery).toHaveBeenCalledOnce();
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('INSERT INTO embeddings');
      expect(sql).toContain('RETURNING id');
      expect(params[0]).toBe('conversation');
      expect(params[1]).toBe('conv-1');
      expect(params[2]).toBe('hello world');
      expect(params[3]).toBe(FAKE_VEC_LITERAL); // vectorLiteral output
      expect(params[4]).toBe('text-embedding-3-small'); // default model
      expect(params[5]).toBe('{}'); // default metadata
    });

    it('uses provided model and metadata', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'def-456' }] });

      await insertEmbedding({
        source_type: 'task',
        source_id: 'task-1',
        content: 'test task',
        embedding: FAKE_VEC,
        model: 'text-embedding-ada-002',
        metadata: { priority: 'high' },
      });

      const [, params] = mockQuery.mock.calls[0];
      expect(params[4]).toBe('text-embedding-ada-002');
      expect(params[5]).toBe(JSON.stringify({ priority: 'high' }));
    });
  });

  describe('upsertEmbedding', () => {
    it('calls withTransaction, deletes then inserts', async () => {
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [] })             // DELETE
          .mockResolvedValueOnce({ rows: [{ id: 'xyz-789' }] }), // INSERT
      };

      mockWithTransaction.mockImplementationOnce(async (fn) => fn(mockClient));

      const id = await upsertEmbedding({
        source_type: 'file',
        source_id: 'file-1',
        content: 'file content',
        embedding: FAKE_VEC,
      });

      expect(id).toBe('xyz-789');
      expect(mockClient.query).toHaveBeenCalledTimes(2);

      const [deleteSql, deleteParams] = mockClient.query.mock.calls[0];
      expect(deleteSql).toContain('DELETE FROM embeddings');
      expect(deleteParams).toEqual(['file', 'file-1']);

      const [insertSql] = mockClient.query.mock.calls[1];
      expect(insertSql).toContain('INSERT INTO embeddings');
    });
  });

  describe('insertEmbeddingsBatch', () => {
    it('returns empty array for empty input', async () => {
      const result = await insertEmbeddingsBatch([]);
      expect(result).toEqual([]);
      expect(mockWithTransaction).not.toHaveBeenCalled();
    });

    it('inserts all embeddings in a transaction and returns ids in order', async () => {
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [{ id: 'id-1' }] })
          .mockResolvedValueOnce({ rows: [{ id: 'id-2' }] })
          .mockResolvedValueOnce({ rows: [{ id: 'id-3' }] }),
      };

      mockWithTransaction.mockImplementationOnce(async (fn) => fn(mockClient));

      const ids = await insertEmbeddingsBatch([
        { source_type: 'conversation', source_id: 'c1', content: 'a', embedding: FAKE_VEC },
        { source_type: 'task', source_id: 't1', content: 'b', embedding: FAKE_VEC },
        { source_type: 'note', source_id: 'n1', content: 'c', embedding: FAKE_VEC },
      ]);

      expect(ids).toEqual(['id-1', 'id-2', 'id-3']);
      expect(mockClient.query).toHaveBeenCalledTimes(3);
    });
  });

  describe('searchSimilar', () => {
    it('queries with default options', async () => {
      const mockRows = [
        {
          id: 'emb-1',
          source_type: 'conversation',
          source_id: 'c1',
          content: 'hello',
          model: 'text-embedding-3-small',
          metadata: {},
          created_at: new Date(),
          similarity: 0.95,
        },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockRows });

      const results = await searchSimilar(FAKE_VEC);

      expect(results).toEqual(mockRows);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('SELECT');
      expect(sql).toContain('similarity');
      expect(sql).toContain('ORDER BY embedding <=>');
      expect(params[0]).toBe(FAKE_VEC_LITERAL);
      expect(params[1]).toBe(10); // default limit
    });

    it('applies sourceType filter', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await searchSimilar(FAKE_VEC, { sourceType: 'task' });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('source_type = $3');
      expect(params).toContain('task');
    });

    it('applies sourceId filter', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await searchSimilar(FAKE_VEC, { sourceId: 'my-source' });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('source_id = $');
      expect(params).toContain('my-source');
    });

    it('applies custom limit and minSimilarity', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await searchSimilar(FAKE_VEC, { limit: 5, minSimilarity: 0.9 });

      const [, params] = mockQuery.mock.calls[0];
      expect(params[1]).toBe(5);
      expect(params).toContain(0.9);
    });

    it('applies both sourceType and sourceId filters', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await searchSimilar(FAKE_VEC, { sourceType: 'file', sourceId: 'f-1' });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('source_type = $3');
      expect(sql).toContain('source_id = $4');
      expect(params).toContain('file');
      expect(params).toContain('f-1');
    });
  });

  describe('deleteEmbeddingsBySource', () => {
    it('deletes embeddings and returns rowCount', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 3 });

      const count = await deleteEmbeddingsBySource('task', 'task-1');

      expect(count).toBe(3);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('DELETE FROM embeddings');
      expect(params).toEqual(['task', 'task-1']);
    });

    it('returns 0 when rowCount is null', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: null });

      const count = await deleteEmbeddingsBySource('note', 'n-1');
      expect(count).toBe(0);
    });
  });

  describe('getEmbeddingById', () => {
    it('returns embedding when found', async () => {
      const fakeEmb = {
        id: 'emb-1',
        source_type: 'conversation',
        source_id: 'c1',
        content: 'hello',
        embedding: FAKE_VEC,
        model: 'text-embedding-3-small',
        metadata: {},
        created_at: new Date(),
      };
      mockQuery.mockResolvedValueOnce({ rows: [fakeEmb] });

      const result = await getEmbeddingById('emb-1');
      expect(result).toBe(fakeEmb);
      const [, params] = mockQuery.mock.calls[0];
      expect(params).toEqual(['emb-1']);
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await getEmbeddingById('missing-id');
      expect(result).toBeNull();
    });
  });

  describe('countEmbeddingsByType', () => {
    it('returns counts grouped by source_type', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { source_type: 'conversation', count: '42' },
          { source_type: 'task', count: '7' },
          { source_type: 'file', count: '3' },
        ],
      });

      const result = await countEmbeddingsByType();

      expect(result).toEqual({
        conversation: 42,
        task: 7,
        file: 3,
      });
    });

    it('returns empty object when no embeddings', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await countEmbeddingsByType();
      expect(result).toEqual({});
    });
  });
});
