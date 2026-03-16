// ─── Embedding Service — PGVector Similarity Search ─────────────────────────
//
// Provides upsert + cosine-similarity search over the embeddings table.
// The table schema (vector(1536), ivfflat index) is defined in 001_initial_schema.sql.

import { query, withTransaction } from './pool.js';
import type { QueryResultRow } from 'pg';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EmbeddingSourceType = 'conversation' | 'task' | 'file' | 'note';

export interface Embedding {
  id: string;
  source_type: EmbeddingSourceType;
  source_id: string;
  content: string;
  embedding: number[];
  model: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface EmbeddingInsert {
  source_type: EmbeddingSourceType;
  source_id: string;
  content: string;
  /** Raw float32 vector — must match the table dimension (1536). */
  embedding: number[];
  model?: string;
  metadata?: Record<string, unknown>;
}

export interface SimilarityResult {
  id: string;
  source_type: EmbeddingSourceType;
  source_id: string;
  content: string;
  model: string;
  metadata: Record<string, unknown>;
  created_at: Date;
  /** Cosine similarity score in [0, 1] — higher is more similar. */
  similarity: number;
}

export interface SearchOptions {
  /** Maximum number of results to return (default: 10). */
  limit?: number;
  /** Minimum similarity threshold in [0, 1] (default: 0.7). */
  minSimilarity?: number;
  /** Restrict results to a specific source type. */
  sourceType?: EmbeddingSourceType;
  /** Restrict results to a specific source ID. */
  sourceId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Serialises a float array to the pgvector text literal format: [a,b,c,...] */
function vectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}

// ─── Repository ───────────────────────────────────────────────────────────────

/**
 * Insert a single embedding row.
 * Returns the inserted row's id.
 */
export async function insertEmbedding(insert: EmbeddingInsert): Promise<string> {
  const { source_type, source_id, content, embedding, model = 'text-embedding-3-small', metadata = {} } = insert;

  const res = await query<{ id: string }>(
    `INSERT INTO embeddings (source_type, source_id, content, embedding, model, metadata)
     VALUES ($1, $2, $3, $4::vector, $5, $6)
     RETURNING id`,
    [source_type, source_id, content, vectorLiteral(embedding), model, JSON.stringify(metadata)]
  );
  return res.rows[0].id;
}

/**
 * Upsert embeddings for a given (source_type, source_id) pair.
 * Deletes any existing embedding for that source then inserts the new one.
 * Wrapped in a transaction so the pair is always consistent.
 */
export async function upsertEmbedding(insert: EmbeddingInsert): Promise<string> {
  return withTransaction(async (client) => {
    await client.query(
      `DELETE FROM embeddings WHERE source_type = $1 AND source_id = $2`,
      [insert.source_type, insert.source_id]
    );

    const res = await client.query<{ id: string }>(
      `INSERT INTO embeddings (source_type, source_id, content, embedding, model, metadata)
       VALUES ($1, $2, $3, $4::vector, $5, $6)
       RETURNING id`,
      [
        insert.source_type,
        insert.source_id,
        insert.content,
        vectorLiteral(insert.embedding),
        insert.model ?? 'text-embedding-3-small',
        JSON.stringify(insert.metadata ?? {}),
      ]
    );
    return res.rows[0].id;
  });
}

/**
 * Batch-insert multiple embeddings in a single transaction.
 * Returns the list of inserted ids in the same order as the input.
 */
export async function insertEmbeddingsBatch(inserts: EmbeddingInsert[]): Promise<string[]> {
  if (inserts.length === 0) return [];

  return withTransaction(async (client) => {
    const ids: string[] = [];
    for (const ins of inserts) {
      const res = await client.query<{ id: string }>(
        `INSERT INTO embeddings (source_type, source_id, content, embedding, model, metadata)
         VALUES ($1, $2, $3, $4::vector, $5, $6)
         RETURNING id`,
        [
          ins.source_type,
          ins.source_id,
          ins.content,
          vectorLiteral(ins.embedding),
          ins.model ?? 'text-embedding-3-small',
          JSON.stringify(ins.metadata ?? {}),
        ]
      );
      ids.push(res.rows[0].id);
    }
    return ids;
  });
}

/**
 * Cosine similarity search against the ivfflat index.
 *
 * pgvector uses the <=> operator for cosine distance (lower = more similar).
 * We convert to similarity = 1 - distance so higher = more similar.
 */
export async function searchSimilar(
  queryEmbedding: number[],
  options: SearchOptions = {}
): Promise<SimilarityResult[]> {
  const {
    limit = 10,
    minSimilarity = 0.7,
    sourceType,
    sourceId,
  } = options;

  const conditions: string[] = [];
  const params: unknown[] = [vectorLiteral(queryEmbedding), limit];
  let paramIdx = 3;

  if (sourceType) {
    conditions.push(`source_type = $${paramIdx++}`);
    params.push(sourceType);
  }
  if (sourceId) {
    conditions.push(`source_id = $${paramIdx++}`);
    params.push(sourceId);
  }
  // Filter by minimum similarity (1 - cosine_distance >= minSimilarity)
  conditions.push(`1 - (embedding <=> $1::vector) >= $${paramIdx++}`);
  params.push(minSimilarity);

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const res = await query<SimilarityResult & QueryResultRow>(
    `SELECT
       id,
       source_type,
       source_id,
       content,
       model,
       metadata,
       created_at,
       1 - (embedding <=> $1::vector) AS similarity
     FROM embeddings
     ${where}
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    params
  );

  return res.rows;
}

/**
 * Delete all embeddings for a given (source_type, source_id) pair.
 * Returns the number of rows deleted.
 */
export async function deleteEmbeddingsBySource(
  source_type: EmbeddingSourceType,
  source_id: string
): Promise<number> {
  const res = await query(
    `DELETE FROM embeddings WHERE source_type = $1 AND source_id = $2`,
    [source_type, source_id]
  );
  return res.rowCount ?? 0;
}

/**
 * Fetch a single embedding row by its primary key.
 */
export async function getEmbeddingById(id: string): Promise<Embedding | null> {
  const res = await query<Embedding & QueryResultRow>(
    `SELECT id, source_type, source_id, content, embedding, model, metadata, created_at
     FROM embeddings
     WHERE id = $1`,
    [id]
  );
  return res.rows[0] ?? null;
}

/**
 * Count embeddings grouped by source_type — useful for monitoring.
 */
export async function countEmbeddingsByType(): Promise<Record<EmbeddingSourceType, number>> {
  const res = await query<{ source_type: string; count: string } & QueryResultRow>(
    `SELECT source_type, COUNT(*)::int AS count FROM embeddings GROUP BY source_type`
  );

  const result: Record<string, number> = {};
  for (const row of res.rows) {
    result[row.source_type] = Number(row.count);
  }
  return result as Record<EmbeddingSourceType, number>;
}
