// Vault DB Repository — Postgres CRUD for vault_secrets and vault_approvals
// Uses openclaw-db pool to persist secret metadata and approval queue
// Secrets are encrypted at rest using pgp_sym_encrypt via VAULT_MASTER_KEY env var

import { query, withTransaction } from 'openclaw-db';

function getVaultMasterKey(): string {
  const key = process.env.VAULT_MASTER_KEY;
  if (!key) throw new Error('VAULT_MASTER_KEY environment variable is not set');
  return key;
}

// ─── Types ──────────────────────────────────────────────────────

export interface VaultSecretRow {
  id: string;
  name: string;
  value: string;
  description: string | null;
  owner_agent: string | null;
  acl: string[];
  rotated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertVaultSecretInput {
  name: string;
  value: string;
  description?: string;
  ownerAgentSlug?: string;
  acl?: string[];
}

export interface UpdateRotationInput {
  name: string;
  value: string;
  rotatedAt: string;
}

export interface PendingApprovalRow {
  id: string;
  agent_id: string;
  secret_name: string;
  purpose: string;
  requested_at: string;
  decided_at: string | null;
  decision: 'pending' | 'approved' | 'denied';
}

// ─── Secret Read Operations ─────────────────────────────────────

export async function getVaultSecret(name: string): Promise<VaultSecretRow | null> {
  const key = getVaultMasterKey();
  const result = await query<VaultSecretRow>(
    `SELECT id, name,
            CASE WHEN encrypted_value IS NOT NULL
                 THEN vault_decrypt(encrypted_value, $2)
                 ELSE value
            END AS value,
            description, owner_agent, acl, rotated_at, created_at, updated_at
     FROM vault_secrets
     WHERE name = $1`,
    [name, key],
  );
  return result.rows[0] ?? null;
}

export async function countVaultSecrets(): Promise<number> {
  const result = await query<{ count: string }>('SELECT COUNT(*) AS count FROM vault_secrets');
  return parseInt(result.rows[0]?.count ?? '0', 10);
}

export async function listVaultSecrets(): Promise<VaultSecretRow[]> {
  const key = getVaultMasterKey();
  const result = await query<VaultSecretRow>(
    `SELECT id, name,
            CASE WHEN encrypted_value IS NOT NULL
                 THEN vault_decrypt(encrypted_value, $1)
                 ELSE value
            END AS value,
            description, owner_agent, acl, rotated_at, created_at, updated_at
     FROM vault_secrets
     ORDER BY name ASC`,
    [key],
  );
  return result.rows;
}

export async function getVaultSecretsByAgent(agentSlug: string): Promise<VaultSecretRow[]> {
  const key = getVaultMasterKey();
  const result = await query<VaultSecretRow>(
    `SELECT vs.id, vs.name,
            CASE WHEN vs.encrypted_value IS NOT NULL
                 THEN vault_decrypt(vs.encrypted_value, $2)
                 ELSE vs.value
            END AS value,
            vs.description, vs.owner_agent, vs.acl, vs.rotated_at, vs.created_at, vs.updated_at
     FROM vault_secrets vs
     LEFT JOIN agents a ON a.id = vs.owner_agent
     WHERE a.slug = $1 OR vs.acl ? $1
     ORDER BY vs.name ASC`,
    [agentSlug, key],
  );
  return result.rows;
}

// ─── Secret Write Operations ─────────────────────────────────────

export async function upsertVaultSecret(input: UpsertVaultSecretInput): Promise<VaultSecretRow> {
  const aclJson = JSON.stringify(input.acl ?? []);
  const key = getVaultMasterKey();

  const result = await query<VaultSecretRow>(
    `INSERT INTO vault_secrets (name, value, encrypted_value, description, owner_agent, acl)
     VALUES (
       $1, '', vault_encrypt($2, $6), $3,
       (SELECT id FROM agents WHERE slug = $4 LIMIT 1),
       $5::jsonb
     )
     ON CONFLICT (name) DO UPDATE SET
       encrypted_value = vault_encrypt($2, $6),
       description     = COALESCE(EXCLUDED.description, vault_secrets.description),
       owner_agent     = COALESCE(EXCLUDED.owner_agent, vault_secrets.owner_agent),
       acl             = EXCLUDED.acl,
       updated_at      = NOW()
     RETURNING id, name,
               vault_decrypt(encrypted_value, $6) AS value,
               description, owner_agent, acl, rotated_at, created_at, updated_at`,
    [input.name, input.value, input.description ?? null, input.ownerAgentSlug ?? null, aclJson, key],
  );
  return result.rows[0];
}

export async function recordRotation(input: UpdateRotationInput): Promise<void> {
  const key = getVaultMasterKey();
  await query(
    `UPDATE vault_secrets
     SET encrypted_value = vault_encrypt($2, $4),
         rotated_at      = $3::timestamptz,
         updated_at      = NOW()
     WHERE name = $1`,
    [input.name, input.value, input.rotatedAt, key],
  );
}

export async function deleteVaultSecret(name: string): Promise<boolean> {
  const result = await query('DELETE FROM vault_secrets WHERE name = $1', [name]);
  return (result.rowCount ?? 0) > 0;
}

export async function updateVaultSecretAcl(name: string, acl: string[]): Promise<boolean> {
  const result = await query(
    `UPDATE vault_secrets SET acl = $2::jsonb, updated_at = NOW() WHERE name = $1`,
    [name, JSON.stringify(acl)],
  );
  return (result.rowCount ?? 0) > 0;
}

// ─── ACL Helpers ────────────────────────────────────────────────

export async function canAgentReadSecret(agentSlug: string, secretName: string): Promise<boolean> {
  const result = await query<{ allowed: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM vault_secrets vs
       LEFT JOIN agents a ON a.id = vs.owner_agent
       WHERE vs.name = $1
         AND (a.slug = $2 OR vs.acl ? $2)
     ) AS allowed`,
    [secretName, agentSlug],
  );
  return result.rows[0]?.allowed ?? false;
}

// ─── Bulk Sync from Bitwarden ────────────────────────────────────

export async function syncVaultSecretsFromBitwarden(
  entries: Array<{ name: string; value: string; description?: string }>,
  ownerAgentSlug?: string,
): Promise<{ upserted: number; errors: string[] }> {
  const errors: string[] = [];
  let upserted = 0;

  const key = getVaultMasterKey();
  await withTransaction(async (client) => {
    for (const entry of entries) {
      try {
        await client.query(
          `INSERT INTO vault_secrets (name, value, encrypted_value, description, owner_agent)
           VALUES ($1, '', vault_encrypt($2, $5), $3, (SELECT id FROM agents WHERE slug = $4 LIMIT 1))
           ON CONFLICT (name) DO UPDATE SET
             encrypted_value = vault_encrypt($2, $5),
             updated_at      = NOW()`,
          [entry.name, entry.value, entry.description ?? null, ownerAgentSlug ?? null, key],
        );
        upserted++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${entry.name}: ${msg}`);
      }
    }
  });

  return { upserted, errors };
}

