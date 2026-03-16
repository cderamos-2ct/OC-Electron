import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  markRateLimited,
  isRateLimited,
  clearRateLimit,
  msUntilAvailable,
} from '../rate-limiter.js';

describe('rate-limiter.ts', () => {
  beforeEach(() => {
    // Clear all providers before each test
    clearRateLimit('anthropic');
    clearRateLimit('openai');
    clearRateLimit('google');
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isRateLimited', () => {
    it('returns false when provider has never been rate-limited', () => {
      expect(isRateLimited('anthropic')).toBe(false);
    });

    it('returns false when provider rate limit has expired', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      markRateLimited('anthropic', 1000); // 1 second

      // Advance past the retry window
      vi.setSystemTime(now + 2000);
      expect(isRateLimited('anthropic')).toBe(false);
    });

    it('returns true when provider is within rate limit window', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      markRateLimited('anthropic', 60_000); // 1 minute

      vi.setSystemTime(now + 30_000); // 30 seconds later
      expect(isRateLimited('anthropic')).toBe(true);
    });

    it('does not affect other providers', () => {
      vi.useFakeTimers();
      markRateLimited('anthropic', 60_000);

      expect(isRateLimited('openai')).toBe(false);
      expect(isRateLimited('google')).toBe(false);
    });

    it('clears state automatically when limit expires', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      markRateLimited('openai', 500);
      vi.setSystemTime(now + 1000);

      // First call should return false and clean up state
      expect(isRateLimited('openai')).toBe(false);
      // Calling again should still return false (state was cleaned)
      expect(isRateLimited('openai')).toBe(false);
    });
  });

  describe('markRateLimited', () => {
    it('marks a provider as rate-limited', () => {
      vi.useFakeTimers();
      vi.setSystemTime(Date.now());

      markRateLimited('openai', 5_000);
      expect(isRateLimited('openai')).toBe(true);
    });

    it('overwrites previous rate limit with new one', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      markRateLimited('google', 1_000);
      // Overwrite with a longer limit
      markRateLimited('google', 60_000);

      // Advance 2 seconds — first limit would have expired, second should not
      vi.setSystemTime(now + 2_000);
      expect(isRateLimited('google')).toBe(true);
    });

    it('stores the optional error message', () => {
      // No direct getter for lastError, but marking should not throw
      expect(() =>
        markRateLimited('anthropic', 1000, 'Rate limit exceeded')
      ).not.toThrow();
    });

    it('can mark all three providers independently', () => {
      vi.useFakeTimers();
      vi.setSystemTime(Date.now());

      markRateLimited('anthropic', 10_000);
      markRateLimited('openai', 10_000);
      markRateLimited('google', 10_000);

      expect(isRateLimited('anthropic')).toBe(true);
      expect(isRateLimited('openai')).toBe(true);
      expect(isRateLimited('google')).toBe(true);
    });
  });

  describe('clearRateLimit', () => {
    it('clears rate limit for a specific provider', () => {
      vi.useFakeTimers();
      vi.setSystemTime(Date.now());

      markRateLimited('anthropic', 60_000);
      expect(isRateLimited('anthropic')).toBe(true);

      clearRateLimit('anthropic');
      expect(isRateLimited('anthropic')).toBe(false);
    });

    it('does not affect other providers when clearing one', () => {
      vi.useFakeTimers();
      vi.setSystemTime(Date.now());

      markRateLimited('anthropic', 60_000);
      markRateLimited('openai', 60_000);

      clearRateLimit('anthropic');

      expect(isRateLimited('anthropic')).toBe(false);
      expect(isRateLimited('openai')).toBe(true);
    });

    it('is safe to call on a provider that is not rate-limited', () => {
      expect(() => clearRateLimit('google')).not.toThrow();
    });
  });

  describe('msUntilAvailable', () => {
    it('returns 0 when provider is not rate-limited', () => {
      expect(msUntilAvailable('anthropic')).toBe(0);
    });

    it('returns approximate ms remaining when rate-limited', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      markRateLimited('openai', 5_000);

      vi.setSystemTime(now + 2_000); // 2 seconds passed
      const ms = msUntilAvailable('openai');
      // Should be ~3000ms remaining (allow small tolerance)
      expect(ms).toBeGreaterThan(2_900);
      expect(ms).toBeLessThanOrEqual(3_000);
    });

    it('returns 0 when rate limit has expired', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      markRateLimited('google', 1_000);
      vi.setSystemTime(now + 5_000); // well past expiry

      expect(msUntilAvailable('google')).toBe(0);
    });

    it('returns 0 after clearRateLimit', () => {
      vi.useFakeTimers();
      vi.setSystemTime(Date.now());

      markRateLimited('anthropic', 60_000);
      clearRateLimit('anthropic');

      expect(msUntilAvailable('anthropic')).toBe(0);
    });
  });
});
