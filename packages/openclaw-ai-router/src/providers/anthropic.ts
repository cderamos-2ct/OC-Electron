import Anthropic from '@anthropic-ai/sdk';
import type { ChatRequest, ChatEvent, ChatUsage } from '../types.js';

let client: Anthropic | null = null;

function getClient(apiKey?: string): Anthropic {
  if (client) return client;
  client = new Anthropic({
    apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY,
  });
  return client;
}

/** Normalize Anthropic model IDs: strip "anthropic/" prefix if present */
function normalizeModel(model: string): string {
  return model.replace(/^anthropic\//, '');
}

export async function* anthropicStream(
  req: ChatRequest,
  apiKey?: string
): AsyncGenerator<ChatEvent> {
  const anthropic = getClient(apiKey);
  const model = normalizeModel(req.model);

  const systemMsg = req.systemPrompt
    ?? req.messages.find((m) => m.role === 'system')?.content;

  const userMessages = req.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  let seq = 0;
  let fullText = '';

  const stream = anthropic.messages.stream({
    model,
    max_tokens: req.maxTokens ?? 8192,
    system: systemMsg,
    messages: userMessages,
    tools: req.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Tool['input_schema'],
    })),
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      fullText += event.delta.text;
      yield {
        runId: req.runId,
        sessionKey: req.sessionKey,
        seq: seq++,
        state: 'delta',
        message: { text: event.delta.text },
      };
    }
  }

  const finalMsg = await stream.finalMessage();
  const usage: ChatUsage = {
    inputTokens: finalMsg.usage.input_tokens,
    outputTokens: finalMsg.usage.output_tokens,
    totalTokens: finalMsg.usage.input_tokens + finalMsg.usage.output_tokens,
  };

  yield {
    runId: req.runId,
    sessionKey: req.sessionKey,
    seq: seq++,
    state: 'final',
    message: { text: fullText },
    usage,
    stopReason: finalMsg.stop_reason ?? 'end_turn',
  };
}
