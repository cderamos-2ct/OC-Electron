// Tests for services/embedding-service.ts
// Mocks: openclaw-db (upsertEmbedding, insertEmbeddingsBatch, searchSimilar, generateEmbedding, generateEmbeddings)

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('openclaw-db', () => ({
  upsertEmbedding: vi.fn(),
  insertEmbeddingsBatch: vi.fn(),
  searchSimilar: vi.fn(),
  generateEmbedding: vi.fn(),
  generateEmbeddings: vi.fn(),
}));

import {
  upsertEmbedding,
  insertEmbeddingsBatch,
  searchSimilar,
  generateEmbedding,
  generateEmbeddings,
} from 'openclaw-db';

import {
  embedConversation,
  embedTask,
  embedConversationsBatch,
  searchConversations,
  searchTasks,
} from '../../services/embedding-service.js';

const mockGenerateEmbedding = vi.mocked(generateEmbedding);
const mockGenerateEmbeddings = vi.mocked(generateEmbeddings);
const mockUpsertEmbedding = vi.mocked(upsertEmbedding);
const mockInsertEmbeddingsBatch = vi.mocked(insertEmbeddingsBatch);
const mockSearchSimilar = vi.mocked(searchSimilar);

const FAKE_VECTOR = [0.1, 0.2, 0.3];
const FAKE_UUID = 'embed-uuid-001';

beforeEach(() => {
  vi.clearAllMocks();
  mockGenerateEmbedding.mockResolvedValue(FAKE_VECTOR);
  mockGenerateEmbeddings.mockResolvedValue([FAKE_VECTOR, FAKE_VECTOR]);
  mockUpsertEmbedding.mockResolvedValue(FAKE_UUID);
  mockInsertEmbeddingsBatch.mockResolvedValue([FAKE_UUID, 'embed-uuid-002']);
  mockSearchSimilar.mockResolvedValue([]);
});

// ─── embedConversation ─────────────────────────────────────────────────────────

describe('embedConversation', () => {
  it('generates embedding and upserts with source_type=conversation', async () => {
    const result = await embedConversation('conv-id-1', 'Hello world');

    expect(mockGenerateEmbedding).toHaveBeenCalledWith('Hello world', undefined);
    expect(mockUpsertEmbedding).toHaveBeenCalledWith({
      source_type: 'conversation',
      source_id: 'conv-id-1',
      content: 'Hello world',
      embedding: FAKE_VECTOR,
      model: undefined,
    });
    expect(result).toBe(FAKE_UUID);
  });

  it('passes custom opts to generateEmbedding', async () => {
    const opts = { model: 'text-embedding-3-large', apiKey: 'sk-test' };
    await embedConversation('conv-id-2', 'Some content', opts);

    expect(mockGenerateEmbedding).toHaveBeenCalledWith('Some content', opts);
    expect(mockUpsertEmbedding).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'text-embedding-3-large' }),
    );
  });
});

// ─── embedTask ─────────────────────────────────────────────────────────────────

describe('embedTask', () => {
  it('concatenates title and description with newline separator', async () => {
    await embedTask('task-id-1', 'Fix login bug', 'Users cannot log in after password reset');

    expect(mockGenerateEmbedding).toHaveBeenCalledWith(
      'Fix login bug\n\nUsers cannot log in after password reset',
      undefined,
    );
    expect(mockUpsertEmbedding).toHaveBeenCalledWith(
      expect.objectContaining({
        source_type: 'task',
        source_id: 'task-id-1',
        content: 'Fix login bug\n\nUsers cannot log in after password reset',
      }),
    );
  });

  it('uses only title when description is empty', async () => {
    await embedTask('task-id-2', 'Quick fix', '');

    expect(mockGenerateEmbedding).toHaveBeenCalledWith('Quick fix', undefined);
    expect(mockUpsertEmbedding).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Quick fix' }),
    );
  });

  it('returns the embedding UUID', async () => {
    const id = await embedTask('task-id-3', 'Title', 'Desc');
    expect(id).toBe(FAKE_UUID);
  });
});

// ─── embedConversationsBatch ───────────────────────────────────────────────────

