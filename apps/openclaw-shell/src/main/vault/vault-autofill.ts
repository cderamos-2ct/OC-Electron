// Vault Auto-Fill — matches page URLs against stored credential mappings
// Used by webview preload scripts to offer auto-fill for login forms

import { query } from 'openclaw-db';
import { getVaultSecret, appendAuditLogEntry } from './vault-db-repo.js';
import { appendVaultAuditEntry } from './vault-audit.js';
import { createLogger } from '../logging/logger.js';

const log = createLogger('VaultAutoFill');

// ─── Types ──────────────────────────────────────────────────────

export interface AutoFillMatch {
  secretName: string;
  username: string | null;
  password: string;
}

export interface CredentialUrlMapping {
  id: string;
  secretName: string;
  urlPattern: string;
  username: string | null;
  createdAt: string;
}

// ─── URL Matching ───────────────────────────────────────────────

/**
 * Extract the hostname from a URL string.
 */
function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Match a domain against a URL pattern (supports glob-style wildcards).
 * Examples:
 *   "github.com" matches "github.com"
 *   "*.google.com" matches "accounts.google.com", "mail.google.com"
 *   "*.example.com" does NOT match "example.com"
 */
function domainMatchesPattern(domain: string, pattern: string): boolean {
  if (domain === pattern) return true;

  if (pattern.startsWith('*.')) {
    const suffix = pattern.substring(2);
    return domain.endsWith('.' + suffix);
  }

  return false;
}

// ─── Query Functions ────────────────────────────────────────────

/**
 * Find all credential URL mappings that match a given page URL.
 * Returns matched credentials with decrypted passwords.
 */
export async function findCredentialsForUrl(url: string): Promise<AutoFillMatch[]> {
  const domain = extractDomain(url);
  if (!domain) return [];

  // Fetch all URL mappings — there shouldn't be many, so full scan is fine
  const result = await query<{ secret_name: string; url_pattern: string; username: string | null }>(
    `SELECT secret_name, url_pattern, username
     FROM vault_credential_urls
     ORDER BY url_pattern ASC`,
  );

  const matches: AutoFillMatch[] = [];

  for (const row of result.rows) {
    if (domainMatchesPattern(domain, row.url_pattern)) {
      const secret = await getVaultSecret(row.secret_name);
      if (secret && secret.value !== 'PLACEHOLDER') {
        matches.push({
          secretName: row.secret_name,
          username: row.username,
          password: secret.value,
        });
      }
    }
  }

  return matches;
}

// ─── CRUD for URL Mappings ──────────────────────────────────────

export async function addCredentialUrl(
  secretName: string,
  urlPattern: string,
  username?: string,
): Promise<CredentialUrlMapping> {
  const result = await query<CredentialUrlMapping>(
    `INSERT INTO vault_credential_urls (secret_name, url_pattern, username)
     VALUES ($1, $2, $3)
     RETURNING id, secret_name AS "secretName", url_pattern AS "urlPattern", username, created_at AS "createdAt"`,
    [secretName, urlPattern, username ?? null],
  );
  return result.rows[0];
}

export async function removeCredentialUrl(id: string): Promise<boolean> {
  const result = await query('DELETE FROM vault_credential_urls WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function listCredentialUrlsForSecret(secretName: string): Promise<CredentialUrlMapping[]> {
  const result = await query<CredentialUrlMapping>(
    `SELECT id, secret_name AS "secretName", url_pattern AS "urlPattern", username, created_at AS "createdAt"
     FROM vault_credential_urls
     WHERE secret_name = $1
     ORDER BY created_at ASC`,
    [secretName],
  );
  return result.rows;
}

export async function listAllCredentialUrls(): Promise<CredentialUrlMapping[]> {
  const result = await query<CredentialUrlMapping>(
    `SELECT id, secret_name AS "secretName", url_pattern AS "urlPattern", username, created_at AS "createdAt"
     FROM vault_credential_urls
     ORDER BY url_pattern ASC`,
  );
  return result.rows;
}

// ─── Auto-Fill Audit ────────────────────────────────────────────

export function logAutoFillAccess(secretName: string, url: string): void {
  const entry = {
    timestamp: new Date().toISOString(),
    agentId: 'user',
    secretName,
    action: 'access' as const,
    result: 'success' as const,
    purpose: `autofill: ${url}`,
  };

  // Dual-write audit
  appendVaultAuditEntry(entry);
  void appendAuditLogEntry({
    agentId: 'user',
    action: 'access',
    secretName,
    result: 'success',
    purpose: `autofill: ${url}`,
  }).catch(() => {
    // Non-fatal
  });
}

// ─── Save Password Offer ────────────────────────────────────────

export interface SavePasswordOffer {
  url: string;
  username: string;
  password: string;
}

/**
 * Save a credential captured from a form submission.
 * Creates both the vault secret and the URL mapping.
 */
export async function saveCredentialFromForm(
  offer: SavePasswordOffer,
): Promise<{ secretName: string; urlMappingId: string }> {
  const domain = extractDomain(offer.url);
  if (!domain) throw new Error('Invalid URL');

  // Derive secret name from domain
  const safeDomain = domain.replace(/\./g, '-');
  const secretName = `openclaw/tokens/${safeDomain}`;

  // Import dynamically to avoid circular dependency
  const { upsertVaultSecret } = await import('./vault-db-repo.js');

  await upsertVaultSecret({
    name: secretName,
    value: offer.password,
    folder: 'openclaw/tokens',
    description: `Auto-saved from ${domain}`,
  });

  const mapping = await addCredentialUrl(secretName, domain, offer.username);

  log.info(`Saved credential from form submission: ${domain} → ${secretName}`);

  return { secretName, urlMappingId: mapping.id };
}
