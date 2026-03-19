// Vault Export — export secrets to Bitwarden-compatible JSON or CSV
// Supports migration to other password managers

import { writeFileSync } from 'fs';
import { listVaultSecrets } from './vault-db-repo.js';
import { listAllCredentialUrls } from './vault-autofill.js';
import { appendVaultAuditEntry } from './vault-audit.js';
import { createLogger } from '../logging/logger.js';

const log = createLogger('VaultExport');

// ─── Types ──────────────────────────────────────────────────────

export type ExportFormat = 'json' | 'csv';

export interface ExportResult {
  secretCount: number;
  filePath: string;
}

// ─── Bitwarden JSON Export Format ───────────────────────────────

interface BitwardenExportItem {
  id: string;
  organizationId: null;
  folderId: string | null;
  type: 1; // login
  reprompt: 0;
  name: string;
  notes: string | null;
  favorite: false;
  login: {
    username: string | null;
    password: string;
    totp: string | null;
    uris: Array<{ match: null; uri: string }>;
  };
  fields: Array<{ name: string; value: string; type: 0 }>;
}

interface BitwardenExport {
  encrypted: false;
  folders: Array<{ id: string; name: string }>;
  items: BitwardenExportItem[];
}

// ─── Export Functions ────────────────────────────────────────────

export async function exportVault(format: ExportFormat, filePath: string): Promise<ExportResult> {
  const secrets = await listVaultSecrets();
  const urlMappings = await listAllCredentialUrls();

  // Build URL lookup: secretName → urls[]
  const urlMap = new Map<string, Array<{ url: string; username: string | null }>>();
  for (const mapping of urlMappings) {
    if (!urlMap.has(mapping.secretName)) {
      urlMap.set(mapping.secretName, []);
    }
    urlMap.get(mapping.secretName)!.push({ url: mapping.urlPattern, username: mapping.username });
  }

  let content: string;

  if (format === 'json') {
    content = exportBitwardenJson(secrets, urlMap);
  } else {
    content = exportCsv(secrets, urlMap);
  }

  writeFileSync(filePath, content, { encoding: 'utf-8', mode: 0o600 });

  // Audit log every exported secret
  for (const secret of secrets) {
    appendVaultAuditEntry({
      timestamp: new Date().toISOString(),
      agentId: 'user',
      secretName: secret.name,
      action: 'access',
      result: 'success',
      purpose: `export-${format}`,
    });
  }

  log.info(`Exported ${secrets.length} secrets as ${format} to ${filePath}`);

  return { secretCount: secrets.length, filePath };
}

function exportBitwardenJson(
  secrets: Array<{ id: string; name: string; value: string; folder?: string | null; description: string | null }>,
  urlMap: Map<string, Array<{ url: string; username: string | null }>>,
): string {
  // Collect unique folders
  const folderSet = new Set<string>();
  for (const s of secrets) {
    if (s.folder) folderSet.add(s.folder);
  }

  const folders = Array.from(folderSet).map((name, i) => ({
    id: `folder-${i}`,
    name,
  }));
  const folderIdMap = new Map(folders.map((f) => [f.name, f.id]));

  const items: BitwardenExportItem[] = secrets.map((secret) => {
    const urls = urlMap.get(secret.name) ?? [];
    const primaryUsername = urls[0]?.username ?? null;

    return {
      id: secret.id,
      organizationId: null,
      folderId: secret.folder ? (folderIdMap.get(secret.folder) ?? null) as string | null : null,
      type: 1,
      reprompt: 0,
      name: secret.name,
      notes: secret.description,
      favorite: false,
      login: {
        username: primaryUsername,
        password: secret.value,
        totp: null,
        uris: urls.map((u) => ({ match: null, uri: `https://${u.url}` })),
      },
      fields: [{ name: 'openclaw-secret-name', value: secret.name, type: 0 }],
    };
  });

  const output: BitwardenExport = {
    encrypted: false,
    folders,
    items,
  };

  return JSON.stringify(output, null, 2);
}

function exportCsv(
  secrets: Array<{ name: string; value: string; folder?: string | null; description: string | null }>,
  urlMap: Map<string, Array<{ url: string; username: string | null }>>,
): string {
  const header = 'name,username,password,url,folder,notes';
  const rows = secrets.map((s) => {
    const urls = urlMap.get(s.name) ?? [];
    const username = urls[0]?.username ?? '';
    const url = urls[0]?.url ?? '';
    const notes = (s.description ?? '').replace(/"/g, '""');
    return `"${s.name}","${username}","${s.value}","${url}","${s.folder ?? ''}","${notes}"`;
  });

  return [header, ...rows].join('\n');
}
