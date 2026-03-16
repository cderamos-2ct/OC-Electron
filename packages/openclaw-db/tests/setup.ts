// Global test setup for openclaw-db
// Mocks pg Pool so tests don't require a live database
import { vi } from 'vitest';

// Mock the pg module globally
vi.mock('pg', () => {
  const mockClient = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
  };

  const MockPool = vi.fn().mockImplementation(() => ({
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    connect: vi.fn().mockResolvedValue(mockClient),
    end: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0,
  }));

  return { Pool: MockPool, default: { Pool: MockPool } };
});

// Mock pgvector
vi.mock('pgvector', () => ({
  default: {
    toSql: vi.fn((arr: number[]) => `[${arr.join(',')}]`),
  },
}));
