import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import type { ChatRequest, ChatEvent, ChatUsage, ReasoningLevel } from '../types.js';

let genAI: GoogleGenerativeAI | null = null;

function getClient(apiKey?: string): GoogleGenerativeAI {
  if (genAI) return genAI;
  const key = apiKey ?? process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      '[google-provider] No API key found. Set GOOGLE_API_KEY or GEMINI_API_KEY'
    );
  }
  genAI = new GoogleGenerativeAI(key);
  return genAI;
}

/** Normalize Google model IDs: strip "google/" prefix if present */
function normalizeModel(model: string): string {
  return model.replace(/^google\//, '');
}

/**
 * Map reasoningLevel to Gemini thinking_budget.
 * gemini-3.1-pro-preview supports thinking_level: "high" | "medium" | "low".
 * We map to token budgets for the generationConfig thinkingConfig.
 */
function reasoningToThinkingBudget(level?: ReasoningLevel): number | undefined {
  switch (level) {
    case 'high':   return 8192;
    case 'medium': return 2048;
    case 'low':    return 0;
    default:       return undefined;
  }
}

export async function* googleStream(
  req: ChatRequest,
  apiKey?: string
): AsyncGenerator<ChatEvent> {
  const client = getClient(apiKey);
  const modelName = normalizeModel(req.model);

  const thinkingBudget = reasoningToThinkingBudget(req.reasoningLevel);

  const model = client.getGenerativeModel({
    model: modelName,
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ],
    generationConfig: {
      maxOutputTokens: req.maxTokens ?? 8192,
      temperature: req.temperature,
      // thinkingConfig for reasoning models (gemini-3.1-pro-preview)
      ...(thinkingBudget !== undefined
        ? { thinkingConfig: { thinkingBudget } }
        : {}),
    } as Record<string, unknown>,
  });

  // Build history (all but last user message)
  const allMessages = req.messages.filter((m) => m.role !== 'system');
  const historyMessages = allMessages.slice(0, -1);
  const lastMessage = allMessages[allMessages.length - 1];

  const systemInstruction = req.systemPrompt
    ?? req.messages.find((m) => m.role === 'system')?.content;

  const chat = model.startChat({
    history: historyMessages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    ...(systemInstruction ? { systemInstruction } : {}),
  });

  let seq = 0;
  let fullText = '';
  let usage: ChatUsage | undefined;

  const result = await chat.sendMessageStream(lastMessage?.content ?? '');

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      fullText += text;
      yield {
        runId: req.runId,
        sessionKey: req.sessionKey,
        seq: seq++,
        state: 'delta',
        message: { text },
      };
    }
  }

  const finalResponse = await result.response;
  const usageMeta = finalResponse.usageMetadata;
  if (usageMeta) {
    usage = {
      inputTokens: usageMeta.promptTokenCount,
      outputTokens: usageMeta.candidatesTokenCount,
      totalTokens: usageMeta.totalTokenCount,
    };
  }

  yield {
    runId: req.runId,
    sessionKey: req.sessionKey,
    seq: seq++,
    state: 'final',
    message: { text: fullText },
    usage,
    stopReason: finalResponse.candidates?.[0]?.finishReason ?? 'STOP',
  };
}
