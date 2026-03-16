import React from 'react';

const TONES = [
  { id: 'professional', label: 'Professional' },
  { id: 'friendly', label: 'Friendly' },
  { id: 'concise', label: 'Concise' },
  { id: 'formal', label: 'Formal' },
  { id: 'assertive', label: 'Assertive' },
  { id: 'empathetic', label: 'Empathetic' },
];

interface ToneSelectorProps {
  activeTone: string;
  onSelectTone: (tone: string) => void;
}

export function ToneSelector({ activeTone, onSelectTone }: ToneSelectorProps) {
  return (
    <div
      style={{
        padding: '10px 20px',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        overflowX: 'auto',
      }}
    >
      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4, whiteSpace: 'nowrap' }}>
        Tone
      </span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
        {TONES.map((tone) => {
          const isActive = activeTone === tone.id;
          return (
            <button
              key={tone.id}
              onClick={() => onSelectTone(tone.id)}
              style={{
                padding: '4px 12px',
                borderRadius: 14,
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                border: isActive
                  ? '1px solid var(--accent-blue)'
                  : '1px solid var(--border-default)',
                background: isActive ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              {tone.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
