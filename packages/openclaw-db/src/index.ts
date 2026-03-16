// openclaw-db — public API

export {
  getPool,
  query,
  getClient,
  withTransaction,
  closePool,
} from './pool.js';

export type { DbConfig } from './pool.js';

export { runMigrations } from './migrations/index.js';
export { runSeeds } from './seeds/index.js';

// Embedding service (pgvector)
export {
  insertEmbedding,
  upsertEmbedding,
  insertEmbeddingsBatch,
  searchSimilar,
  deleteEmbeddingsBySource,
  getEmbeddingById,
  countEmbeddingsByType,
} from './embeddings.js';

export type {
  Embedding,
  EmbeddingInsert,
  EmbeddingSourceType,
  SimilarityResult,
  SearchOptions,
} from './embeddings.js';

// Agent session / conversation layer
export {
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
} from './agent-sessions.js';

export type {
  Agent,
  AgentUpsert,
  AgentStatus,
  AgentRole,
  AgentProvider,
  Conversation,
  ConversationInsert,
  ConversationDirection,
  ConversationRole,
  ConversationListOptions,
  AuditLogEntry,
  AuditLogInsert,
} from './agent-sessions.js';

// Embedding client (OpenAI API wrapper)
export {
  generateEmbedding,
  generateEmbeddings,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
} from './embedding-client.js';

export type { EmbeddingClientOptions } from './embedding-client.js';

// Re-export common pg types for consumers
export type { PoolClient, QueryResult, QueryResultRow } from 'pg';
