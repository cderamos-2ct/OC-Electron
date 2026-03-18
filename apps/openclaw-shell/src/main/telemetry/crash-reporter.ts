/**
 * Telemetry facade wrapping @sentry/electron (main process).
 *
 * Privacy-first: opt-in only. If consent is false, Sentry is never initialised
 * and all facade methods are no-ops. PII scrubbing is applied via beforeSend.
 */

import { createLogger } from '../logging/logger.js';
import type { TelemetryOptions, TelemetryConfig } from '../../shared/telemetry-types.js';

const log = createLogger('telemetry');

// ── PII scrubbing ──────────────────────────────────────────────────────────────

// Patterns that must never leave the device
const PII_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,          // Bearer tokens
  /\bsk-[A-Za-z0-9]{10,}/g,                      // OpenAI / Anthropic secret keys
  /\bghp_[A-Za-z0-9]{10,}/g,                     // GitHub PATs
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, // email addresses
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

// ── State ──────────────────────────────────────────────────────────────────────

let _initialized = false;
let _consentGiven = false;
let _consentTimestamp: string | null = null;

// Lazy-loaded Sentry instance — only assigned when consent is true
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _sentry: any = null;

// ── Init ───────────────────────────────────────────────────────────────────────

export function initTelemetry(options: TelemetryOptions): void {
  if (_initialized) return;
  _initialized = true;
  _consentGiven = options.consent;

  if (!options.consent) {
    log.info('Telemetry disabled — no user consent.');
    return;
  }

  _consentTimestamp = new Date().toISOString();

  void (async () => {
    try {
      const Sentry = await import('@sentry/electron/main');
      _sentry = Sentry;

      Sentry.init({
        dsn: options.dsn,
        release: options.appVersion,
        environment: options.environment,
        // Drop breadcrumbs from vault channels
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
          // Scrub exception values
          if (event.exception?.values) {
            for (const ex of event.exception.values) {
              if (ex.value) {
                ex.value = scrubString(ex.value);
              }
            }
          }
          // Scrub extra context
          if (event.extra) {
            event.extra = scrubObject(event.extra as Record<string, unknown>);
          }
          // Strip request bodies and headers that may carry PII
          if (event.request) {
            event.request.data = undefined;
            event.request.headers = undefined;
            event.request.cookies = undefined;
          }
          return event;
        },
      });

      log.info('Telemetry initialised (Sentry).');
    } catch (err) {
      log.warn('Failed to initialise Sentry:', err);
    }
  })();
}

// ── Public API ────────────────────────────────────────────────────────────────

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!_consentGiven || !_sentry) return;
  try {
    const scrubbed = context ? scrubObject(context) : undefined;
    _sentry.captureException(error, scrubbed ? { extra: scrubbed } : undefined);
  } catch {
    // Never let telemetry crash the app
  }
}

export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
): void {
  if (!_consentGiven || !_sentry) return;
  try {
    _sentry.captureMessage(scrubString(message), level);
  } catch {
    // Never let telemetry crash the app
  }
}

export function setTelemetryConsent(enabled: boolean): void {
  _consentGiven = enabled;
  if (enabled) {
    _consentTimestamp = new Date().toISOString();
  } else {
    _consentTimestamp = null;
    // Close Sentry client so no more events are sent
    if (_sentry) {
      try {
        void _sentry.close(2000);
      } catch {
        // ignore
      }
      _sentry = null;
    }
  }
  log.info(`Telemetry consent updated: ${String(enabled)}`);
}

export function isTelemetryEnabled(): boolean {
  return _consentGiven;
}

export function getTelemetryConfig(): TelemetryConfig {
  return {
    enabled: _consentGiven,
    consentGiven: _consentGiven,
    consentTimestamp: _consentTimestamp,
  };
}
