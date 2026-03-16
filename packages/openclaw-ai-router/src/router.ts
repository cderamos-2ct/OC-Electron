/**
 * Multi-provider AI router for OpenClaw.
 *
 * Reads agent config (defaultModel, fallbackModel, modelProvider) and dispatches
 * to the correct provider. Falls back to fallbackModel if primary fails or is
 * rate-limited.
 */
import { anthropicStream } from './providers/anthropic.js';
import { openaiStream } from './providers/openai.js';
import { googleStream } from './providers/google.js';
import { isRateLimited, markRateLimited, clearRateLimit } from './rate-limiter.js';
import type {
  ChatRequest,
  ChatEvent,
  AgentRouteConfig,
  ModelProvider,
  ProviderAuthConfig,
} from './types.js';

/** Detect provider from model string prefix or explicit provider field */
function detectProvider(model: string, explicit?: ModelProvider): ModelProvider {
  if (explicit) return explicit;
  if (model.startsWith('anthropic/') || model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('openai/') || model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3')) return 'openai';
  if (model.startsWith('google/') || model.startsWith('gemini')) return 'google';
  throw new Error(`[ai-router] Cannot detect provider for model: ${model}`);
}

function providerStream(
  req: ChatRequest,
  auth: ProviderAuthConfig
): AsyncGenerator<ChatEvent> {
  switch (req.provider) {
    case 'anthropic':
      return anthropicStream(req, auth.anthropicApiKey);
    case 'openai':
      return openaiStream(req, auth.openaiApiKey);
    case 'google':
      return googleStream(req, auth.googleApiKey);
    default:
      throw new Error(`[ai-router] Unknown provider: ${req.provider}`);
  }
}

/** Rate-limit retry delay in ms (5 minutes default) */
const RATE_LIMIT_BACKOFF_MS = 5 * 60 * 1000;

/**
 * Route a chat request through the appropriate AI provider, streaming events.
 *
 * Provider selection follows this logic:
 * 1. Use `agentConfig.defaultModel` (and `agentConfig.modelProvider` if set).
 * 2. If the primary provider is already rate-limited and a `fallbackModel` is
 *    configured, skip directly to the fallback.
 * 3. If the primary request throws a 429 / rate-limit error mid-stream and a
 *    `fallbackModel` is configured, retry on the fallback provider.
 * 4. If both primary and fallback fail, yield a terminal `error` event.
 *
 * @param baseReq - Chat request body minus `model` and `provider` (supplied by config).
 * @param agentConfig - Per-agent routing config including model names and fallback.
 * @param auth - API keys for each provider. Defaults to empty (keys read from env by providers).
 * @yields {@link ChatEvent} — streamed delta tokens, tool calls, and terminal state events.
 */
export async function* routeChat(
  baseReq: Omit<ChatRequest, 'model' | 'provider'>,
  agentConfig: AgentRouteConfig,
  auth: ProviderAuthConfig = {}
): AsyncGenerator<ChatEvent> {
  const primaryProvider = detectProvider(
    agentConfig.defaultModel,
    agentConfig.modelProvider
  );

  const primaryReq: ChatRequest = {
    ...baseReq,
    model: agentConfig.defaultModel,
    provider: primaryProvider,
    reasoningLevel: agentConfig.reasoningLevel ?? undefined,
  };

  const primaryRateLimited = isRateLimited(primaryProvider);
  const useFallback = primaryRateLimited && agentConfig.fallbackModel != null;

  // Rate-limited with no fallback — emit error immediately
  if (primaryRateLimited && !agentConfig.fallbackModel) {
    yield {
      runId: baseReq.runId,
      sessionKey: baseReq.sessionKey,
      seq: 0,
      state: 'error',
      errorMessage: `[ai-router] Primary provider ${primaryProvider} unavailable and no fallback configured.`,
    };
    return;
  }

  if (!useFallback) {
    try {
      const stream = providerStream(primaryReq, auth);
      for await (const event of stream) {
        yield event;
      }
      clearRateLimit(primaryProvider);
      return;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRateError =
        msg.includes('429') ||
        msg.toLowerCase().includes('rate limit') ||
        msg.toLowerCase().includes('quota');

      if (isRateError && agentConfig.fallbackModel) {
        console.warn(
          `[ai-router] ${primaryProvider} rate-limited. Falling back to ${agentConfig.fallbackModel}`
        );
        markRateLimited(primaryProvider, RATE_LIMIT_BACKOFF_MS, msg);
        // fall through to fallback below
      } else {
        // Non-rate error: emit error event
        yield {
          runId: baseReq.runId,
          sessionKey: baseReq.sessionKey,
          seq: 0,
          state: 'error',
          errorMessage: msg,
        };
        return;
      }
    }
  }

  // Fallback path
  if (!agentConfig.fallbackModel) {
    yield {
      runId: baseReq.runId,
      sessionKey: baseReq.sessionKey,
      seq: 0,
      state: 'error',
      errorMessage: `[ai-router] Primary provider ${primaryProvider} unavailable and no fallback configured.`,
    };
    return;
  }

  const fallbackProvider = detectProvider(agentConfig.fallbackModel);
  const fallbackReq: ChatRequest = {
    ...baseReq,
    model: agentConfig.fallbackModel,
    provider: fallbackProvider,
    reasoningLevel: agentConfig.reasoningLevel ?? undefined,
  };

  try {
    const stream = providerStream(fallbackReq, auth);
    for await (const event of stream) {
      yield event;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    yield {
      runId: baseReq.runId,
      sessionKey: baseReq.sessionKey,
      seq: 0,
      state: 'error',
      errorMessage: `[ai-router] Both primary (${primaryProvider}) and fallback (${fallbackProvider}) failed. Last error: ${msg}`,
    };
  }
}

/**
 * Build a child agent routing config from a parent config.
 *
 * Returns `null` if subagents are not permitted (no `subagentModel` set or
 * `depth >= subagentMaxDepth`). When a config is returned, the child uses
 * `subagentModel` as its primary model, inherits the parent's `fallbackModel`,
 * and is restricted to `reasoningLevel: 'low'` to reduce cost.
 *
 * @param parentConfig - The routing config of the spawning (parent) agent.
 * @param depth - Current recursion depth (0 = top-level agent).
 * @returns A child {@link AgentRouteConfig}, or `null` if depth limit reached.
 */
export function buildSubagentConfig(
  parentConfig: AgentRouteConfig,
  depth: number
): AgentRouteConfig | null {
  const maxDepth = parentConfig.subagentMaxDepth ?? 1;
  if (depth >= maxDepth) return null;
  if (!parentConfig.subagentModel) return null;

  const subProvider = detectProvider(parentConfig.subagentModel);
  return {
    defaultModel: parentConfig.subagentModel,
    modelProvider: subProvider,
    fallbackModel: parentConfig.fallbackModel,
    reasoningLevel: 'low', // subagents use lighter reasoning
    canSpawnSubagents: depth + 1 < maxDepth,
    subagentModel: parentConfig.subagentModel,
    subagentMaxDepth: maxDepth,
  };
}
