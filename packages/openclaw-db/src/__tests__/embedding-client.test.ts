import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock global fetch ────────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Import after mock
const { generateEmbedding, generateEmbeddings, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } =
  await import('../embedding-client.js');

// Helper: build a mock OpenAI embeddings response
function makeOpenAIResponse(embeddings: number[][]): object {
  return {
    data: embeddings.map((embedding, index) => ({ embedding, index })),
    model: 'text-embedding-3-small',
    usage: { prompt_tokens: 10, total_tokens: 10 },
  };
}

function mockFetchOk(embeddings: number[][]) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => makeOpenAIResponse(embeddings),
  });
}

function mockFetchError(status: number, body: string) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    text: async () => body,
  });
}

describe('embedding-client.ts', () => {
  const originalEnv = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalEnv;
  });

  describe('constants', () => {
    it('exports EMBEDDING_MODEL as text-embedding-3-small', () => {
      expect(EMBEDDING_MODEL).toBe('text-embedding-3-small');
    });

    it('exports EMBEDDING_DIMENSIONS as 1536', () => {
      expect(EMBEDDING_DIMENSIONS).toBe(1536);
    });
  });

  describe('generateEmbedding', () => {
    it('calls OpenAI API with correct payload', async () => {
      const fakeVector = new Array(1536).fill(0.1);
      mockFetchOk([fakeVector]);

      await generateEmbedding('hello world');

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.openai.com/v1/embeddings');
      expect(options.method).toBe('POST');
      expect(options.headers['Authorization']).toBe('Bearer test-api-key');
      expect(options.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(options.body);
      expect(body.model).toBe('text-embedding-3-small');
      expect(body.input).toBe('hello world');
      expect(body.dimensions).toBe(1536);
    });

    it('returns first embedding vector', async () => {
      const fakeVector = new Array(1536).fill(0.42);
      mockFetchOk([fakeVector]);

      const result = await generateEmbedding('test');
      expect(result).toEqual(fakeVector);
    });

    it('uses apiKey from options over env var', async () => {
      const fakeVector = new Array(1536).fill(0.1);
      mockFetchOk([fakeVector]);

      await generateEmbedding('test', { apiKey: 'custom-key' });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer custom-key');
    });

    it('uses custom model when provided', async () => {
      const fakeVector = new Array(1536).fill(0.1);
      mockFetchOk([fakeVector]);

      await generateEmbedding('test', { model: 'text-embedding-ada-002' });

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.model).toBe('text-embedding-ada-002');
    });

    it('throws when OPENAI_API_KEY is not set and no opts.apiKey', async () => {
      delete process.env.OPENAI_API_KEY;
      await expect(generateEmbedding('test')).rejects.toThrow(
        'OPENAI_API_KEY is not set'
      );
    });

    it('throws on non-ok API response', async () => {
      mockFetchError(401, 'Unauthorized');
      await expect(generateEmbedding('test')).rejects.toThrow(
        'OpenAI API error 401: Unauthorized'
      );
    });

    it('handles empty body on API error gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => { throw new Error('no body'); },
      });
      await expect(generateEmbedding('test')).rejects.toThrow('OpenAI API error 500');
    });
  });

  describe('generateEmbeddings', () => {
    it('returns empty array for empty input', async () => {
      const result = await generateEmbeddings([]);
      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns embeddings in input order (sorted by index)', async () => {
      const vec1 = new Array(1536).fill(0.1);
      const vec2 = new Array(1536).fill(0.2);
      const vec3 = new Array(1536).fill(0.3);

      // Return them out-of-order to test sort
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { embedding: vec3, index: 2 },
            { embedding: vec1, index: 0 },
            { embedding: vec2, index: 1 },
          ],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 30, total_tokens: 30 },
        }),
      });

      const result = await generateEmbeddings(['a', 'b', 'c']);
      expect(result[0]).toEqual(vec1);
      expect(result[1]).toEqual(vec2);
      expect(result[2]).toEqual(vec3);
    });

    it('chunks input at 100 items per request', async () => {
      const texts = Array.from({ length: 250 }, (_, i) => `text-${i}`);
      const fakeVec = new Array(1536).fill(0.5);

      // First chunk: 100 items
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: Array.from({ length: 100 }, (_, i) => ({ embedding: fakeVec, index: i })),
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 100, total_tokens: 100 },
        }),
      });
      // Second chunk: 100 items
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: Array.from({ length: 100 }, (_, i) => ({ embedding: fakeVec, index: i })),
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 100, total_tokens: 100 },
        }),
      });
      // Third chunk: 50 items
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: Array.from({ length: 50 }, (_, i) => ({ embedding: fakeVec, index: i })),
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 50, total_tokens: 50 },
        }),
      });

      const result = await generateEmbeddings(texts);
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(250);
    });

    it('makes single request for <=100 items', async () => {
      const texts = Array.from({ length: 5 }, (_, i) => `text-${i}`);
      const fakeVec = new Array(1536).fill(0.5);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: Array.from({ length: 5 }, (_, i) => ({ embedding: fakeVec, index: i })),
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 5, total_tokens: 5 },
        }),
      });

      await generateEmbeddings(texts);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
