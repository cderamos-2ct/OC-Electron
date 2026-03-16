import type { ModelProvider, RateLimitState } from './types.js';

const state = new Map<ModelProvider, RateLimitState>();

/** Mark a provider as rate-limited for retryAfterMs milliseconds */
export function markRateLimited(
  provider: ModelProvider,
  retryAfterMs: number,
  error?: string
): void {
  state.set(provider, {
    provider,
    retryAfter: Date.now() + retryAfterMs,
    lastError: error,
  });
}

/** Returns true if the provider is currently rate-limited */
export function isRateLimited(provider: ModelProvider): boolean {
  const s = state.get(provider);
  if (!s?.retryAfter) return false;
  if (Date.now() >= s.retryAfter) {
    state.delete(provider);
    return false;
  }
  return true;
}

/** Clear rate limit state for a provider (called on success) */
export function clearRateLimit(provider: ModelProvider): void {
  state.delete(provider);
}

/** Get ms until the provider is available again (0 if not rate-limited) */
export function msUntilAvailable(provider: ModelProvider): number {
  const s = state.get(provider);
  if (!s?.retryAfter) return 0;
  return Math.max(0, s.retryAfter - Date.now());
}
