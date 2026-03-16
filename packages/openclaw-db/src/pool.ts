import pg from 'pg';

const { Pool } = pg;

export interface DbConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
}

let pool: InstanceType<typeof Pool> | null = null;

/**
 * Get or create the shared Postgres connection pool (singleton).
 *
 * Initialises the pool on first call using `config` or environment variables
 * (`DATABASE_URL`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`,
 * `DB_SSL`). Subsequent calls return the existing pool regardless of the
 * `config` argument.
 *
 * Pool is sized at max 20 connections to support 16 concurrent agents with 4
 * connections of headroom for migrations and ad-hoc queries.
 *
 * @param config - Optional connection parameters. Falls back to env vars.
 * @returns The shared `pg.Pool` instance.
 */
export function getPool(config?: DbConfig): InstanceType<typeof Pool> {
  if (pool) return pool;

  const connectionString =
    config?.connectionString ?? process.env.DATABASE_URL;

  pool = new Pool({
    connectionString,
    host: config?.host ?? process.env.DB_HOST ?? 'localhost',
    port: config?.port ?? Number(process.env.DB_PORT ?? 5432),
    database: config?.database ?? process.env.DB_NAME ?? 'openclaw',
    user: config?.user ?? process.env.DB_USER ?? 'openclaw',
    password: config?.password ?? process.env.DB_PASSWORD,
    ssl: config?.ssl ?? (process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false),
    max: 20,                // supports 16 agents + 4 headroom
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  pool.on('error', (err) => {
    console.error('[openclaw-db] Unexpected pool error:', err);
  });

  return pool;
}

/**
 * Execute a query against the pool.
 */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const p = getPool();
  return p.query<T>(text, params);
}

/**
 * Get a dedicated client from the pool (for transactions).
 */
export async function getClient(): Promise<pg.PoolClient> {
  const p = getPool();
  return p.connect();
}

/**
 * Run a callback inside a Postgres transaction.
 *
 * Acquires a dedicated client from the pool, issues `BEGIN`, then calls `fn`.
 * If `fn` resolves, the transaction is `COMMIT`ted and the result returned.
 * If `fn` throws (or `COMMIT` fails), the transaction is rolled back and the
 * original error is re-thrown. The client is always released to the pool in
 * the `finally` block.
 *
 * @param fn - Async callback that receives the transactional `pg.PoolClient`.
 * @returns The value returned by `fn`.
 * @throws Re-throws any error from `fn` after rolling back.
 *
 * @example
 * const result = await withTransaction(async (client) => {
 *   await client.query('INSERT INTO agents ...', [...]);
 *   await client.query('INSERT INTO audit_log ...', [...]);
 *   return 'done';
 * });
 */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Swallow ROLLBACK errors — always re-throw the original error
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Close the pool (call on shutdown).
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
