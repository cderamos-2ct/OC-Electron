import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock providers ───────────────────────────────────────────────────────────
const mockAnthropicStream = vi.fn();
const mockOpenaiStream = vi.fn();
const mockGoogleStream = vi.fn();

// ─── Mock rate-limiter so router and test share the same instance ─────────────
const mockIsRateLimited = vi.fn().mockReturnValue(false);
const mockMarkRateLimited = vi.fn();
const mockClearRateLimit = vi.fn();

vi.mock('../providers/anthropic.js', () => ({
  anthropicStream: mockAnthropicStream,
}));
vi.mock('../providers/openai.js', () => ({
  openaiStream: mockOpenaiStream,
}));
vi.mock('../providers/google.js', () => ({
  googleStream: mockGoogleStream,
}));
vi.mock('../rate-limiter.js', () => ({
  isRateLimited: mockIsRateLimited,
  markRateLimited: mockMarkRateLimited,
  clearRateLimit: mockClearRateLimit,
}));

const { routeChat, buildSubagentConfig } = await import('../router.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

import type { ChatEvent, AgentRouteConfig, ChatMessage } from '../types.js';

function makeBaseReq(overrides = {}) {
  return {
    runId: 'run-1',
    sessionKey: 'sess-1',
    messages: [{ role: 'user' as const, content: 'Hello' }] as ChatMessage[],
    ...overrides,
  };
}

async function* fakeStream(events: ChatEvent[]): AsyncGenerator<ChatEvent> {
  for (const e of events) yield e;
}

async function collectEvents(gen: AsyncGenerator<ChatEvent>): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];
  for await (const e of gen) events.push(e);
  return events;
}

const anthropicConfig: AgentRouteConfig = {
  defaultModel: 'claude-opus-4-6',
  modelProvider: 'anthropic',
};

const openaiConfig: AgentRouteConfig = {
  defaultModel: 'gpt-5',
  modelProvider: 'openai',
};

const googleConfig: AgentRouteConfig = {
  defaultModel: 'gemini-2.0-flash',
  modelProvider: 'google',
};

const deltaEvent: ChatEvent = {
  runId: 'run-1',
  sessionKey: 'sess-1',
  seq: 1,
  state: 'delta',
  message: { content: 'Hello!' },
};

const finalEvent: ChatEvent = {
  runId: 'run-1',
  sessionKey: 'sess-1',
  seq: 2,
  state: 'final',
};

