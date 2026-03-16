import React from 'react';
import type { VaultAuditEntry } from '../../../shared/types.js';

interface AuditLogTableProps {
  entries: VaultAuditEntry[];
}

const ACTION_ICONS: Record<string, string> = {
  access: '👁',
  create: '✨',
  update: '✏️',
  delete: '🗑',
  rotate: '🔄',
  revoke: '🚫',
  denied: '⛔',
};

function resultStyle(result: VaultAuditEntry['result']): React.CSSProperties {
  switch (result) {
    case 'success':
      return { color: '#22c55e' };
    case 'denied':
      return { color: '#ef4444' };
    case 'error':
      return { color: '#f59e0b' };
    default:
      return { color: '#6b7280' };
  }
}

export function AuditLogTable({ entries }: AuditLogTableProps) {
  if (entries.length === 0) {
    return (
      <div
        style={{
          padding: '48px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '13px',
        }}
      >
        No audit log entries
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '12px',
        }}
      >
        <thead>
          <tr
            style={{
              background: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--border-default)',
            }}
          >
            {['Timestamp', 'Agent', 'Secret', 'Action', 'Result'].map((col) => (
              <th
                key={col}
                style={{
                  padding: '10px 14px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => (
            <tr
              key={`${entry.timestamp}-${i}`}
              style={{
                background: i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-subtle, var(--border-default))',
              }}
            >
              <td style={{ padding: '10px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {new Date(entry.timestamp).toLocaleString()}
              </td>
              <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {entry.agentId}
              </td>
              <td
                style={{
                  padding: '10px 14px',
                  color: 'var(--text-primary)',
                  maxWidth: '200px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {entry.secretName}
              </td>
              <td style={{ padding: '10px 14px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span>{ACTION_ICONS[entry.action] ?? '•'}</span>
                  <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                    {entry.action}
                  </span>
                </span>
              </td>
              <td style={{ padding: '10px 14px' }}>
                <span style={{ ...resultStyle(entry.result), fontWeight: 600, textTransform: 'capitalize' }}>
                  {entry.result}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
