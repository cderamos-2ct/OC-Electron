// Platform-specific path resolution for provisioning binaries and data

import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { app } from 'electron';

/** Base data directory for all Aegilume data */
export function getDataDir(): string {
  switch (process.platform) {
    case 'win32':
      return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'Aegilume');
    case 'linux':
      return join(process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'), 'aegilume');
    default: // darwin
      return join(homedir(), '.aegilume');
  }
}

/** Resolve a binary or resource bundled in extraResources (packaged) or vendor/ (dev) */
export function resolveResourcePath(...segments: string[]): string {
  if (app.isPackaged) {
    // In packaged builds, extraResources are at process.resourcesPath
    return join(process.resourcesPath, ...segments);
  }
  // In dev, fall back to vendor/ directory in the app root
  return join(__dirname, '..', '..', '..', 'vendor', ...segments);
}

/** Resolve a specific Postgres binary (initdb, pg_ctl, postgres, etc.) */
export function resolvePostgresBin(binary: string): string {
  const resourcePath = resolveResourcePath('postgres', 'bin', binary);
  if (existsSync(resourcePath)) {
    return resourcePath;
  }
  // Fall back to system PATH in development
  return binary;
}

/** Resolve the pgvector shared library path */
export function resolvePgVectorLib(): string {
  return resolveResourcePath('postgres', 'lib', 'vector.so');
}

/** Resolve the Vaultwarden binary */
export function resolveVaultwardenBin(): string {
  const resourcePath = resolveResourcePath('vaultwarden', 'vaultwarden');
  if (existsSync(resourcePath)) {
    return resourcePath;
  }
  return 'vaultwarden';
}

/** Resolve the Bitwarden CLI binary */
export function resolveBwBin(): string {
  const resourcePath = resolveResourcePath('bw', 'bw');
  if (existsSync(resourcePath)) {
    return resourcePath;
  }
  return process.env.BW_PATH ?? 'bw';
}

/** Resolve the GWS CLI binary */
export function resolveGwsBin(): string {
  const resourcePath = resolveResourcePath('gws', 'gws');
  if (existsSync(resourcePath)) {
    return resourcePath;
  }
  return process.env.GWS_BIN ?? 'gws';
}

/** Service data directories */
export function getPostgresDataDir(): string {
  return join(getDataDir(), 'postgres', 'data');
}

export function getVaultwardenDataDir(): string {
  return join(getDataDir(), 'vaultwarden');
}

export function getGatewayDir(): string {
  return join(getDataDir(), 'gateway');
}

export function getCodeServerDir(): string {
  return join(getDataDir(), 'code-server');
}

export function getProvisioningStatePath(): string {
  return join(getDataDir(), 'provisioning.json');
}

export function getPathsConfigPath(): string {
  return join(getDataDir(), 'paths.json');
}