describe('router.ts — routeChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRateLimited.mockReturnValue(false);
  });

  describe('provider routing', () => {
    it('routes claude models to anthropic', async () => {
      mockAnthropicStream.mockReturnValueOnce(fakeStream([deltaEvent, finalEvent]));

      const events = await collectEvents(
        routeChat(makeBaseReq(), anthropicConfig, { anthropicApiKey: 'sk-ant' })
      );

      expect(mockAnthropicStream).toHaveBeenCalledOnce();
      expect(mockAnthropicStream).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-opus-4-6', provider: 'anthropic' }),
        'sk-ant'
      );
      expect(mockOpenaiStream).not.toHaveBeenCalled();
      expect(mockGoogleStream).not.toHaveBeenCalled();
      expect(events).toHaveLength(2);
    });

    it('routes gpt models to openai', async () => {
      mockOpenaiStream.mockReturnValueOnce(fakeStream([finalEvent]));

      await collectEvents(
        routeChat(makeBaseReq(), openaiConfig, { openaiApiKey: 'sk-oai' })
      );

      expect(mockOpenaiStream).toHaveBeenCalledOnce();
      expect(mockOpenaiStream).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-5', provider: 'openai' }),
        'sk-oai'
      );
    });

    it('routes gemini models to google', async () => {
      mockGoogleStream.mockReturnValueOnce(fakeStream([finalEvent]));

      await collectEvents(
        routeChat(makeBaseReq(), googleConfig, { googleApiKey: 'goog-key' })
      );

      expect(mockGoogleStream).toHaveBeenCalledOnce();
    });

    it('uses explicit modelProvider over model prefix detection', async () => {
      mockOpenaiStream.mockReturnValueOnce(fakeStream([finalEvent]));

      // Model prefix suggests anthropic, but explicit provider says openai
      await collectEvents(
        routeChat(makeBaseReq(), {
          defaultModel: 'claude-opus-4-6',
          modelProvider: 'openai', // explicit override
        }, { openaiApiKey: 'sk-oai' })
      );

      expect(mockOpenaiStream).toHaveBeenCalledOnce();
      expect(mockAnthropicStream).not.toHaveBeenCalled();
    });

    it('passes reasoningLevel from agentConfig to request', async () => {
      mockAnthropicStream.mockReturnValueOnce(fakeStream([finalEvent]));

      await collectEvents(
        routeChat(makeBaseReq(), {
          ...anthropicConfig,
          reasoningLevel: 'high',
        }, { anthropicApiKey: 'sk-ant' })
      );

      expect(mockAnthropicStream).toHaveBeenCalledWith(
        expect.objectContaining({ reasoningLevel: 'high' }),
        'sk-ant'
      );
    });

    it('clears rate limit on successful stream completion', async () => {
      // Provider is not rate-limited (default mock returns false)
      mockAnthropicStream.mockReturnValueOnce(fakeStream([finalEvent]));

      await collectEvents(routeChat(makeBaseReq(), anthropicConfig));

      // Provider should be available and clearRateLimit called after success
      expect(mockAnthropicStream).toHaveBeenCalledOnce();
      expect(mockClearRateLimit).toHaveBeenCalledWith('anthropic');
    });
  });

  describe('error handling — non-rate errors', () => {
    it('emits error event on non-rate-limit provider failure', async () => {
      mockAnthropicStream.mockReturnValueOnce(
        (async function* () { throw new Error('Internal server error'); })()
      );

      const events = await collectEvents(
        routeChat(makeBaseReq(), anthropicConfig)
      );

      expect(events).toHaveLength(1);
      expect(events[0].state).toBe('error');
      expect(events[0].errorMessage).toContain('Internal server error');
    });

    it('includes runId and sessionKey in error event', async () => {
      mockAnthropicStream.mockReturnValueOnce(
        (async function* () { throw new Error('boom'); })()
      );

      const events = await collectEvents(
        routeChat(
          makeBaseReq({ runId: 'my-run', sessionKey: 'my-sess' }),
          anthropicConfig
        )
      );

      expect(events[0].runId).toBe('my-run');
      expect(events[0].sessionKey).toBe('my-sess');
    });
  });

  describe('fallback — rate limit errors', () => {
    it('falls back to fallbackModel on 429 error', async () => {
      const configWithFallback: AgentRouteConfig = {
        defaultModel: 'claude-opus-4-6',
        modelProvider: 'anthropic',
        fallbackModel: 'gpt-5',
      };

      mockAnthropicStream.mockReturnValueOnce(
        (async function* () { throw new Error('429 Too Many Requests'); })()
      );
      mockOpenaiStream.mockReturnValueOnce(fakeStream([finalEvent]));

      const events = await collectEvents(
        routeChat(makeBaseReq(), configWithFallback, { openaiApiKey: 'sk-oai' })
      );

      expect(mockAnthropicStream).toHaveBeenCalledOnce();
      expect(mockOpenaiStream).toHaveBeenCalledOnce();
      expect(events).toHaveLength(1);
      expect(events[0].state).toBe('final');
    });

    it('falls back on "rate limit" error message', async () => {
      const configWithFallback: AgentRouteConfig = {
        defaultModel: 'claude-opus-4-6',
        modelProvider: 'anthropic',
        fallbackModel: 'gpt-5',
      };

      mockAnthropicStream.mockReturnValueOnce(
        (async function* () { throw new Error('rate limit exceeded'); })()
      );
      mockOpenaiStream.mockReturnValueOnce(fakeStream([finalEvent]));

      const events = await collectEvents(
        routeChat(makeBaseReq(), configWithFallback)
      );

      expect(mockOpenaiStream).toHaveBeenCalledOnce();
      expect(events[0].state).toBe('final');
    });

    it('falls back on "quota" error message', async () => {
      const configWithFallback: AgentRouteConfig = {
        defaultModel: 'claude-opus-4-6',
        modelProvider: 'anthropic',
        fallbackModel: 'gpt-5',
      };

      mockAnthropicStream.mockReturnValueOnce(
        (async function* () { throw new Error('quota exceeded for this project'); })()
      );
      mockOpenaiStream.mockReturnValueOnce(fakeStream([finalEvent]));

      await collectEvents(routeChat(makeBaseReq(), configWithFallback));
      expect(mockOpenaiStream).toHaveBeenCalledOnce();
    });

    it('emits error when rate-limited and no fallback configured', async () => {
      // Primary provider is rate-limited
      mockIsRateLimited.mockReturnValue(true);

      // No fallbackModel in anthropicConfig — should emit error immediately
      const events = await collectEvents(
        routeChat(makeBaseReq(), anthropicConfig) // no fallbackModel
      );

      expect(events).toHaveLength(1);
      expect(events[0].state).toBe('error');
      // Primary should NOT be called since we know it's rate-limited with no fallback
      expect(mockAnthropicStream).not.toHaveBeenCalled();
    });

    it('skips primary and uses fallback when primary is already rate-limited', async () => {
      // Primary provider is rate-limited
      mockIsRateLimited.mockReturnValue(true);

      const configWithFallback: AgentRouteConfig = {
        defaultModel: 'claude-opus-4-6',
        modelProvider: 'anthropic',
        fallbackModel: 'gpt-5',
      };

      mockOpenaiStream.mockReturnValueOnce(fakeStream([finalEvent]));

      const events = await collectEvents(
        routeChat(makeBaseReq(), configWithFallback, { openaiApiKey: 'sk-oai' })
      );

      expect(mockAnthropicStream).not.toHaveBeenCalled();
      expect(mockOpenaiStream).toHaveBeenCalledOnce();
      expect(events[0].state).toBe('final');
    });

    it('emits error when both primary and fallback fail', async () => {
      const configWithFallback: AgentRouteConfig = {
        defaultModel: 'claude-opus-4-6',
        modelProvider: 'anthropic',
        fallbackModel: 'gpt-5',
      };

      mockAnthropicStream.mockReturnValueOnce(
        (async function* () { throw new Error('429 rate limit'); })()
      );
      mockOpenaiStream.mockReturnValueOnce(
        (async function* () { throw new Error('Fallback also failed'); })()
      );

      const events = await collectEvents(
        routeChat(makeBaseReq(), configWithFallback)
      );

      expect(events).toHaveLength(1);
      expect(events[0].state).toBe('error');
      expect(events[0].errorMessage).toContain('Both primary');
      expect(events[0].errorMessage).toContain('Fallback also failed');
    });

    it('does not fall back on non-rate errors even with fallbackModel', async () => {
      const configWithFallback: AgentRouteConfig = {
        defaultModel: 'claude-opus-4-6',
        modelProvider: 'anthropic',
        fallbackModel: 'gpt-5',
      };

      mockAnthropicStream.mockReturnValueOnce(
        (async function* () { throw new Error('Internal server error 500'); })()
      );

      const events = await collectEvents(
        routeChat(makeBaseReq(), configWithFallback)
      );

      // Non-rate error: no fallback, just error event
      expect(mockOpenaiStream).not.toHaveBeenCalled();
      expect(events[0].state).toBe('error');
      expect(events[0].errorMessage).toContain('Internal server error 500');
    });
  });

  describe('streaming', () => {
    it('yields all events from the provider stream', async () => {
      const streamEvents: ChatEvent[] = [
        { runId: 'run-1', sessionKey: 'sess-1', seq: 1, state: 'delta', message: { content: 'A' } },
        { runId: 'run-1', sessionKey: 'sess-1', seq: 2, state: 'delta', message: { content: 'B' } },
        { runId: 'run-1', sessionKey: 'sess-1', seq: 3, state: 'final' },
      ];

      mockAnthropicStream.mockReturnValueOnce(fakeStream(streamEvents));

      const events = await collectEvents(
        routeChat(makeBaseReq(), anthropicConfig)
      );

      expect(events).toHaveLength(3);
      expect(events[0].seq).toBe(1);
      expect(events[1].seq).toBe(2);
      expect(events[2].state).toBe('final');
    });

    it('passes auth config to the provider', async () => {
      mockAnthropicStream.mockReturnValueOnce(fakeStream([finalEvent]));

      await collectEvents(
        routeChat(makeBaseReq(), anthropicConfig, { anthropicApiKey: 'my-key' })
      );

      expect(mockAnthropicStream).toHaveBeenCalledWith(
        expect.anything(),
        'my-key'
      );
    });
  });
});

