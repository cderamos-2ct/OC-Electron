import React from 'react';
import type { VaultSecretMeta } from '../../../shared/types.js';

interface SecretCardProps {
  secret: VaultSecretMeta;
}

export function SecretCard({ secret }: SecretCardProps) {
  const daysSinceRotation = secret.lastRotatedAt
    ? Math.floor((Date.now() - new Date(secret.lastRotatedAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const rotationWarning = daysSinceRotation !== null && daysSinceRotation > 90;

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card, var(--bg-tertiary))',
        border: '1px solid var(--border-default)',
        borderRadius: '10px',
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
      }}
    >
      {/* Secret icon */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '8px',
          background: 'var(--bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          flexShrink: 0,
        }}
      >
        🔑
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {secret.name}
        </div>
        <div
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginTop: '2px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {secret.folder || '/'}
        </div>
      </div>

      {/* Badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        {secret.hasActiveLease && (
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              color: '#22c55e',
              background: '#22c55e18',
              border: '1px solid #22c55e40',
              borderRadius: '4px',
              padding: '2px 6px',
            }}
          >
            ACTIVE LEASE
          </span>
        )}
        {rotationWarning && (
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              color: '#f59e0b',
              background: '#f59e0b18',
              border: '1px solid #f59e0b40',
              borderRadius: '4px',
              padding: '2px 6px',
            }}
          >
            ROTATE ({daysSinceRotation}d)
          </span>
        )}
        {!rotationWarning && daysSinceRotation !== null && (
          <span
            style={{
              fontSize: '10px',
              color: 'var(--text-muted)',
            }}
          >
            {daysSinceRotation}d ago
          </span>
        )}
        {secret.lastRotatedAt === null && (
          <span
            style={{
              fontSize: '10px',
              color: 'var(--text-muted)',
            }}
          >
            never rotated
          </span>
        )}
      </div>
    </div>
  );
}
