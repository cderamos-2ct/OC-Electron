import { execFile } from 'child_process';

import { resolveGwsBin } from '../provisioning/platform.js';

const GWS_BIN = resolveGwsBin();
const GWS_TIMEOUT_MS = 30_000;

export class GwsError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number | null,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = 'GwsError';
  }
}

/**
 * Thin wrapper around the `gws` CLI (Google Workspace CLI).
 *
 * Syntax: gws <service> <resource> [sub-resource] <method> --params '{JSON}' [--json '{JSON}']
 * Output is JSON by default; --format json is passed for safety.
 */
export async function gws(args: string[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    execFile(GWS_BIN, [...args, '--format', 'json'], { timeout: GWS_TIMEOUT_MS }, (error, stdout, stderr) => {
      if (error) {
        const msg = stderr.trim() || error.message;
        const exitCode = typeof (error as any).status === 'number' ? (error as any).status : null;
        reject(new GwsError(`gws ${args[0]} failed: ${msg}`, exitCode, stderr));
        return;
      }

      const trimmed = stdout.trim();
      if (!trimmed) {
        resolve(null);
        return;
      }

      try {
        resolve(JSON.parse(trimmed));
      } catch {
        // Some commands may return non-JSON success output
        resolve(trimmed);
      }
    });
  });
}

/**
 * Check if the user is authenticated with `gws`.
 * Returns true if authenticated, false otherwise.
 */
export async function gwsCheckAuth(): Promise<boolean> {
  try {
    await gws(['auth', 'status']);
    return true;
  } catch {
    return false;
  }
}
