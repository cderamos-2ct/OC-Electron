// safeStorage wrapper for encrypted credential CRUD.
// Falls back to a no-op/plaintext mode when safeStorage is unavailable
// (CI, headless Linux, unit tests).

import { safeStorage } from 'electron';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { SHELL_CONFIG_DIR_NAME } from '../../shared/constants.js';

const STORE_FILE = join(homedir(), SHELL_CONFIG_DIR_NAME, 'credentials.enc');
const CONFIG_DIR = join(homedir(), SHELL_CONFIG_DIR_NAME);

type CredentialMap = Record<string, string>;

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

function isEncryptionAvailable(): boolean {
  // Skip safeStorage when ad-hoc signed — macOS prompts for keychain
  // access on every launch because the signature hash changes per build.
  // Re-enable once the app is signed with a stable developer certificate.
  if (process.env.AEGILUME_SKIP_SAFE_STORAGE === '1') return false;
  if (!process.env.CSC_LINK && !process.env.CSC_NAME) return false;
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

/**
 * Load the encrypted credential map from disk.
 * Returns an empty map if the file doesn't exist or can't be decrypted.
 */
function loadStore(): CredentialMap {
  if (!existsSync(STORE_FILE)) return {};

  try {
    const buf = readFileSync(STORE_FILE);

    if (isEncryptionAvailable()) {
      const json = safeStorage.decryptString(buf);
      return JSON.parse(json) as CredentialMap;
    } else {
      // Fallback: store was written as plaintext JSON (headless mode)
      return JSON.parse(buf.toString('utf-8')) as CredentialMap;
    }
  } catch (err) {
    console.warn('[SecureCredentialsStore] Failed to load credentials store:', err);
    return {};
  }
}

/**
 * Persist the credential map to disk (encrypted if available).
 */
function saveStore(map: CredentialMap): void {
  ensureConfigDir();
  const json = JSON.stringify(map);

  if (isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(json);
    writeFileSync(STORE_FILE, encrypted, { mode: 0o600 });
  } else {
    // Headless/CI fallback — plaintext
    writeFileSync(STORE_FILE, json, { encoding: 'utf-8', mode: 0o600 });
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Store an encrypted credential value under the given key.
 */
export function setCredential(key: string, value: string): void {
  const map = loadStore();
  map[key] = value;
  saveStore(map);
}

/**
 * Retrieve a credential value by key. Returns undefined if not found.
 */
export function getCredential(key: string): string | undefined {
  const map = loadStore();
  return map[key];
}

/**
 * Remove a credential from the store.
 */
export function deleteCredential(key: string): void {
  const map = loadStore();
  if (key in map) {
    delete map[key];
    saveStore(map);
  }
}

/**
 * Check whether the encrypted store file exists and is readable.
 */
export function hasCredentialStore(): boolean {
  return existsSync(STORE_FILE);
}

/**
 * Return all credential keys currently stored (values are NOT returned).
 */
export function listCredentialKeys(): string[] {
  return Object.keys(loadStore());
}

/**
 * Delete the entire credential store file (use with caution).
 */
export function clearCredentialStore(): void {
  const { unlinkSync } = require('fs');
  if (existsSync(STORE_FILE)) {
    unlinkSync(STORE_FILE);
  }
}
