import React, { useState } from 'react';

interface DiffChunk {
  id: string;
  removed: string;
  added: string;
}

interface InlineDiffProps {
  chunks: DiffChunk[];
  onApplyAll: () => void;
}

export function InlineDiff({ chunks, onApplyAll }: InlineDiffProps) {
  const [applied, setApplied] = useState<Set<string>>(new Set());

  const applyChunk = (id: string) => {
    setApplied((prev) => new Set([...prev, id]));
  };

  const pendingCount = chunks.filter((c) => !applied.has(c.id)).length;

  return (
    <div
      style={{
        margin: '12px 20px',
        border: '1px solid var(--border-default)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '8px 14px',
          background: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
          Suggested Changes ({pendingCount} pending)
        </span>
        {pendingCount > 0 && (
          <button
            onClick={onApplyAll}
            style={{
              padding: '3px 10px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid var(--accent-green)',
              background: 'rgba(34,197,94,0.12)',
              color: 'var(--accent-green)',
            }}
          >
            Apply All
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {chunks.map((chunk, i) => (
          <div
            key={chunk.id}
            style={{
              borderBottom: i < chunks.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              opacity: applied.has(chunk.id) ? 0.4 : 1,
              transition: 'opacity 0.2s ease',
            }}
          >
            <div
              style={{
                padding: '6px 14px',
                background: 'rgba(239,68,68,0.06)',
                fontSize: 13,
                color: 'var(--text-secondary)',
                textDecoration: 'line-through',
                fontFamily: 'inherit',
                lineHeight: 1.6,
              }}
            >
              {chunk.removed}
            </div>
            <div
              style={{
                padding: '6px 14px',
                background: 'rgba(34,197,94,0.06)',
                fontSize: 13,
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                lineHeight: 1.6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <span>{chunk.added}</span>
              {!applied.has(chunk.id) && (
                <button
                  onClick={() => applyChunk(chunk.id)}
                  style={{
                    flexShrink: 0,
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1px solid var(--accent-green)',
                    background: 'rgba(34,197,94,0.12)',
                    color: 'var(--accent-green)',
                  }}
                >
                  Apply
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
