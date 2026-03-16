import React, { useState } from 'react';
import type {
  VaultSecretMeta,
  VaultPolicy,
  VaultAuditEntry,
  PendingVaultApproval,
  VaultStatus,
} from '../../../shared/types.js';
import { VaultStatusBar } from './VaultStatusBar';
import { SecretCard } from './SecretCard';
import { PendingApprovalCard } from './PendingApprovalCard';
import { AuditLogTable } from './AuditLogTable';
import { GatekeeperPrompt } from './GatekeeperPrompt';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_STATUS: VaultStatus = {
  state: 'unlocked',
  serverUrl: 'https://vault.aegilume.internal',
  secretCount: 24,
  activeLeases: 3,
  pendingApprovals: 2,
  lastSyncAt: new Date(Date.now() - 120_000).toISOString(),
};

const MOCK_SECRETS: VaultSecretMeta[] = [
  {
    id: 'sec-1',
    name: 'OPENAI_API_KEY',
    folder: '/ai-providers',
    lastRotatedAt: new Date(Date.now() - 7 * 86400_000).toISOString(),
    createdAt: new Date(Date.now() - 90 * 86400_000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 86400_000).toISOString(),
    hasActiveLease: true,
  },
  {
    id: 'sec-2',
    name: 'ANTHROPIC_API_KEY',
    folder: '/ai-providers',
    lastRotatedAt: new Date(Date.now() - 3 * 86400_000).toISOString(),
    createdAt: new Date(Date.now() - 60 * 86400_000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400_000).toISOString(),
    hasActiveLease: true,
  },
  {
    id: 'sec-3',
    name: 'GOOGLE_CLIENT_SECRET',
    folder: '/google',
    lastRotatedAt: new Date(Date.now() - 95 * 86400_000).toISOString(),
    createdAt: new Date(Date.now() - 180 * 86400_000).toISOString(),
    updatedAt: new Date(Date.now() - 95 * 86400_000).toISOString(),
    hasActiveLease: false,
  },
  {
    id: 'sec-4',
    name: 'GITHUB_TOKEN',
    folder: '/integrations',
    lastRotatedAt: null,
    createdAt: new Date(Date.now() - 30 * 86400_000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 86400_000).toISOString(),
    hasActiveLease: false,
  },
  {
    id: 'sec-5',
    name: 'SLACK_BOT_TOKEN',
    folder: '/integrations',
    lastRotatedAt: new Date(Date.now() - 14 * 86400_000).toISOString(),
    createdAt: new Date(Date.now() - 45 * 86400_000).toISOString(),
    updatedAt: new Date(Date.now() - 14 * 86400_000).toISOString(),
    hasActiveLease: true,
  },
  {
    id: 'sec-6',
    name: 'DATABASE_URL',
    folder: '/infrastructure',
    lastRotatedAt: new Date(Date.now() - 120 * 86400_000).toISOString(),
    createdAt: new Date(Date.now() - 200 * 86400_000).toISOString(),
    updatedAt: new Date(Date.now() - 120 * 86400_000).toISOString(),
    hasActiveLease: false,
  },
];

const MOCK_POLICIES: VaultPolicy[] = [
  {
    id: 'pol-1',
    agentId: 'finance-agent',
    secretPattern: '/ai-providers/*',
    action: 'auto-approve',
    maxLeaseTTL: 3600,
    createdAt: new Date(Date.now() - 10 * 86400_000).toISOString(),
  },
  {
    id: 'pol-2',
    agentId: 'comms-agent',
    secretPattern: '/integrations/SLACK_*',
    action: 'auto-approve',
    maxLeaseTTL: 1800,
    createdAt: new Date(Date.now() - 5 * 86400_000).toISOString(),
  },
  {
    id: 'pol-3',
    agentId: '*',
    secretPattern: '/infrastructure/*',
    action: 'require-approval',
    maxLeaseTTL: 900,
    createdAt: new Date(Date.now() - 20 * 86400_000).toISOString(),
  },
];

const MOCK_AUDIT: VaultAuditEntry[] = [
  {
    timestamp: new Date(Date.now() - 60_000).toISOString(),
    agentId: 'finance-agent',
    secretName: 'OPENAI_API_KEY',
    action: 'access',
    result: 'success',
    policyId: 'pol-1',
    purpose: 'LLM inference for budget analysis',
  },
  {
    timestamp: new Date(Date.now() - 300_000).toISOString(),
    agentId: 'ops-agent',
    secretName: 'DATABASE_URL',
    action: 'access',
    result: 'denied',
    error: 'Policy requires manual approval',
  },
  {
    timestamp: new Date(Date.now() - 900_000).toISOString(),
    agentId: 'comms-agent',
    secretName: 'SLACK_BOT_TOKEN',
    action: 'access',
    result: 'success',
    policyId: 'pol-2',
    purpose: 'Send daily summary notification',
  },
  {
    timestamp: new Date(Date.now() - 3600_000).toISOString(),
    agentId: 'build-agent',
    secretName: 'GITHUB_TOKEN',
    action: 'access',
    result: 'success',
    purpose: 'Trigger CI pipeline',
  },
  {
    timestamp: new Date(Date.now() - 7200_000).toISOString(),
    agentId: 'admin',
    secretName: 'GOOGLE_CLIENT_SECRET',
    action: 'rotate',
    result: 'success',
  },
];

