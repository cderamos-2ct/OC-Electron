// Shared log schema and PII redaction helpers
// Used by both main and renderer loggers

export interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'debug';
  subsystem?: string;
  message: string;
  data?: unknown;
  timestamp?: string;
}

// Patterns that should never appear in logs
const REDACT_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Bearer tokens
  { pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, replacement: 'Bearer [REDACTED]' },
  // OpenAI-style keys
  { pattern: /sk-[A-Za-z0-9]{20,}/g, replacement: 'sk-[REDACTED]' },
  // GitHub PATs
  { pattern: /ghp_[A-Za-z0-9]{36,}/g, replacement: 'ghp_[REDACTED]' },
  // GitHub OAuth tokens
  { pattern: /gho_[A-Za-z0-9]{36,}/g, replacement: 'gho_[REDACTED]' },
  // GitHub fine-grained PATs
  { pattern: /github_pat_[A-Za-z0-9_]{82,}/g, replacement: 'github_pat_[REDACTED]' },
  // Generic API keys (key=value patterns)
  { pattern: /(api[_-]?key|apikey|secret|password|passwd|token|credential)[=:]\s*["']?[^\s"',;]{8,}["']?/gi, replacement: '$1=[REDACTED]' },
];

const REDACT_FIELD_NAMES = new Set([
  'password', 'passwd', 'secret', 'token', 'credential', 'apikey', 'api_key',
  'accesstoken', 'access_token', 'refreshtoken', 'refresh_token', 'privatekey',
  'private_key', 'authorization', 'bearer', 'key', 'pass',
]);

/**
 * Redact PII and credentials from a string.
 */
export function redactString(input: string): string {
  let result = input;
  for (const { pattern, replacement } of REDACT_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Deep-redact an object, replacing known credential fields with [REDACTED].
 * Returns a new object safe for logging.
 */
export function redactObject(obj: unknown, depth = 0): unknown {
  if (depth > 6) return '[deep]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return redactString(obj);
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (REDACT_FIELD_NAMES.has(k.toLowerCase())) {
        result[k] = '[REDACTED]';
      } else {
        result[k] = redactObject(v, depth + 1);
      }
    }
    return result;
  }

  return obj;
}

/**
 * Sanitize log arguments before passing to electron-log.
 * Handles strings, errors, and arbitrary objects.
 */
export function sanitizeLogArgs(args: unknown[]): unknown[] {
  return args.map((arg) => {
    if (typeof arg === 'string') return redactString(arg);
    if (arg instanceof Error) {
      return { name: arg.name, message: redactString(arg.message), stack: arg.stack };
    }
    return redactObject(arg);
  });
}
