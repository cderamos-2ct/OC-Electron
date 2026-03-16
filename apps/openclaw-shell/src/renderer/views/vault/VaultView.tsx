import React, { useState } from 'react';

// ─── CSS Variable tokens ───────────────────────────────────────────────────────
const C = {
  bg:        '#0f172a',
  bgMid:     '#131d33',
  bgCard:    '#131d33',
  border:    'rgba(241,245,249,0.14)',
  border2:   'rgba(241,245,249,0.08)',
  text:      '#f1f5f9',
  text2:     '#cbd5e1',
  muted:     '#94a3b8',
  accent:    '#a3862a',
  accentBg:  'rgba(163,134,42,0.2)',
  green:     '#2ecc71',
  yellow:    '#e0c875',
  red:       '#e74c3c',
};

// ─── Types ────────────────────────────────────────────────────────────────────
type FilterId = 'all' | 'api' | 'pass' | 'token' | 'cert' | 'ssh';
type Category = 'api' | 'token' | 'pass' | 'ssh' | 'cert';
type LeaseState = 'active' | 'dormant';
type LogStatus = 'approved' | 'auto-approved' | 'pending' | 'revoked' | 'denied';

interface SecretItem {
  name: string;
  category: Category;
  valueLabel: string;
  valueMasked: string;
  valueRevealed: string;
  lease: LeaseState;
  lastAccess: string;
}

