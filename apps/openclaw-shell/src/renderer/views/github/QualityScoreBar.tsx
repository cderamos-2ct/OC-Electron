import React from 'react';

// ─── Props ────────────────────────────────────────────────────────────────────

interface QualityScoreBarProps {
  score: number; // 0-100
}

// ─── QualityScoreBar ──────────────────────────────────────────────────────────

export function QualityScoreBar({ score }: QualityScoreBarProps) {
  const clampedScore = Math.max(0, Math.min(100, score));

  return (
    <div
      style={{
        height: 8,
        borderRadius: 4,
        background: 'var(--border)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${clampedScore}%`,
          borderRadius: 4,
          background: `linear-gradient(to right, #ef4444 0%, #f59e0b 40%, #22c55e 80%, #22c55e 100%)`,
          backgroundSize: '200% 100%',
          backgroundPositionX: `${100 - clampedScore}%`,
          transition: 'width 0.4s ease',
        }}
      />
    </div>
  );
}