const MOCK_PENDING: PendingVaultApproval[] = [
  {
    id: 'apv-1',
    agentId: 'ops-agent',
    secretName: 'DATABASE_URL',
    purpose: 'Run schema migration for new feature branch',
    requestedAt: new Date(Date.now() - 120_000).toISOString(),
  },
  {
    id: 'apv-2',
    agentId: 'research-agent',
    secretName: 'GOOGLE_CLIENT_SECRET',
    purpose: 'Authenticate Google Drive API for doc analysis',
    requestedAt: new Date(Date.now() - 45_000).toISOString(),
  },
];

// ─── Tab types ────────────────────────────────────────────────────────────────

type VaultTab = 'secrets' | 'policies' | 'audit' | 'pending';

const TABS: { id: VaultTab; label: string; count?: number }[] = [
  { id: 'secrets', label: 'Secrets' },
  { id: 'policies', label: 'Policies' },
  { id: 'audit', label: 'Audit Log' },
  { id: 'pending', label: 'Pending Approvals' },
];

// ─── Main VaultView ───────────────────────────────────────────────────────────

export function VaultView() {
  const [activeTab, setActiveTab] = useState<VaultTab>('secrets');
  const [pendingApprovals, setPendingApprovals] = useState<PendingVaultApproval[]>(MOCK_PENDING);
  const [gatekeeperApproval, setGatekeeperApproval] = useState<PendingVaultApproval | null>(null);

  const handleApprove = (id: string) => {
    setPendingApprovals((prev) => prev.filter((a) => a.id !== id));
  };

  const handleDeny = (id: string) => {
    setPendingApprovals((prev) => prev.filter((a) => a.id !== id));
  };

  const pendingCount = pendingApprovals.length;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      {/* Status bar */}
      <VaultStatusBar
        status={{ ...MOCK_STATUS, pendingApprovals: pendingCount }}
      />

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '32px 40px',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
              marginBottom: '4px',
            }}
          >
            🔐 Vault
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            Managed by Themis — secrets gatekeeper
          </p>
        </div>

        {/* Filter pill tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const badge = tab.id === 'pending' ? pendingCount : undefined;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '6px 16px',
                  borderRadius: '20px',
                  border: isActive
                    ? '1px solid var(--accent, #6366f1)'
                    : '1px solid var(--border-default)',
                  background: isActive ? 'var(--accent, #6366f1)20' : 'transparent',
                  color: isActive ? 'var(--accent, #6366f1)' : 'var(--text-secondary)',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.1s',
                }}
              >
                {tab.label}
                {badge !== undefined && badge > 0 && (
                  <span
                    style={{
                      background: '#f59e0b',
                      color: '#000',
                      borderRadius: '10px',
                      padding: '1px 6px',
                      fontSize: '10px',
                      fontWeight: 700,
                    }}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === 'secrets' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '12px',
            }}
          >
            {MOCK_SECRETS.map((secret) => (
              <SecretCard key={secret.id} secret={secret} />
            ))}
          </div>
        )}

        {activeTab === 'policies' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {MOCK_POLICIES.map((policy) => (
              <div
                key={policy.id}
                style={{
                  background: 'var(--bg-card, var(--bg-tertiary))',
                  border: '1px solid var(--border-default)',
                  borderRadius: '10px',
                  padding: '16px 18px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 120px 100px',
                  alignItems: 'center',
                  gap: '16px',
                  fontSize: '13px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{policy.agentId}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {new Date(policy.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <code
                    style={{
                      fontSize: '11px',
                      background: 'var(--bg-secondary)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {policy.secretPattern}
                  </code>
                </div>
                <div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: '4px',
                      ...(policy.action === 'auto-approve'
                        ? { color: '#22c55e', background: '#22c55e18', border: '1px solid #22c55e40' }
                        : { color: '#f59e0b', background: '#f59e0b18', border: '1px solid #f59e0b40' }),
                    }}
                  >
                    {policy.action === 'auto-approve' ? 'Auto-approve' : 'Require approval'}
                  </span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                  TTL: {policy.maxLeaseTTL}s
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'audit' && (
          <div
            style={{
              background: 'var(--bg-card, var(--bg-tertiary))',
              border: '1px solid var(--border-default)',
              borderRadius: '10px',
              overflow: 'hidden',
            }}
          >
            <AuditLogTable entries={MOCK_AUDIT} />
          </div>
        )}

        {activeTab === 'pending' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pendingApprovals.length === 0 ? (
              <div
                style={{
                  padding: '48px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                  background: 'var(--bg-card, var(--bg-tertiary))',
                  border: '1px solid var(--border-default)',
                  borderRadius: '10px',
                }}
              >
                No pending approvals
              </div>
            ) : (
              pendingApprovals.map((approval) => (
                <PendingApprovalCard
                  key={approval.id}
                  approval={approval}
                  onApprove={(id) => {
                    setGatekeeperApproval(approval);
                    // Also show gatekeeper prompt for high-risk
                    handleApprove(id);
                  }}
                  onDeny={handleDeny}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Gatekeeper modal */}
      {gatekeeperApproval && (
        <GatekeeperPrompt
          approval={gatekeeperApproval}
          onApprove={() => setGatekeeperApproval(null)}
          onDeny={() => setGatekeeperApproval(null)}
          onClose={() => setGatekeeperApproval(null)}
        />
      )}
    </div>
  );
}