// ─── Postgres Audit Log ──────────────────────────────────────────

export async function appendAuditLogEntry(entry: {
  agentId: string;
  action: string;
  secretName: string;
  result: string;
  policyId?: string;
  leaseId?: string;
  purpose?: string;
  error?: string;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log (agent_id, action, resource_type, resource_id, payload)
       SELECT
         (SELECT id FROM agents WHERE slug = $1 LIMIT 1),
         $2,
         'vault_secret',
         (SELECT id FROM vault_secrets WHERE name = $3 LIMIT 1),
         $4::jsonb`,
      [
        entry.agentId,
        entry.action,
        entry.secretName,
        JSON.stringify({
          secretName: entry.secretName,
          result: entry.result,
          policyId: entry.policyId,
          leaseId: entry.leaseId,
          purpose: entry.purpose,
          error: entry.error,
        }),
      ],
    );
  } catch {
    // Non-fatal — file-based audit is the source of truth
  }
}

// ─── Approval Queue (persisted) ──────────────────────────────────

export async function createApprovalRecord(approval: {
  id: string;
  agentId: string;
  secretName: string;
  purpose: string;
}): Promise<void> {
  await query(
    `INSERT INTO vault_approvals (id, agent_id, secret_name, purpose)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO NOTHING`,
    [approval.id, approval.agentId, approval.secretName, approval.purpose],
  );
}

export async function resolveApprovalRecord(
  id: string,
  decision: 'approved' | 'denied',
): Promise<void> {
  await query(
    `UPDATE vault_approvals
     SET decision = $2, decided_at = NOW()
     WHERE id = $1`,
    [id, decision],
  );
}

export async function listPendingApprovalRecords(): Promise<PendingApprovalRow[]> {
  const result = await query<PendingApprovalRow>(
    `SELECT id, agent_id, secret_name, purpose, requested_at, decided_at, decision
     FROM vault_approvals
     WHERE decision = 'pending'
     ORDER BY requested_at ASC`,
  );
  return result.rows;
}
