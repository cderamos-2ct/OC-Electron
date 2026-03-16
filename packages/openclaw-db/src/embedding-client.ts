// ─── Embedding Client — OpenAI text-embedding-3-small wrapper ────────────────
//
// Lightweight client for generating vector embeddings via the OpenAI API.
// Configured via OPENAI_API_KEY environment variable.
// Produces 1536-dimensional vectors compatible with the embeddings table.

const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';
const DEFAULT_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

export interface EmbeddingClientOptions {
  /** OpenAI API key. Defaults to process.env.OPENAI_API_KEY. */
  apiKey?: string;
  /** Embedding model to use. Defaults to text-embedding-3-small. */
  model?: string;
}

function getApiKey(opts?: EmbeddingClientOptions): string {
  const key = opts?.apiKey ?? process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      '[embedding-client] OPENAI_API_KEY is not set. ' +
      'Set the environment variable or pass apiKey in options.'
    );
  }
  return key;
}

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
}

async function callOpenAI(
  input: string | string[],
  model: string,
  apiKey: string
): Promise<number[][]> {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input, dimensions: EMBEDDING_DIMENSIONS }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `[embedding-client] OpenAI API error ${response.status}: ${body}`
    );
  }

  const json = (await response.json()) as OpenAIEmbeddingResponse;

  // Sort by index to guarantee order matches input array
  return json.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

/**
 * Generate a single embedding vector for the given text.
 *
 * @param text   The text to embed.
 * @param opts   Optional API key / model override.
 * @returns      A 1536-dimensional float array.
 */
export async function generateEmbedding(
  text: string,
  opts?: EmbeddingClientOptions
): Promise<number[]> {
  const apiKey = getApiKey(opts);
  const model = opts?.model ?? DEFAULT_MODEL;
  const vectors = await callOpenAI(text, model, apiKey);
  return vectors[0];
}

/**
 * Generate embedding vectors for multiple texts in a single API call.
 * The returned array is in the same order as the input array.
 *
 * OpenAI supports batching up to 2048 inputs per request; for larger batches
 * this function chunks automatically at 100 items to stay well within limits.
 *
 * @param texts  Array of texts to embed.
 * @param opts   Optional API key / model override.
 * @returns      Array of 1536-dimensional float arrays, one per input text.
 */
export async function generateEmbeddings(
  texts: string[],
  opts?: EmbeddingClientOptions
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const apiKey = getApiKey(opts);
  const model = opts?.model ?? DEFAULT_MODEL;

  const CHUNK_SIZE = 100;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
    const chunk = texts.slice(i, i + CHUNK_SIZE);
    const vectors = await callOpenAI(chunk, model, apiKey);
    results.push(...vectors);
  }

  return results;
}

export { DEFAULT_MODEL as EMBEDDING_MODEL, EMBEDDING_DIMENSIONS };
