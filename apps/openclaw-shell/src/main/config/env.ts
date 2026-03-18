// Centralized startup environment validation.
// Called early in app.whenReady() before any services start.
// Fails fast with actionable diagnostics.

import { execFileSync } from 'child_process';

export interface EnvValidationResult {
  ok: boolean;
  warnings: string[];
  errors: string[];
}

interface BinaryCheck {
  name: string;
  command: string;
  args: string[];
  required: boolean;
  hint: string;
}

const BINARY_CHECKS: BinaryCheck[] = [
  {
    name: 'gws CLI',
    command: 'gws',
    args: ['--version'],
    required: false,
    hint: 'Gmail/Calendar workers will be unavailable. Install gws CLI to enable Google Workspace integration.',
  },
  {
    name: 'bw CLI',
    command: 'bw',
    args: ['--version'],
    required: false,
    hint: 'Bitwarden vault integration will be unavailable. Install the Bitwarden CLI to enable vault features.',
  },
];

function checkBinary(check: BinaryCheck): string | null {
  try {
    execFileSync(check.command, check.args, { timeout: 3000, stdio: 'pipe' });
    return null;
  } catch {
    return `${check.name} not found in PATH. ${check.hint}`;
  }
}

/**
 * Validate required environment variables and external binary availability.
 * Returns a result object — callers decide how to handle warnings vs errors.
 */
export function validateEnvironment(): EnvValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check node version — electron bundles its own but good to log
  const nodeVersion = process.versions.node;
  const [major] = nodeVersion.split('.').map(Number);
  if (major < 18) {
    errors.push(`Node.js ${nodeVersion} is below the minimum required version 18. Update Node.js.`);
  }

  // Check for safeStorage availability (Electron-only)
  try {
    // Dynamic import to avoid crashing in non-Electron environments
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { safeStorage } = require('electron');
    if (!safeStorage.isEncryptionAvailable()) {
      warnings.push(
        'safeStorage encryption is unavailable on this platform. ' +
        'Credentials will fall back to legacy plaintext file storage. ' +
        'This is expected in CI/headless environments.'
      );
    }
  } catch {
    warnings.push('Running outside Electron — safeStorage unavailable. Credential encryption disabled.');
  }

  // Check external binaries
  for (const check of BINARY_CHECKS) {
    const msg = checkBinary(check);
    if (msg) {
      if (check.required) {
        errors.push(msg);
      } else {
        warnings.push(msg);
      }
    }
  }

  // Check OPENCLAW_ROOT if explicitly set (warn if path doesn't exist)
  if (process.env.OPENCLAW_ROOT) {
    try {
      const { existsSync } = require('fs');
      if (!existsSync(process.env.OPENCLAW_ROOT)) {
        warnings.push(
          `OPENCLAW_ROOT is set to "${process.env.OPENCLAW_ROOT}" but the directory does not exist. ` +
          'It will be created on first use.'
        );
      }
    } catch {
      // ignore fs errors
    }
  }

  return {
    ok: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Log validation results to console and throw if there are blocking errors.
 */
export function assertEnvironment(): void {
  const result = validateEnvironment();

  for (const warn of result.warnings) {
    console.warn('[Env] Warning:', warn);
  }

  for (const err of result.errors) {
    console.error('[Env] Error:', err);
  }

  if (!result.ok) {
    throw new Error(
      `Environment validation failed with ${result.errors.length} error(s):\n` +
      result.errors.map(e => `  - ${e}`).join('\n')
    );
  }

  if (result.warnings.length === 0 && result.errors.length === 0) {
    console.log('[Env] Environment validation passed.');
  }
}
