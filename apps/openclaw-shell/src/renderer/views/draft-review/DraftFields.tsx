import React from 'react';

interface DraftFieldsProps {
  to: string;
  subject: string;
  cc?: string;
}

export function DraftFields({ to, subject, cc }: DraftFieldsProps) {
  return (
    <div
      style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 40 }}>To</span>
        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{to}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 40 }}>Subject</span>
        <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{subject}</span>
      </div>
      {cc && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 40 }}>CC</span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{cc}</span>
        </div>
      )}
    </div>
  );
}
