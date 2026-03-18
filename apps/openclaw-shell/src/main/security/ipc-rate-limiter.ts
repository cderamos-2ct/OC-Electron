/**
 * IPC Rate Limiting — Token Bucket Middleware
 *
 * Keyed by webContents.id + agentId (when present on api.* channels).
 * Limits are per-channel-class; mutating channels get tighter budgets.
 */

import type { IpcMainInvokeEvent } from 'electron';

// ─── Token Bucket ─────────────────────────────────────────────────

interface Bucket {
  tokens: number;
  lastRefill: number; // ms timestamp
  maxTokens: number;
  refillRate: number; // tokens per ms
}

// ─── Channel Config ───────────────────────────────────────────────

export interface ChannelRateConfig {
  maxTokens: number;
  refillRatePerMin: number; // tokens added per minute
}

/** Per-channel rate limits (tokens/min). Lower = stricter. */
export const RATE_LIMIT_CONFIG: Record<string, ChannelRateConfig> = {
  'api.gmail.send-draft': { maxTokens: 5,   refillRatePerMin: 5   },
  'api.gmail.delete':     { maxTokens: 5,   refillRatePerMin: 5   },
  'api.gmail.batch-modify': { maxTokens: 5, refillRatePerMin: 5   },
  'api.gmail.draft':      { maxTokens: 10,  refillRatePerMin: 10  },
  'api.github.merge':     { maxTokens: 5,   refillRatePerMin: 5   },
  'api.github.review':    { maxTokens: 10,  refillRatePerMin: 10  },
  'api.github.comment':   { maxTokens: 10,  refillRatePerMin: 10  },
  'approval:decide':      { maxTokens: 20,  refillRatePerMin: 20  },
  'gateway:rpc':          { maxTokens: 60,  refillRatePerMin: 60  },
  'gateway:agent-rpc':    { maxTokens: 60,  refillRatePerMin: 60  },
};

/** Default budget for vault:* channels */
const VAULT_CONFIG: ChannelRateConfig = { maxTokens: 10, refillRatePerMin: 10 };

/** Default budget for read-only / shell channels */
const READ_ONLY_CONFIG: ChannelRateConfig = { maxTokens: 120, refillRatePerMin: 120 };

/** Multiplier applied during bootstrap phase */
const BOOTSTRAP_MULTIPLIER = 10;

// ─── Rate Limiter ─────────────────────────────────────────────────

export class IpcRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private bootstrapMode = false;

  /** Enable elevated limits during first-run bootstrap phase. */
  setBootstrapMode(enabled: boolean): void {
    this.bootstrapMode = enabled;
  }

  /** Resolve config for a channel name. */
  private resolveConfig(channel: string): ChannelRateConfig {
    if (RATE_LIMIT_CONFIG[channel]) return RATE_LIMIT_CONFIG[channel];
    if (channel.startsWith('vault:')) return VAULT_CONFIG;
    return READ_ONLY_CONFIG;
  }

  /**
   * Attempt to consume one token from the bucket identified by key.
   * Returns { allowed: true } or { allowed: false, retryAfter: ms }.
   */
  tryConsume(key: string, channel: string): { allowed: true } | { allowed: false; retryAfter: number } {
    const cfg = this.resolveConfig(channel);
    const maxTokens = this.bootstrapMode ? cfg.maxTokens * BOOTSTRAP_MULTIPLIER : cfg.maxTokens;
    const refillRatePerMs = (this.bootstrapMode ? cfg.refillRatePerMin * BOOTSTRAP_MULTIPLIER : cfg.refillRatePerMin) / 60_000;

    const now = Date.now();

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: maxTokens, lastRefill: now, maxTokens, refillRate: refillRatePerMs };
      this.buckets.set(key, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    const refilled = elapsed * refillRatePerMs;
    bucket.tokens = Math.min(maxTokens, bucket.tokens + refilled);
    bucket.lastRefill = now;
    bucket.maxTokens = maxTokens;
    bucket.refillRate = refillRatePerMs;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true };
    }

    // Calculate ms until next token available
    const retryAfter = Math.ceil((1 - bucket.tokens) / refillRatePerMs);
    return { allowed: false, retryAfter };
  }

  /** Build the bucket key from the IPC event and optional agentId. */
  static buildKey(event: IpcMainInvokeEvent, agentId?: string): string {
    const wcId = event.sender.id;
    return agentId ? `${wcId}:${agentId}` : `${wcId}`;
  }

  /** Flush all buckets (for testing). */
  clear(): void {
    this.buckets.clear();
  }
}

/** Singleton instance shared across all IPC handlers. */
export const rateLimiter = new IpcRateLimiter();

// ─── Middleware HOF ───────────────────────────────────────────────

export interface RateLimitError {
  error: 'rate_limited';
  channel: string;
  retryAfter: number; // ms
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IpcHandler = (event: IpcMainInvokeEvent, ...args: any[]) => any;

/**
 * Wraps an ipcMain handler with token-bucket rate limiting.
 *
 * For channels starting with 'api.', the first arg is assumed to be agentId
 * and is included in the bucket key so each agent gets its own budget.
 */
export function wrapWithRateLimit(
  channel: string,
  handler: IpcHandler,
): IpcHandler {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (event: IpcMainInvokeEvent, ...args: any[]): Promise<unknown> => {
    // Extract agentId from first arg for api.* channels
    const agentId =
      channel.startsWith('api.') && typeof args[0] === 'string' ? args[0] : undefined;

    const key = IpcRateLimiter.buildKey(event, agentId);
    const result = rateLimiter.tryConsume(key, channel);

    if (!result.allowed) {
      const err: RateLimitError = {
        error: 'rate_limited',
        channel,
        retryAfter: result.retryAfter,
      };
      // Notify the renderer so it can show a toast warning
      try {
        event.sender.send('ipc:rate-limited', err);
      } catch { /* sender may be destroyed */ }
      return err;
    }

    return handler(event, ...args);
  };
}
