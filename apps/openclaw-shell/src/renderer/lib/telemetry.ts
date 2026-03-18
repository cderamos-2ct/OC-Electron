/**
 * Renderer-side telemetry facade wrapping @sentry/electron/renderer.
 *
 * Privacy-first: opt-in only. Consent is read from localStorage.
 * PII scrubbing applied via beforeSend.
 */

// ── PII scrubbing ──────────────────────────────────────────────────────────────

const PII_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /\bsk-[A-Za-z0-9]{10,}/g,
  /\bghp_[A-Za-z0-9]{10,}/g,
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
];

const VAULT_BREADCRUMB_CATEGORIES = new Set(['vault', 'vault:access', 'vault:lease']);

function scrubString(value: string): string {
  let result = value;
  for (const pattern of PII_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

function scrubObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitive = new Set([
    'password', 'secret', 'token', 'credential', 'apiKey', 'api_key',
    'authorization', 'Authorization', 'body', 'content', 'message',
    'chatMessage', 'emailBody', 'vaultData',
  ]);

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (sensitive.has(key)) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      result[key] = scrubString(value);
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = scrubObject(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ── Consent ────────────────────────────────────────────────────────────────────

const CONSENT_KEY = 'openclaw:telemetry:consent';

function hasConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'true';
  } catch {
    return false;
  }
}

// ── State ──────────────────────────────────────────────────────────────────────

let _initialized = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _sentry: any = null;

// ── Init ───────────────────────────────────────────────────────────────────────

export function initRendererTelemetry(): void {
  if (_initialized) return;
  _initialized = true;

  if (!hasConsent()) {
    return;
  }

  void (async () => {
    try {
      const Sentry = await import('@sentry/electron/renderer');
      _sentry = Sentry;

      Sentry.init({
        // DSN is inherited from the main process initialisation; renderer
        // just needs to be activated with the same key or left empty.
        dsn: 'https://placeholder@o0.ingest.sentry.io/0',
        beforeBreadcrumb(breadcrumb) {
          if (breadcrumb.category && VAULT_BREADCRUMB_CATEGORIES.has(breadcrumb.category)) {
            return null;
          }
          if (breadcrumb.message) {
            breadcrumb.message = scrubString(breadcrumb.message);
          }
          return breadcrumb;
        },
        beforeSend(event) {
          if (event.exception?.values) {
            for (const ex of event.exception.values) {
              if (ex.value) {
                ex.value = scrubString(ex.value);
              }
            }
          }
          if (event.extra) {
            event.extra = scrubObject(event.extra as Record<string, unknown>);
          }
          if (event.request) {
            event.request.data = undefined;
            event.request.headers = undefined;
            event.request.cookies = undefined;
          }
          return event;
        },
      });
    } catch {
      // Sentry unavailable — silently degrade
    }
  })();
}

// ── Public API ────────────────────────────────────────────────────────────────

export function captureRendererException(error: unknown, context?: Record<string, unknown>): void {
  if (!_sentry) return;
  try {
    const scrubbed = context ? scrubObject(context) : undefined;
    _sentry.captureException(error, scrubbed ? { extra: scrubbed } : undefined);
  } catch {
    // Never let telemetry crash the app
  }
}
