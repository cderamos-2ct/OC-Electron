// Vault Gateway Routes — expose vault operations via the OpenClaw Gateway API
// Enables remote/mobile access to credentials through the existing Gateway auth layer

import type { VaultBridge } from './vault-bridge.js';
import { generateTOTP } from './totp.js';
import { getVaultSecret } from './vault-db-repo.js';
import { appendVaultAuditEntry } from './vault-audit.js';
import { createLogger } from '../logging/logger.js';

const log = createLogger('VaultGateway');

// ─── Types ──────────────────────────────────────────────────────

interface GatewayRequest {
  method: string;
  path: string;
  params: Record<string, string>;
  body: Record<string, unknown>;
  clientId: string; // Authenticated client identifier
}

interface GatewayResponse {
  status: number;
  body: unknown;
}

// ─── Rate Limiting ──────────────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10; // requests per minute
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(clientId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(clientId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

// ─── Route Handler ──────────────────────────────────────────────

export function createVaultGatewayHandler(vaultBridge: VaultBridge) {
  return async (req: GatewayRequest): Promise<GatewayResponse> => {
    // Rate limit check
    if (!checkRateLimit(req.clientId)) {
      return { status: 429, body: { error: 'Rate limit exceeded. Max 10 requests per minute.' } };
    }

    try {
      return await routeRequest(req, vaultBridge);
    } catch (err) {
      log.error('Vault gateway error:', err);
      return { status: 500, body: { error: err instanceof Error ? err.message : 'Internal error' } };
    }
  };
}

async function routeRequest(req: GatewayRequest, bridge: VaultBridge): Promise<GatewayResponse> {
  const { method, path, params, body, clientId } = req;

  // GET /vault/status
  if (method === 'GET' && path === '/vault/status') {
    const status = await bridge.getStatus();
    return { status: 200, body: status };
  }

  // GET /vault/secrets — list metadata (no values)
  if (method === 'GET' && path === '/vault/secrets') {
    const secrets = await bridge.listSecrets();
    // Strip any value data — metadata only
    const safe = secrets.map(({ id, name, folder, lastRotatedAt, createdAt, updatedAt, hasActiveLease }) => ({
      id, name, folder, lastRotatedAt, createdAt, updatedAt, hasActiveLease,
    }));
    return { status: 200, body: safe };
  }

  // POST /vault/secrets/:name/lease — request a lease
  if (method === 'POST' && path.match(/^\/vault\/secrets\/[^/]+\/lease$/)) {
    const secretName = decodeURIComponent(params.name || path.split('/')[3]);
    const purpose = (body.purpose as string) ?? `gateway-lease: ${clientId}`;

    const lease = await bridge.requestSecret(clientId, secretName, purpose);

    // Audit with gateway source
    appendVaultAuditEntry({
      timestamp: new Date().toISOString(),
      agentId: clientId,
      secretName,
      action: 'access',
      result: lease ? 'success' : 'denied',
      purpose: `gateway: ${purpose}`,
    });

    if (!lease) {
      return { status: 403, body: { error: 'Lease denied — requires approval or secret not found' } };
    }

    return {
      status: 200,
      body: {
        leaseId: lease.id,
        secretName: lease.secretName,
        value: lease.value,
        expiresAt: lease.expiresAt,
      },
    };
  }

  // POST /vault/secrets/:name/approve — approve/deny pending approval
  if (method === 'POST' && path.match(/^\/vault\/secrets\/[^/]+\/approve$/)) {
    const approvalId = body.approvalId as string;
    const decision = body.decision as 'approved' | 'denied';

    if (!approvalId || !decision) {
      return { status: 400, body: { error: 'Missing approvalId or decision' } };
    }

    const ok = await bridge.decideApproval(approvalId, decision);
    return { status: ok ? 200 : 404, body: { ok } };
  }

  // GET /vault/totp/:name — get current TOTP code
  if (method === 'GET' && path.match(/^\/vault\/totp\/[^/]+$/)) {
    const secretName = decodeURIComponent(params.name || path.split('/')[3]);

    const secret = await getVaultSecret(secretName);
    if (!secret || !secret.value) {
      return { status: 404, body: { error: 'Secret not found' } };
    }

    // Check if there's a totp_secret field
    // For now, we need to query it directly since VaultSecretRow may not include it yet
    const totpResult = await import('openclaw-db').then((db) =>
      db.query<{ totp_secret: string | null }>(
        'SELECT totp_secret FROM vault_secrets WHERE name = $1',
        [secretName],
      ),
    );

    const totpSecret = totpResult.rows[0]?.totp_secret;
    if (!totpSecret) {
      return { status: 404, body: { error: 'No TOTP secret configured for this credential' } };
    }

    const result = generateTOTP(totpSecret);

    appendVaultAuditEntry({
      timestamp: new Date().toISOString(),
      agentId: clientId,
      secretName,
      action: 'access',
      result: 'success',
      purpose: 'gateway-totp',
    });

    return { status: 200, body: result };
  }

  // GET /vault/pending-approvals
  if (method === 'GET' && path === '/vault/pending-approvals') {
    return { status: 200, body: bridge.listPendingApprovals() };
  }

  return { status: 404, body: { error: 'Not found' } };
}

// ─── Registration Helper ────────────────────────────────────────

/**
 * Register vault routes with the gateway client.
 * Call this during app initialization after VaultBridge is created.
 */
export function registerVaultGatewayRoutes(
  gatewayClient: { on: (event: string, handler: (payload: unknown) => void) => void },
  vaultBridge: VaultBridge,
): void {
  const handler = createVaultGatewayHandler(vaultBridge);

  gatewayClient.on('vault.request', async (payload: unknown) => {
    const req = payload as GatewayRequest;
    const response = await handler(req);
    // Response is sent back through the gateway's response mechanism
    log.info(`Gateway vault request: ${req.method} ${req.path} → ${response.status}`);
  });

  log.info('Vault gateway routes registered');
}