describe('router.ts — buildSubagentConfig', () => {
  const parentConfig: AgentRouteConfig = {
    defaultModel: 'claude-opus-4-6',
    modelProvider: 'anthropic',
    fallbackModel: 'gpt-5',
    subagentModel: 'claude-haiku-4-5-20251001',
    subagentMaxDepth: 3,
  };

  it('returns null when depth >= maxDepth', () => {
    expect(buildSubagentConfig(parentConfig, 3)).toBeNull();
    expect(buildSubagentConfig(parentConfig, 5)).toBeNull();
  });

  it('returns null when subagentModel is not set', () => {
    const config: AgentRouteConfig = {
      defaultModel: 'claude-opus-4-6',
      modelProvider: 'anthropic',
    };
    expect(buildSubagentConfig(config, 0)).toBeNull();
  });

  it('returns subagent config with correct model and provider', () => {
    const result = buildSubagentConfig(parentConfig, 0);

    expect(result).not.toBeNull();
    expect(result!.defaultModel).toBe('claude-haiku-4-5-20251001');
    expect(result!.modelProvider).toBe('anthropic'); // detected from 'claude-' prefix
  });

  it('inherits fallbackModel from parent', () => {
    const result = buildSubagentConfig(parentConfig, 0);
    expect(result!.fallbackModel).toBe('gpt-5');
  });

  it('uses low reasoning level for subagents', () => {
    const result = buildSubagentConfig(parentConfig, 0);
    expect(result!.reasoningLevel).toBe('low');
  });

  it('allows further spawning when depth+1 < maxDepth', () => {
    const result = buildSubagentConfig(parentConfig, 1); // depth=1, maxDepth=3
    expect(result!.canSpawnSubagents).toBe(true);
  });

  it('disallows further spawning when depth+1 >= maxDepth', () => {
    const result = buildSubagentConfig(parentConfig, 2); // depth=2, maxDepth=3 → 3>=3
    expect(result!.canSpawnSubagents).toBe(false);
  });

  it('uses default maxDepth of 1 when not specified', () => {
    const config: AgentRouteConfig = {
      defaultModel: 'claude-opus-4-6',
      modelProvider: 'anthropic',
      subagentModel: 'claude-haiku-4-5-20251001',
      // no subagentMaxDepth
    };

    // depth=0, maxDepth=1 → 0 < 1 → should work
    const result = buildSubagentConfig(config, 0);
    expect(result).not.toBeNull();

    // depth=1, maxDepth=1 → 1 >= 1 → null
    expect(buildSubagentConfig(config, 1)).toBeNull();
  });

  it('detects provider from subagentModel prefix', () => {
    const config: AgentRouteConfig = {
      defaultModel: 'claude-opus-4-6',
      modelProvider: 'anthropic',
      subagentModel: 'gpt-5-mini',
      subagentMaxDepth: 2,
    };
    const result = buildSubagentConfig(config, 0);
    expect(result!.modelProvider).toBe('openai');
    expect(result!.defaultModel).toBe('gpt-5-mini');
  });

  it('preserves subagentModel and subagentMaxDepth in result', () => {
    const result = buildSubagentConfig(parentConfig, 0);
    expect(result!.subagentModel).toBe('claude-haiku-4-5-20251001');
    expect(result!.subagentMaxDepth).toBe(3);
  });
});
