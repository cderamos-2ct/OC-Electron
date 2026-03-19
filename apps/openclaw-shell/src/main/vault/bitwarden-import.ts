// Bitwarden Import — imports secrets from a Bitwarden JSON export file
// Supports standard Bitwarden export format (Settings → Export Vault → JSON)

import { readFileSync } from 'fs';
import { createLogger } from '../logging/logger.js';
import { upsertVaultSecret } from './vault-db-repo.js';
import { addCredentialUrl } from './vault-autofill.js';
import { appendVaultAuditEntry } from './vault-audit.js';

const log = createLogger('BitwardenImport');

// ─── Bitwarden Export Types ─────────────────────────────────────

interface BitwardenExportItem {
  id: string;
  organizationId: string | null;
  folderId: string | null;
  type: number; // 1=login, 2=secure note, 3=card, 4=identity
  reprompt: number;
  name: string;
  notes: string | null;
  favorite: boolean;
  login?: {
    username: string | null;
    password: string | null;
    totp: string | null;
    uris?: Array<{ match: number | null; uri: string }>;
  };
  fields?: Array<{ name: string; value: string; type: number }>;
  revisionDate: string;
  creationDate: string;
}

interface BitwardenExportFolder {
  id: string;
  name: string;
}

interface BitwardenExport {
  encrypted: boolean;
  folders: BitwardenExportFolder[];
  items: BitwardenExportItem[];
}

// ─── Import Result ──────────────────────────────────────────────

export interface ImportResult {
  imported: number;
  skipped: number;
  urlMappings: number;
  errors: string[];
}

// ─── Folder Mapping ─────────────────────────────────────────────

function mapBitwardenFolder(folderName: string | null): string {
  if (!folderName) return 'openclaw/tokens';

  const lower = folderName.toLowerCase();
  if (lower.includes('api') || lower.includes('key')) return 'openclaw/api-keys';
  if (lower.includes('oauth') || lower.includes('token')) return 'openclaw/oauth';
  if (lower.includes('device') || lower.includes('auth')) return 'openclaw/device-auth';

  // Default: map Bitwarden folder structure to openclaw namespace
  return `openclaw/${folderName.toLowerCase().replace(/\s+/g, '-')}`;
}

function deriveSecretName(item: BitwardenExportItem, folder: string): string {
  // Use the openclaw-secret-name custom field if present
  const customTag = item.fields?.find((f) => f.name === 'openclaw-secret-name');
  if (customTag) return customTag.value;

  // Otherwise derive from folder + sanitized name
  const safeName = item.name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return `${folder}/${safeName}`;
}

// ─── Import Logic ───────────────────────────────────────────────

export async function importBitwardenExport(filePath: string): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, urlMappings: 0, errors: [] };

  // Read and parse
  let data: BitwardenExport;
  try {
    const raw = readFileSync(filePath, 'utf-8');
    data = JSON.parse(raw) as BitwardenExport;
  } catch (err) {
    throw new Error(`Failed to read Bitwarden export: ${err instanceof Error ? err.message : err}`);
  }

  if (data.encrypted) {
    throw new Error('Encrypted Bitwarden exports are not supported. Please export as unencrypted JSON.');
  }

  // Build folder lookup
  const folderMap = new Map<string, string>();
  for (const folder of data.folders) {
    folderMap.set(folder.id, folder.name);
  }

  // Import items
  for (const item of data.items) {
    try {
      // Only import login items and secure notes
      if (item.type !== 1 && item.type !== 2) {
        result.skipped++;
        continue;
      }

      // Get value
      let value: string | null = null;
      if (item.type === 1 && item.login?.password) {
        value = item.login.password;
      } else if (item.type === 2 && item.notes) {
        value = item.notes;
      }

      if (!value) {
        result.skipped++;
        continue;
      }

      const folderName = item.folderId ? (folderMap.get(item.folderId) ?? null) : null;
      const folder = mapBitwardenFolder(folderName);
      const secretName = deriveSecretName(item, folder);

      // Upsert secret
      await upsertVaultSecret({
        name: secretName,
        value,
        folder,
        description: item.notes ? `Imported from Bitwarden. Notes: ${item.notes.substring(0, 200)}` : 'Imported from Bitwarden',
      });

      result.imported++;

      // Import URL mappings from URIs
      if (item.login?.uris) {
        for (const uri of item.login.uris) {
          if (!uri.uri) continue;
          try {
            const domain = new URL(uri.uri.startsWith('http') ? uri.uri : `https://${uri.uri}`).hostname;
            await addCredentialUrl(secretName, domain, item.login.username ?? undefined);
            result.urlMappings++;
          } catch {
            // Invalid URI — skip URL mapping, secret still imported
          }
        }
      }

      // Audit log
      appendVaultAuditEntry({
        timestamp: new Date().toISOString(),
        agentId: 'user',
        secretName,
        action: 'create',
        result: 'success',
        purpose: 'bitwarden-import',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`${item.name}: ${msg}`);
    }
  }

  log.info(`Bitwarden import complete: ${result.imported} imported, ${result.skipped} skipped, ${result.urlMappings} URL mappings, ${result.errors.length} errors`);

  return result;
}
