// ─── Shell Embedding Service ─────────────────────────────────────────────────
//
// Wires the openclaw-db embedding module + embedding-client into the Electron
// main process. Provides high-level methods for embedding conversations and
// tasks, and semantic search across both.

import {
  upsertEmbedding,
  insertEmbeddingsBatch,
  searchSimilar,
  generateEmbedding,
  generateEmbeddings,
  type EmbeddingSourceType,
  type SimilarityResult,
  type EmbeddingClientOptions,
} from 'openclaw-db';

export interface ConversationSearchResult extends SimilarityResult {
  source_type: 'conversation';
}

export interface TaskSearchResult extends SimilarityResult {
  source_type: 'task';
}

// ─── Embedding operations ─────────────────────────────────────────────────────

/**
 * Embed a conversation message and store it for semantic search.
 *
 * @param conversationId  UUID of the conversation row.
 * @param content         The message text to embed.
 * @param opts            Optional embedding client overrides (API key, model).
 * @returns               The inserted/updated embedding UUID.
 */
export async function embedConversation(
  conversationId: string,
  content: string,
  opts?: EmbeddingClientOptions
): Promise<string> {
  const embedding = await generateEmbedding(content, opts);
  return upsertEmbedding({
    source_type: 'conversation',
    source_id: conversationId,
    content,
    embedding,
    model: opts?.model,
  });
}

/**
 * Embed a task (title + description concatenated) and store it for semantic search.
 *
 * @param taskId       UUID of the task row.
 * @param title        Task title.
 * @param description  Task description (may be empty string).
 * @param opts         Optional embedding client overrides.
 * @returns            The inserted/updated embedding UUID.
 */
export async function embedTask(
  taskId: string,
  title: string,
  description: string,
  opts?: EmbeddingClientOptions
): Promise<string> {
  const content = description ? `${title}\n\n${description}` : title;
  const embedding = await generateEmbedding(content, opts);
  return upsertEmbedding({
    source_type: 'task',
    source_id: taskId,
    content,
    embedding,
    model: opts?.model,
  });
}

/**
 * Batch-embed multiple conversations in a single OpenAI API call.
 * More efficient than calling embedConversation() in a loop.
 *
 * @param items  Array of { conversationId, content } objects.
 * @param opts   Optional embedding client overrides.
 * @returns      Map of conversationId → embedding UUID.
 */
export async function embedConversationsBatch(
  items: Array<{ conversationId: string; content: string }>,
  opts?: EmbeddingClientOptions
): Promise<Map<string, string>> {
  if (items.length === 0) return new Map();

  const texts = items.map((i) => i.content);
  const vectors = await generateEmbeddings(texts, opts);

  const ids = await insertEmbeddingsBatch(
    items.map((item, i) => ({
      source_type: 'conversation' as EmbeddingSourceType,
      source_id: item.conversationId,
      content: item.content,
      embedding: vectors[i],
      model: opts?.model,
    }))
  );

  const result = new Map<string, string>();
  for (let i = 0; i < items.length; i++) {
    result.set(items[i].conversationId, ids[i]);
  }
  return result;
}

// ─── Semantic search ──────────────────────────────────────────────────────────

/**
 * Semantic search across conversation embeddings.
 *
 * @param query    Natural-language query string.
 * @param limit    Maximum results (default 10).
 * @param opts     Optional embedding client overrides.
 * @returns        Ranked conversation results with similarity scores.
 */
export async function searchConversations(
  query: string,
  limit = 10,
  opts?: EmbeddingClientOptions
): Promise<ConversationSearchResult[]> {
  const queryEmbedding = await generateEmbedding(query, opts);
  const results = await searchSimilar(queryEmbedding, {
    sourceType: 'conversation' as EmbeddingSourceType,
    limit,
    minSimilarity: 0.6,
  });
  return results as ConversationSearchResult[];
}

/**
 * Semantic search across task embeddings.
 *
 * @param query    Natural-language query string.
 * @param limit    Maximum results (default 10).
 * @param opts     Optional embedding client overrides.
 * @returns        Ranked task results with similarity scores.
 */
export async function searchTasks(
  query: string,
  limit = 10,
  opts?: EmbeddingClientOptions
): Promise<TaskSearchResult[]> {
  const queryEmbedding = await generateEmbedding(query, opts);
  const results = await searchSimilar(queryEmbedding, {
    sourceType: 'task' as EmbeddingSourceType,
    limit,
    minSimilarity: 0.6,
  });
  return results as TaskSearchResult[];
}
