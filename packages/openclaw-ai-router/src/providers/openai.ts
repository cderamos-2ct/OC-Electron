import OpenAI from 'openai';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ChatRequest, ChatEvent, ChatUsage } from '../types.js';

let client: OpenAI | null = null;

/**
 * Load auth from ~/.codex/auth.json (OAuth-based) or fall back to API key env var.
 * ~/.codex/auth.json format: { "token": "sk-...", ... }
 */
async function loadApiKey(apiKey?: string): Promise<string> {
  if (apiKey) return apiKey;
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;

  try {
    const authPath = join(homedir(), '.codex', 'auth.json');
    const raw = await readFile(authPath, 'utf-8');
    const auth = JSON.parse(raw) as { token?: string; api_key?: string };
    const key = auth.token ?? auth.api_key;
    if (key) return key;
  } catch {
    // No codex auth file, fall through
  }

  throw new Error(
    '[openai-provider] No API key found. Set OPENAI_API_KEY or configure ~/.codex/auth.json'
  );
}

async function getClient(apiKey?: string): Promise<OpenAI> {
  if (client) return client;
  const key = await loadApiKey(apiKey);
  client = new OpenAI({ apiKey: key });
  return client;
}

/** Normalize OpenAI model IDs: strip "openai/" prefix if present */
function normalizeModel(model: string): string {
  return model.replace(/^openai\//, '');
}

export async function* openaiStream(
  req: ChatRequest,
  apiKey?: string
): AsyncGenerator<ChatEvent> {
  const openai = await getClient(apiKey);
  const model = normalizeModel(req.model);

  const messages: OpenAI.ChatCompletionMessageParam[] = req.messages.map((m) => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content,
    ...(m.name ? { name: m.name } : {}),
  }));

  if (req.systemPrompt && !messages.find((m) => m.role === 'system')) {
    messages.unshift({ role: 'system', content: req.systemPrompt });
  }

  const tools: OpenAI.ChatCompletionTool[] | undefined = req.tools?.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  let seq = 0;
  let fullText = '';
  let usage: ChatUsage | undefined;

  const stream = await openai.chat.completions.create({
    model,
    messages,
    max_tokens: req.maxTokens ?? 8192,
    temperature: req.temperature,
    stream: true,
    stream_options: { include_usage: true },
    ...(tools?.length ? { tools } : {}),
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? '';
    if (delta) {
      fullText += delta;
      yield {
        runId: req.runId,
        sessionKey: req.sessionKey,
        seq: seq++,
        state: 'delta',
        message: { text: delta },
      };
    }
    if (chunk.usage) {
      usage = {
        inputTokens: chunk.usage.prompt_tokens,
        outputTokens: chunk.usage.completion_tokens,
        totalTokens: chunk.usage.total_tokens,
      };
    }
  }

  yield {
    runId: req.runId,
    sessionKey: req.sessionKey,
    seq: seq++,
    state: 'final',
    message: { text: fullText },
    usage,
    stopReason: 'stop',
  };
}
