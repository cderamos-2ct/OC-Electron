// Global test setup for openclaw-ai-router
// Clears rate limiter state between tests to prevent cross-test pollution
import { clearRateLimit } from '../src/rate-limiter.js';

beforeEach(() => {
  // Reset rate limiter for all providers before each test
  clearRateLimit('anthropic');
  clearRateLimit('openai');
  clearRateLimit('google');
});