describe('embedConversationsBatch', () => {
  it('returns empty map for empty input', async () => {
    const result = await embedConversationsBatch([]);
    expect(result.size).toBe(0);
    expect(mockGenerateEmbeddings).not.toHaveBeenCalled();
  });

  it('generates embeddings in batch and returns id map', async () => {
    mockInsertEmbeddingsBatch.mockResolvedValueOnce(['id-a', 'id-b']);

    const items = [
      { conversationId: 'conv-a', content: 'Message A' },
      { conversationId: 'conv-b', content: 'Message B' },
    ];

    const result = await embedConversationsBatch(items);

    expect(mockGenerateEmbeddings).toHaveBeenCalledWith(['Message A', 'Message B'], undefined);
    expect(mockInsertEmbeddingsBatch).toHaveBeenCalledWith([
      expect.objectContaining({ source_type: 'conversation', source_id: 'conv-a', content: 'Message A' }),
      expect.objectContaining({ source_type: 'conversation', source_id: 'conv-b', content: 'Message B' }),
    ]);

    expect(result.get('conv-a')).toBe('id-a');
    expect(result.get('conv-b')).toBe('id-b');
  });

  it('passes opts to generateEmbeddings and batch insert', async () => {
    mockInsertEmbeddingsBatch.mockResolvedValueOnce(['id-c']);
    const opts = { model: 'text-embedding-3-small' };

    await embedConversationsBatch([{ conversationId: 'conv-c', content: 'Msg C' }], opts);

    expect(mockGenerateEmbeddings).toHaveBeenCalledWith(['Msg C'], opts);
    expect(mockInsertEmbeddingsBatch).toHaveBeenCalledWith([
      expect.objectContaining({ model: 'text-embedding-3-small' }),
    ]);
  });
});

// ─── searchConversations ───────────────────────────────────────────────────────

describe('searchConversations', () => {
  const fakeResults = [
    { id: 'e1', source_type: 'conversation', source_id: 'conv-1', content: 'Hello', similarity: 0.92 },
    { id: 'e2', source_type: 'conversation', source_id: 'conv-2', content: 'World', similarity: 0.81 },
  ];

  it('generates query embedding and searches with conversation filter', async () => {
    mockSearchSimilar.mockResolvedValueOnce(fakeResults as any);

    const results = await searchConversations('greeting messages');

    expect(mockGenerateEmbedding).toHaveBeenCalledWith('greeting messages', undefined);
    expect(mockSearchSimilar).toHaveBeenCalledWith(FAKE_VECTOR, {
      sourceType: 'conversation',
      limit: 10,
      minSimilarity: 0.6,
    });
    expect(results).toHaveLength(2);
    expect(results[0].similarity).toBe(0.92);
  });

  it('uses custom limit', async () => {
    mockSearchSimilar.mockResolvedValueOnce([]);
    await searchConversations('query', 5);
    expect(mockSearchSimilar).toHaveBeenCalledWith(FAKE_VECTOR, expect.objectContaining({ limit: 5 }));
  });

  it('passes opts to generateEmbedding', async () => {
    mockSearchSimilar.mockResolvedValueOnce([]);
    const opts = { apiKey: 'sk-custom' };
    await searchConversations('query', 10, opts);
    expect(mockGenerateEmbedding).toHaveBeenCalledWith('query', opts);
  });
});

// ─── searchTasks ───────────────────────────────────────────────────────────────

describe('searchTasks', () => {
  it('searches with task filter and returns ranked results', async () => {
    const fakeTaskResults = [
      { id: 'e3', source_type: 'task', source_id: 'task-1', content: 'Fix bug', similarity: 0.88 },
    ];
    mockSearchSimilar.mockResolvedValueOnce(fakeTaskResults as any);

    const results = await searchTasks('fix login issues');

    expect(mockSearchSimilar).toHaveBeenCalledWith(FAKE_VECTOR, {
      sourceType: 'task',
      limit: 10,
      minSimilarity: 0.6,
    });
    expect(results).toHaveLength(1);
    expect(results[0].source_id).toBe('task-1');
  });

  it('returns empty array when no similar tasks found', async () => {
    mockSearchSimilar.mockResolvedValueOnce([]);
    const results = await searchTasks('obscure query');
    expect(results).toHaveLength(0);
  });

  it('uses custom limit', async () => {
    mockSearchSimilar.mockResolvedValueOnce([]);
    await searchTasks('query', 3);
    expect(mockSearchSimilar).toHaveBeenCalledWith(FAKE_VECTOR, expect.objectContaining({ limit: 3 }));
  });
});