interface LogRow {
  time: string;
  agent: string;
  secret: string;
  action: string;
  status: LogStatus;
  statusText: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const SECRETS: SecretItem[] = [
  { name: 'Gmail API OAuth',       category: 'api',   valueLabel: 'key:',   valueMasked: '••••••••••••••••', valueRevealed: 'AIzaSyD-xxxxxxxxxxxxxxxxxxxxxxx',                    lease: 'active',  lastAccess: '🌹 Karoline, 2 min ago' },
  { name: 'GitHub PAT (aegilume)', category: 'token', valueLabel: 'token:', valueMasked: '••••••••••••••••', valueRevealed: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',              lease: 'active',  lastAccess: '🔥 Vulcan, 14 min ago' },
  { name: 'Supabase Service Key',  category: 'api',   valueLabel: 'key:',   valueMasked: '••••••••••••••••', valueRevealed: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx',       lease: 'dormant', lastAccess: 'CD, 1 hr ago' },
  { name: 'iMessage Bridge Auth',  category: 'token', valueLabel: 'token:', valueMasked: '••••••••••••••••', valueRevealed: 'imsg_tok_xxxxxxxxxxxxxxxxxxxxxxx',                   lease: 'active',  lastAccess: '🌈 Iris, 8 min ago' },
  { name: 'Twilio VOIP SID',       category: 'api',   valueLabel: 'sid:',   valueMasked: '••••••••••••••••', valueRevealed: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',                 lease: 'dormant', lastAccess: '📡 Hermes, 3 hr ago' },
  { name: 'OpenAI API Key',        category: 'api',   valueLabel: 'key:',   valueMasked: '••••••••••••••••', valueRevealed: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',         lease: 'active',  lastAccess: '🔮 Socrates, 22 min ago' },
  { name: 'Slack Bot Token',       category: 'token', valueLabel: 'token:', valueMasked: '••••••••••••••••', valueRevealed: 'xoxb-xxxxxxxx-xxxxxxxx-xxxxxxxxxxxxxxxx',           lease: 'dormant', lastAccess: '🌹 Karoline, 45 min ago' },
  { name: 'Linear API Key',        category: 'api',   valueLabel: 'key:',   valueMasked: '••••••••••••••••', valueRevealed: 'lin_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',           lease: 'dormant', lastAccess: 'Never accessed' },
  { name: 'SSH Deploy Key (prod)', category: 'ssh',   valueLabel: 'key:',   valueMasked: '••••••••••••••••', valueRevealed: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5xxx...',            lease: 'dormant', lastAccess: '🔥 Vulcan, 2 days ago' },
  { name: 'Anthropic API Key',     category: 'api',   valueLabel: 'key:',   valueMasked: '••••••••••••••••', valueRevealed: 'sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',      lease: 'active',  lastAccess: 'CD, 5 min ago' },
];

const LOG_ROWS: LogRow[] = [
  { time: '9:18 AM', agent: '🌹 Karoline', secret: 'Gmail API OAuth',   action: 'Lease renewed', status: 'approved',      statusText: 'Approved' },
  { time: '9:16 AM', agent: '🔮 Socrates', secret: 'OpenAI API Key',    action: 'New lease',     status: 'auto-approved', statusText: 'Auto-approved' },
  { time: '9:14 AM', agent: '🔥 Vulcan',   secret: 'GitHub PAT',        action: 'Lease renewed', status: 'approved',      statusText: 'Approved' },
  { time: '9:10 AM', agent: '🌈 Iris',     secret: 'iMessage Bridge',   action: 'New lease',     status: 'auto-approved', statusText: 'Auto-approved' },
  { time: '9:02 AM', agent: '📡 Hermes',   secret: 'Stripe Secret Key', action: 'Requested',     status: 'pending',       statusText: 'Pending' },
  { time: '8:55 AM', agent: '🌹 Karoline', secret: 'Slack Bot Token',   action: 'Lease expired', status: 'revoked',       statusText: 'Revoked' },
  { time: '8:41 AM', agent: '🧪 Hypatia',  secret: 'Prod DB Creds',     action: 'Access denied', status: 'denied',        statusText: 'Denied' },
];

// ─── Category pill config ─────────────────────────────────────────────────────
const CAT_PILL: Record<Category, { bg: string; color: string; label: string }> = {
  api:   { bg: '#1f2d5e', color: '#6bb8ff', label: 'API Key' },
  token: { bg: '#3d1f5e', color: '#b88aff', label: 'Token' },
  pass:  { bg: 'rgba(46,204,113,0.15)', color: '#2ecc71', label: 'Password' },
  ssh:   { bg: '#5e3d1f', color: '#ffb86b', label: 'SSH Key' },
  cert:  { bg: 'rgba(192,132,252,0.12)', color: '#c084fc', label: 'Certificate' },
};

const LOG_STATUS_COLOR: Record<LogStatus, string> = {
  'approved':      C.green,
  'auto-approved': C.green,
  'pending':       C.yellow,
  'revoked':       C.muted,
  'denied':        C.red,
};

const FILTER_PILLS: { id: FilterId; label: string }[] = [
  { id: 'all',   label: 'All' },
  { id: 'api',   label: 'API Keys' },
  { id: 'pass',  label: 'Passwords' },
  { id: 'token', label: 'Tokens' },
  { id: 'cert',  label: 'Certificates' },
  { id: 'ssh',   label: 'SSH Keys' },
];

// ─── SecretCard (inlined) ──────────────────────────────────────────────────────
function SecretCard({ item }: { item: SecretItem }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const cat = CAT_PILL[item.category];
  const isActive = item.lease === 'active';

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: '10px',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', fontWeight: 600, color: C.text, minWidth: 0 }}>
          <span style={{ fontSize: '15px', flexShrink: 0 }}>🔑</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
        </div>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '20px',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.5px',
            background: cat.bg,
            color: cat.color,
            flexShrink: 0,
            whiteSpace: 'nowrap' as const,
          }}
        >
          {cat.label}
        </span>
      </div>

      {/* Value row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px',
          fontFamily: "'SF Mono', 'Menlo', 'Consolas', monospace",
          color: C.muted,
          background: C.bg,
          borderRadius: '6px',
          padding: '6px 10px',
          minHeight: '28px',
        }}
      >
        <span style={{ color: 'rgba(241,245,249,0.35)', fontSize: '11px' }}>{item.valueLabel}</span>
        {revealed ? (
          <span style={{ color: '#6bb8ff', wordBreak: 'break-all' as const, fontSize: '11px', flex: 1 }}>{item.valueRevealed}</span>
        ) : (
          <span style={{ letterSpacing: '2px', flex: 1 }}>{item.valueMasked}</span>
        )}
      </div>

      {/* Last access row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: C.muted }}>
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: isActive ? C.green : C.muted,
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        <span>Last: {item.lastAccess}</span>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={handleCopy}
          style={{
            flex: 1,
            padding: '5px 10px',
            fontSize: '11px',
            fontWeight: 600,
            border: `1px solid ${C.border}`,
            borderRadius: '6px',
            background: 'transparent',
            color: copied ? C.green : C.text2,
            cursor: 'pointer',
            transition: 'color 0.15s',
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button
          onClick={() => setRevealed(r => !r)}
          style={{
            flex: 1,
            padding: '5px 10px',
            fontSize: '11px',
            fontWeight: 600,
            border: `1px solid ${C.border}`,
            borderRadius: '6px',
            background: 'transparent',
            color: revealed ? C.yellow : C.text2,
            cursor: 'pointer',
            transition: 'color 0.15s',
          }}
        >
          {revealed ? 'Hide' : 'Reveal'}
        </button>
      </div>
    </div>
  );
}

// ─── Main VaultView ────────────────────────────────────────────────────────────
export function VaultView() {
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const [showApproval, setShowApproval] = useState(true);

  const filteredSecrets = activeFilter === 'all'
    ? SECRETS
    : SECRETS.filter(s => s.category === activeFilter);

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
          gap: '12px',
          padding: '14px 20px',
          borderBottom: `1px solid ${C.border}`,
          background: C.bgMid,
          flexShrink: 0,
          flexWrap: 'wrap' as const,
        }}
      >
        {/* Title */}
        <div style={{ fontSize: '16px', fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <span>🔐</span>
          <span>Vault</span>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search secrets..."
          style={{
            flex: '1 1 160px',
            minWidth: '120px',
            maxWidth: '240px',
            padding: '6px 12px',
            fontSize: '12px',
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: '6px',
            color: C.text,
            outline: 'none',
          }}
        />

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
          {FILTER_PILLS.map(pill => {
            const isActive = activeFilter === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setActiveFilter(pill.id)}
                style={{
                  padding: '4px 12px',
                  fontSize: '11px',
                  fontWeight: isActive ? 700 : 500,
                  borderRadius: '20px',
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

        {/* Add Secret button */}
        <button
          style={{
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: 700,
            borderRadius: '6px',
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

        {/* Connection status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: C.muted, marginLeft: 'auto', flexShrink: 0 }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: C.green, display: 'inline-block' }} />
          <span>Vaultwarden · Connected · vault.aegilume.local</span>
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
          gap: '24px',
          paddingBottom: '80px',
        }}
      >
        {/* ── PENDING APPROVAL CARD ── */}
        {showApproval && (
          <div
            style={{
              background: C.accentBg,
              border: `1px solid ${C.accent}`,
              borderRadius: '12px',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Label row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: C.yellow }}>
                <span>⏳</span>
                <span>Pending Approval</span>
              </div>
              <button
                onClick={() => setShowApproval(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: C.muted,
                  cursor: 'pointer',
                  fontSize: '16px',
                  lineHeight: 1,
                  padding: '0 4px',
                }}
              >
                ×
              </button>
            </div>

            {/* Agent + secret */}
            <div style={{ fontSize: '14px', color: C.text }}>
              <span style={{ fontWeight: 600 }}>📡 Hermes</span>
              <span style={{ color: C.muted }}> requesting </span>
              <span style={{ fontWeight: 600, color: C.yellow }}>"Stripe Secret Key"</span>
            </div>

            {/* Reason */}
            <div style={{ fontSize: '12px', color: C.text2, fontStyle: 'italic' as const, borderLeft: `2px solid ${C.accent}`, paddingLeft: '10px' }}>
              "Need to verify pending invoice payment for Q1 reconciliation"
            </div>

            {/* Meta */}
            <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: C.muted, flexWrap: 'wrap' as const }}>
              <span>🔒 Read-only</span>
              <span>⏱ 30-minute lease</span>
              <span>Finance lane</span>
            </div>

            {/* Themis note */}
            <div
              style={{
                background: 'rgba(163,134,42,0.12)',
                border: `1px solid rgba(163,134,42,0.3)`,
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12px',
                color: C.text2,
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-start',
              }}
            >
              <span style={{ flexShrink: 0 }}>⚖️</span>
              <span>
                <span style={{ fontWeight: 700, color: C.yellow }}>Themis: </span>
                Approve — Hermes has finance-lane clearance for read operations.
              </span>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
              <button
                style={{
                  padding: '7px 18px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: 'none',
                  background: C.green,
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Approve
              </button>
              <button
                style={{
                  padding: '7px 18px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: 'none',
                  background: C.red,
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Deny
              </button>
              <button
                style={{
                  padding: '7px 18px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: `1px solid ${C.border}`,
                  background: 'transparent',
                  color: C.text2,
                  cursor: 'pointer',
                }}
              >
                Approve with conditions
              </button>
            </div>
          </div>
        )}

        {/* ── SECRET GRID ── */}
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '14px',
            }}
          >
            {filteredSecrets.map(item => (
              <SecretCard key={item.name} item={item} />
            ))}
          </div>
        </div>

        {/* ── ACCESS LOG TABLE ── */}
        <div
          style={{
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              borderBottom: `1px solid ${C.border2}`,
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>Access Log</span>
            <span style={{ fontSize: '11px', color: C.accent, cursor: 'pointer', fontWeight: 600 }}>View all →</span>
          </div>

          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {['Time', 'Agent', 'Secret', 'Action', 'Status'].map(col => (
                  <th
                    key={col}
                    style={{
                      padding: '8px 18px',
                      textAlign: 'left' as const,
                      fontSize: '10px',
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
              {LOG_ROWS.map((row, i) => (
                <tr
                  key={i}
                  style={{
                    borderTop: `1px solid ${C.border2}`,
                    background: i % 2 === 0 ? 'transparent' : 'rgba(241,245,249,0.015)',
                  }}
                >
                  <td style={{ padding: '10px 18px', fontSize: '11px', color: C.muted, whiteSpace: 'nowrap' as const, fontFamily: "'SF Mono', monospace" }}>
                    {row.time}
                  </td>
                  <td style={{ padding: '10px 18px', fontSize: '12px', color: C.text2, whiteSpace: 'nowrap' as const }}>
                    {row.agent}
                  </td>
                  <td style={{ padding: '10px 18px', fontSize: '12px', color: C.text, whiteSpace: 'nowrap' as const }}>
                    {row.secret}
                  </td>
                  <td style={{ padding: '10px 18px', fontSize: '12px', color: C.muted, whiteSpace: 'nowrap' as const }}>
                    {row.action}
                  </td>
                  <td style={{ padding: '10px 18px', whiteSpace: 'nowrap' as const }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: LOG_STATUS_COLOR[row.status],
                      }}
                    >
                      {row.statusText}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── AGENT TOOLBAR (fixed bottom) ── */}
      <div
        style={{
          position: 'absolute' as const,
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          padding: '10px 20px',
          background: C.bgMid,
          borderTop: `1px solid ${C.border}`,
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        {/* Avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: C.accentBg,
              border: `1px solid ${C.accent}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
            }}
          >
            ⚖️
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: C.text }}>Themis</div>
            <div style={{ fontSize: '10px', color: C.muted }}>Vault Gatekeeper</div>
          </div>
        </div>

        {/* Summary */}
        <div style={{ fontSize: '11px', color: C.muted, flex: 1 }}>
          4 active leases · 1 pending · 0 violations
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button
            style={{
              padding: '5px 12px',
              fontSize: '11px',
              fontWeight: 600,
              border: `1px solid ${C.border}`,
              borderRadius: '6px',
              background: 'transparent',
              color: C.text2,
              cursor: 'pointer',
            }}
          >
            Rotation Schedule
          </button>
          <button
            style={{
              padding: '5px 12px',
              fontSize: '11px',
              fontWeight: 600,
              border: `1px solid ${C.border}`,
              borderRadius: '6px',
              background: 'transparent',
              color: C.text2,
              cursor: 'pointer',
            }}
          >
            Access Policies
          </button>
          <button
            style={{
              padding: '5px 12px',
              fontSize: '11px',
              fontWeight: 600,
              border: `1px solid rgba(231,76,60,0.4)`,
              borderRadius: '6px',
              background: 'transparent',
              color: C.red,
              cursor: 'pointer',
            }}
          >
            Emergency Revoke All
          </button>
        </div>
      </div>
    </div>
  );
}
