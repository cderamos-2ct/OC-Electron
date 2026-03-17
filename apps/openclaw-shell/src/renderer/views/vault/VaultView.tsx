import React, { useState, useEffect, useCallback } from 'react';
import { invoke, on } from '../../lib/ipc-client';
import type {
  VaultStatus,
  VaultSecretMeta,
  VaultAuditEntry,
  PendingVaultApproval,
  VaultConnectionState,
} from '../../../shared/types';

// ─── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  bg:       'var(--bg, #0f172a)',
  bgMid:    'var(--bg-mid, #131d33)',
  bgCard:   'var(--bg-card, #131d33)',
  border:   'var(--border, rgba(241,245,249,0.14))',
  border2:  'rgba(241,245,249,0.08)',
  text:     'var(--text, #f1f5f9)',
  text2:    'var(--text-2, #cbd5e1)',
  muted:    'var(--muted, #94a3b8)',
  accent:   'var(--accent, #a3862a)',
  accentBg: 'rgba(163,134,42,0.2)',
  green:    '#2ecc71',
  yellow:   '#e0c875',
  red:      '#e74c3c',
};

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterId = 'all' | 'active' | 'inactive';

type AuditActionStatus = 'success' | 'denied' | 'error';

const AUDIT_STATUS_COLOR: Record<AuditActionStatus, string> = {
  success: C.green,
  denied:  C.red,
  error:   C.yellow,
};

// ─── SecretCard ───────────────────────────────────────────────────────────────

function SecretCard({ item }: { item: VaultSecretMeta }) {
  const isActive = item.hasActiveLease;
  const lastUpdated = item.updatedAt
    ? new Date(item.updatedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
    : 'Never';

  return (
    <div
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: C.text, minWidth: 0 }}>
          <span style={{ fontSize: 15, flexShrink: 0 }}>🔑</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 20,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.5px',
            background: isActive ? 'rgba(46,204,113,0.15)' : 'rgba(148,163,184,0.1)',
            color: isActive ? C.green : C.muted,
            flexShrink: 0,
            whiteSpace: 'nowrap' as const,
          }}
        >
          {isActive ? 'Active Lease' : 'No Lease'}
        </span>
      </div>

      {/* Folder */}
      {item.folder && (
        <div style={{ fontSize: 11, color: C.muted }}>
          📁 {item.folder}
        </div>
      )}

      {/* Value placeholder */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontFamily: "'SF Mono', 'Menlo', 'Consolas', monospace",
          color: C.muted,
          background: C.bg,
          borderRadius: 6,
          padding: '6px 10px',
          minHeight: 28,
          letterSpacing: 2,
        }}
      >
        ••••••••••••••••
      </div>

      {/* Last updated */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.muted }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: isActive ? C.green : C.muted,
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        <span>Updated: {lastUpdated}</span>
      </div>
    </div>
  );
}

// ─── PendingApprovalCard ──────────────────────────────────────────────────────

interface PendingApprovalCardProps {
  approval: PendingVaultApproval;
  onDecide: (id: string, decision: 'approved' | 'denied') => void;
  onDismiss: () => void;
}

