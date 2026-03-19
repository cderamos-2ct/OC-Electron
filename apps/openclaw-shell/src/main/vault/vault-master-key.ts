// Vault Master Key Management — generates, stores, and loads the encryption key
// Uses Electron safeStorage (OS keychain, hardware-backed on Apple Silicon)
// Falls back to plaintext file in headless/CI mode

import { safeStorage } from 'electron';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { randomBytes } from 'crypto';
import { SHELL_CONFIG_DIR_NAME, VAULT_MASTER_ENC_FILE } from '../../shared/constants.js';
import { createLogger } from '../logging/logger.js';

const log = createLogger('VaultMasterKey');

const CONFIG_DIR = join(homedir(), SHELL_CONFIG_DIR_NAME);
const KEY_FILE = join(CONFIG_DIR, VAULT_MASTER_ENC_FILE);
const KEY_LENGTH = 32; // 256-bit key

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

function isEncryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

/**
 * Generate a new master key and persist it encrypted via safeStorage.
 * Called once on first run; subsequent runs use loadMasterKey().
 */
function generateAndStoreMasterKey(): string {
  const key = randomBytes(KEY_LENGTH).toString('hex');
  ensureConfigDir();

  if (isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(key);
    writeFileSync(KEY_FILE, encrypted, { mode: 0o600 });
    log.info('Generated and stored vault master key (safeStorage encrypted)');
  } else {
    // Headless/CI fallback — plaintext
    writeFileSync(KEY_FILE, key, { encoding: 'utf-8', mode: 0o600 });
    log.warn('Generated vault master key (plaintext fallback — safeStorage unavailable)');
  }

  return key;
}

/**
 * Load the master key from the encrypted file.
 * Returns the hex-encoded key string.
 */
function loadMasterKey(): string {
  const buf = readFileSync(KEY_FILE);

  if (isEncryptionAvailable()) {
    return safeStorage.decryptString(buf);
  }
  // Plaintext fallback
  return buf.toString('utf-8');
}

/**
 * Initialize the vault master key.
 * Generates on first run, loads on subsequent runs.
 * Sets process.env.VAULT_MASTER_KEY so vault-db-repo.ts works unchanged.
 */
export function initMasterKey(): string {
  let key: string;

  if (existsSync(KEY_FILE)) {
    try {
      key = loadMasterKey();
      log.info('Loaded vault master key from disk');
    } catch (err) {
      log.error('Failed to load vault master key, generating new one:', err);
      key = generateAndStoreMasterKey();
    }
  } else {
    key = generateAndStoreMasterKey();
  }

  process.env.VAULT_MASTER_KEY = key;
  return key;
}

/**
 * Check whether a master key file exists.
 */
export function hasMasterKey(): boolean {
  return existsSync(KEY_FILE);
}

/**
 * Re-encrypt the master key with a new safeStorage key.
 * Useful after OS keychain changes or migration between machines.
 */
export function rekeyMasterKey(): void {
  const key = loadMasterKey();
  ensureConfigDir();

  if (isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(key);
    writeFileSync(KEY_FILE, encrypted, { mode: 0o600 });
    log.info('Re-encrypted vault master key with current safeStorage key');
  } else {
    log.warn('Cannot re-key: safeStorage unavailable');
  }
}
