import React from 'react';

interface DraftEditorProps {
  content: string;
  label: string;
  meta: string;
}

export function DraftEditor({ content, label, meta }: DraftEditorProps) {
  return (
    <div
      style={{
        margin: '0 20px 12px',
        border: '1px solid var(--border-default)',
        borderRadius: 8,
        overflow: 'hidden',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Toolbar */}
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
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{meta}</span>
      </div>

      {/* Content area */}
      <div
        style={{
          padding: '16px 18px',
          fontSize: 15,
          lineHeight: 1.8,
          color: 'var(--text-primary)',
          fontFamily: 'inherit',
          flex: 1,
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
        }}
      >
        {content}
      </div>
    </div>
  );
}
