import React from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type DeployStatus = 'success' | 'building' | 'failed' | 'cancelled';

interface DeployCardProps {
  environment: string;
  status: DeployStatus;
  commitHash: string;
  message: string;
  deployedAt: string;
  branch: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusStyle(status: DeployStatus): { color: string; bg: string; label: string; dot: string } {
  switch (status) {
    case 'success':
      return { color: '#6bffa0', bg: 'rgba(31,94,45,0.2)', label: 'Deployed', dot: '#6bffa0' };
    case 'building':
      return { color: '#ffb86b', bg: 'rgba(94,61,31,0.2)', label: 'Building', dot: '#ffb86b' };
    case 'failed':
      return { color: '#ff6b6b', bg: 'rgba(94,31,31,0.2)', label: 'Failed', dot: '#ff6b6b' };
    case 'cancelled':
      return { color: 'var(--text-muted)', bg: 'transparent', label: 'Cancelled', dot: 'var(--text-muted)' };
  }
}

function getEnvStyle(env: string): { color: string; bg: string } {
  switch (env.toLowerCase()) {
    case 'production':
      return { color: '#c99bff', bg: 'rgba(61,31,94,0.3)' };
    case 'staging':
      return { color: '#6bb8ff', bg: 'rgba(31,61,94,0.3)' };
    default:
      return { color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)' };
  }
}

// ─── DeployCard ───────────────────────────────────────────────────────────────

export function DeployCard({ environment, status, commitHash, message, deployedAt, branch }: DeployCardProps) {
  const statusStyle = getStatusStyle(status);
  const envStyle = getEnvStyle(environment);

  return (
    <div
      style={{
        background: 'var(--bg-card, #161624)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      {/* Status indicator dot */}
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: statusStyle.dot,
          flexShrink: 0,
          boxShadow: status === 'building' ? `0 0 6px ${statusStyle.dot}` : undefined,
          animation: status === 'building' ? 'pulse 1.5s ease-in-out infinite' : undefined,
        }}
      />

      {/* Environment badge */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: envStyle.color,
          background: envStyle.bg,
          borderRadius: 5,
          padding: '2px 8px',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {environment}
      </div>

      {/* Commit + message */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: 2,
          }}
        >
          {message}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
          <span style={{ fontFamily: 'monospace', background: 'var(--border)', borderRadius: 3, padding: '0px 4px' }}>
            {commitHash}
          </span>
          <span>{branch}</span>
        </div>
      </div>

      {/* Time */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {deployedAt}
      </div>

      {/* Status label */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: statusStyle.color,
          background: statusStyle.bg,
          borderRadius: 5,
          padding: '2px 8px',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {statusStyle.label}
      </div>
    </div>
  );
}