function PendingApprovalCard({ approval, onDecide, onDismiss }: PendingApprovalCardProps) {
  return (
    <div
      style={{
        background: C.accentBg,
        border: `1px solid ${C.accent}`,
        borderRadius: 12,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: C.yellow }}>
          <span>⏳</span>
          <span>Pending Approval</span>
        </div>
        <button
          onClick={onDismiss}
          style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 4px' }}
        >
          ×
        </button>
      </div>

      <div style={{ fontSize: 14, color: C.text }}>
        <span style={{ fontWeight: 600 }}>{approval.agentId}</span>
        <span style={{ color: C.muted }}> requesting </span>
        <span style={{ fontWeight: 600, color: C.yellow }}>"{approval.secretName}"</span>
      </div>

      {approval.purpose && (
        <div style={{ fontSize: 12, color: C.text2, fontStyle: 'italic' as const, borderLeft: `2px solid ${C.accent}`, paddingLeft: 10 }}>
          "{approval.purpose}"
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div
          style={{
            background: 'rgba(163,134,42,0.12)',
            border: `1px solid rgba(163,134,42,0.3)`,
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12,
            color: C.text2,
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
            flex: 1,
          }}
        >
          <span style={{ flexShrink: 0 }}>⚖️</span>
          <span>
            <span style={{ fontWeight: 700, color: C.yellow }}>Themis: </span>
            Review this access request carefully before approving.
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
        <button
          onClick={() => onDecide(approval.id, 'approved')}
          style={{
            padding: '7px 18px', fontSize: 12, fontWeight: 700,
            borderRadius: 6, border: 'none',
            background: C.green, color: '#fff', cursor: 'pointer',
          }}
        >
          Approve
        </button>
        <button
          onClick={() => onDecide(approval.id, 'denied')}
          style={{
            padding: '7px 18px', fontSize: 12, fontWeight: 700,
            borderRadius: 6, border: 'none',
            background: C.red, color: '#fff', cursor: 'pointer',
          }}
        >
          Deny
        </button>
      </div>
    </div>
  );
}

// ─── AuditLogTable ────────────────────────────────────────────────────────────

function AuditLogTable({ entries }: { entries: VaultAuditEntry[] }) {
  return (
    <div
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: `1px solid ${C.border2}`,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Access Log</span>
        <span style={{ fontSize: 11, color: C.accent, cursor: 'pointer', fontWeight: 600 }}>View all →</span>
      </div>

      {entries.length === 0 ? (
        <div style={{ padding: '24px 18px', fontSize: 13, color: C.muted, textAlign: 'center' }}>
          No audit log entries yet.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
          <thead>
            <tr style={{ background: C.bg }}>
              {['Time', 'Agent', 'Secret', 'Action', 'Status'].map(col => (
                <th
                  key={col}
                  style={{
                    padding: '8px 18px',
                    textAlign: 'left' as const,
                    fontSize: 10,
                    fontWeight: 700,
                    color: C.muted,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.6px',
                    whiteSpace: 'nowrap' as const,
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((row, i) => {
              const ts = new Date(row.timestamp).toLocaleTimeString(undefined, { timeStyle: 'short' });
              const statusColor = AUDIT_STATUS_COLOR[row.result] ?? C.muted;
              return (
                <tr
                  key={i}
                  style={{
                    borderTop: `1px solid ${C.border2}`,
                    background: i % 2 === 0 ? 'transparent' : 'rgba(241,245,249,0.015)',
                  }}
                >
                  <td style={{ padding: '10px 18px', fontSize: 11, color: C.muted, whiteSpace: 'nowrap' as const, fontFamily: "'SF Mono', monospace" }}>
                    {ts}
                  </td>
                  <td style={{ padding: '10px 18px', fontSize: 12, color: C.text2, whiteSpace: 'nowrap' as const }}>
                    {row.agentId}
                  </td>
                  <td style={{ padding: '10px 18px', fontSize: 12, color: C.text, whiteSpace: 'nowrap' as const }}>
                    {row.secretName}
                  </td>
                  <td style={{ padding: '10px 18px', fontSize: 12, color: C.muted, whiteSpace: 'nowrap' as const }}>
                    {row.action}
                  </td>
                  <td style={{ padding: '10px 18px', whiteSpace: 'nowrap' as const }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: statusColor }}>
                      {row.result.charAt(0).toUpperCase() + row.result.slice(1)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── VaultStatusBar ───────────────────────────────────────────────────────────

function VaultStatusBar({ status }: { status: VaultStatus | null }) {
  const stateColor = status?.state === 'unlocked' ? C.green : status?.state === 'locked' ? C.yellow : C.muted;
  const stateLabel = status?.state ?? 'Disconnected';

  return (
    <div
      style={{
        position: 'absolute' as const,
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 20px',
        background: C.bgMid,
        borderTop: `1px solid ${C.border}`,
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      {/* Themis identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: C.accentBg,
            border: `1px solid ${C.accent}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
          }}
        >
          ⚖️
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Themis</div>
          <div style={{ fontSize: 10, color: C.muted }}>Vault Gatekeeper</div>
        </div>
      </div>

      {/* Summary */}
      <div style={{ fontSize: 11, color: C.muted, flex: 1 }}>
        {status
          ? `${status.activeLeases} active lease${status.activeLeases !== 1 ? 's' : ''} · ${status.pendingApprovals} pending · ${status.secretCount} secrets`
          : 'Connecting to vault...'}
        {' · '}
        <span style={{ color: stateColor, fontWeight: 600, textTransform: 'capitalize' }}>
          {stateLabel}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          style={{
            padding: '5px 12px', fontSize: 11, fontWeight: 600,
            border: `1px solid ${C.border}`, borderRadius: 6,
            background: 'transparent', color: C.text2, cursor: 'pointer',
          }}
        >
          Rotation Schedule
        </button>
        <button
          style={{
            padding: '5px 12px', fontSize: 11, fontWeight: 600,
            border: `1px solid ${C.border}`, borderRadius: 6,
            background: 'transparent', color: C.text2, cursor: 'pointer',
          }}
        >
          Access Policies
        </button>
        <button
          style={{
            padding: '5px 12px', fontSize: 11, fontWeight: 600,
            border: `1px solid rgba(231,76,60,0.4)`, borderRadius: 6,
            background: 'transparent', color: C.red, cursor: 'pointer',
          }}
          onClick={() => invoke('vault:revoke-all').catch(() => {})}
        >
          Emergency Revoke All
        </button>
      </div>
    </div>
  );
}

// ─── GatekeeperPrompt ─────────────────────────────────────────────────────────

function GatekeeperPrompt({ onUnlock }: { onUnlock: () => void }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '40px 24px',
        color: C.muted,
      }}
    >
      <div style={{ fontSize: 48 }}>⚖️</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Vault is Locked</div>
      <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', maxWidth: 280 }}>
        Themis is standing guard. Unlock the vault to access your secrets.
      </div>
      <button
        onClick={onUnlock}
        style={{
          padding: '10px 24px',
          fontSize: 13,
          fontWeight: 700,
          border: 'none',
          borderRadius: 8,
          background: C.accent,
          color: '#fff',
          cursor: 'pointer',
        }}
      >
        Unlock Vault
      </button>
    </div>
  );
}

// ─── Filter pills config ──────────────────────────────────────────────────────

const FILTER_PILLS: { id: FilterId; label: string }[] = [
  { id: 'all',      label: 'All' },
  { id: 'active',   label: 'Active Leases' },
  { id: 'inactive', label: 'Inactive' },
];

// ─── Main VaultView ───────────────────────────────────────────────────────────

export function VaultView() {
  const [loading, setLoading] = useState(true);
  const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null);
  const [secrets, setSecrets] = useState<VaultSecretMeta[]>([]);
  const [auditLog, setAuditLog] = useState<VaultAuditEntry[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingVaultApproval[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dismissedApprovals, setDismissedApprovals] = useState<Set<string>>(new Set());

  const loadVaultData = useCallback(async () => {
    try {
      const [statusRes, secretsRes, auditRes, approvalsRes] = await Promise.allSettled([
        invoke('vault:status'),
        invoke('vault:list-secrets'),
        invoke('vault:get-audit-log', 20),
        invoke('vault:pending-approvals'),
      ]);

      if (statusRes.status === 'fulfilled') setVaultStatus(statusRes.value as VaultStatus);
      if (secretsRes.status === 'fulfilled') setSecrets((secretsRes.value as VaultSecretMeta[]) ?? []);
      if (auditRes.status === 'fulfilled') setAuditLog((auditRes.value as VaultAuditEntry[]) ?? []);
      if (approvalsRes.status === 'fulfilled') setPendingApprovals((approvalsRes.value as PendingVaultApproval[]) ?? []);
    } catch {
      // vault may not be connected; show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVaultData();

    const unsub1 = on('vault:state', (state: VaultConnectionState) => {
      setVaultStatus(prev => prev ? { ...prev, state } : null);
      if (state === 'unlocked') loadVaultData();
    });

    const unsub2 = on('vault:approval-requested', (approval: PendingVaultApproval) => {
      setPendingApprovals(prev => [...prev.filter(a => a.id !== approval.id), approval]);
    });

    const unsub3 = on('vault:approval-resolved', ({ approvalId }: { approvalId: string; decision: 'approved' | 'denied' }) => {
      setPendingApprovals(prev => prev.filter(a => a.id !== approvalId));
    });

    const unsub4 = on('vault:lease-revoked', () => {
      loadVaultData();
    });

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [loadVaultData]);

  const handleDecideApproval = async (approvalId: string, decision: 'approved' | 'denied') => {
    try {
      await invoke('vault:decide-approval', approvalId, decision);
      setPendingApprovals(prev => prev.filter(a => a.id !== approvalId));
      loadVaultData();
    } catch {
      // handle silently
    }
  };

  const handleDismissApproval = (approvalId: string) => {
    setDismissedApprovals(prev => new Set([...prev, approvalId]));
  };

  const visibleApprovals = pendingApprovals.filter(a => !dismissedApprovals.has(a.id));

  const filteredSecrets = secrets.filter(s => {
    const matchesFilter =
      activeFilter === 'all' ||
      (activeFilter === 'active' && s.hasActiveLease) ||
      (activeFilter === 'inactive' && !s.hasActiveLease);
    const matchesSearch = !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const vaultLocked = vaultStatus?.state === 'locked';
  const vaultDisconnected = !vaultStatus || vaultStatus.state === 'disconnected' || vaultStatus.state === 'error';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: C.bg,
        color: C.text,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        overflow: 'hidden',
      }}
    >
      {/* ── TOP BAR ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 20px',
          borderBottom: `1px solid ${C.border}`,
          background: C.bgMid,
          flexShrink: 0,
          flexWrap: 'wrap' as const,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span>🔐</span>
          <span>Vault</span>
        </div>

        <input
          type="text"
          placeholder="Search secrets..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            flex: '1 1 160px',
            minWidth: 120,
            maxWidth: 240,
            padding: '6px 12px',
            fontSize: 12,
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            color: C.text,
            outline: 'none',
          }}
        />

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
          {FILTER_PILLS.map(pill => {
            const isActive = activeFilter === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setActiveFilter(pill.id)}
                style={{
                  padding: '4px 12px',
                  fontSize: 11,
                  fontWeight: isActive ? 700 : 500,
                  borderRadius: 20,
                  border: isActive ? `1px solid ${C.accent}` : `1px solid ${C.border}`,
                  background: isActive ? C.accentBg : 'transparent',
                  color: isActive ? C.yellow : C.muted,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap' as const,
                }}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        <button
          style={{
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 6,
            border: 'none',
            background: C.accent,
            color: '#fff',
            cursor: 'pointer',
            flexShrink: 0,
            whiteSpace: 'nowrap' as const,
          }}
        >
          + Add Secret
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.muted, marginLeft: 'auto', flexShrink: 0 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: vaultStatus?.state === 'unlocked' ? C.green : vaultStatus?.state === 'locked' ? C.yellow : C.muted,
              display: 'inline-block',
            }}
          />
          <span>
            {vaultStatus
              ? `${vaultStatus.state.charAt(0).toUpperCase() + vaultStatus.state.slice(1)} · ${vaultStatus.serverUrl || 'vault.local'}`
              : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* ── SCROLLABLE BODY ── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto' as const,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          paddingBottom: 80,
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, paddingTop: 60 }}>
            <div style={{ fontSize: 13, color: C.muted }}>Loading vault...</div>
          </div>
        ) : vaultDisconnected ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              paddingTop: 60,
              gap: 16,
            }}
          >
            <div style={{ fontSize: 40 }}>🔌</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text2 }}>Vault Disconnected</div>
            <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', maxWidth: 280 }}>
              Unable to connect to Vaultwarden. Check your vault configuration.
            </div>
            <button
              onClick={loadVaultData}
              style={{
                padding: '8px 20px', fontSize: 12, fontWeight: 600,
                border: `1px solid ${C.border}`, borderRadius: 7,
                background: 'transparent', color: C.text2, cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        ) : vaultLocked ? (
          <GatekeeperPrompt onUnlock={loadVaultData} />
        ) : (
          <>
            {/* Pending approvals */}
            {visibleApprovals.map(approval => (
              <PendingApprovalCard
                key={approval.id}
                approval={approval}
                onDecide={handleDecideApproval}
                onDismiss={() => handleDismissApproval(approval.id)}
              />
            ))}

            {/* Secret grid */}
            <div>
              {filteredSecrets.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '48px 24px',
                    gap: 12,
                    color: C.muted,
                    background: C.bgCard,
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
                  }}
                >
                  <div style={{ fontSize: 32 }}>🔐</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text2 }}>
                    {searchQuery || activeFilter !== 'all' ? 'No secrets match your filter' : 'Vault is empty'}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, textAlign: 'center', maxWidth: 240 }}>
                    {searchQuery || activeFilter !== 'all'
                      ? 'Try adjusting your search or filter.'
                      : 'Add your first secret to get started.'}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: 14,
                  }}
                >
                  {filteredSecrets.map(item => (
                    <SecretCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>

            {/* Audit log */}
            <AuditLogTable entries={auditLog} />
          </>
        )}
      </div>

      {/* ── AGENT TOOLBAR (fixed bottom) ── */}
      <VaultStatusBar status={vaultStatus} />
    </div>
  );
}
