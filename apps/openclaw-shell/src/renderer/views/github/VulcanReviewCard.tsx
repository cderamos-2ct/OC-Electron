import React from 'react';
import { QualityScoreBar } from './QualityScoreBar';

// ─── Props ────────────────────────────────────────────────────────────────────

interface VulcanReviewCardProps {
  prNumber: number;
  prTitle: string;
  qualityScore: number; // 0-100
  summary: string;
  fileCount: number;
  issueCount: number;
}

// ─── VulcanReviewCard ─────────────────────────────────────────────────────────

export function VulcanReviewCard({
  prNumber,
  prTitle,
  qualityScore,
  summary,
  fileCount,
  issueCount,
}: VulcanReviewCardProps) {
  return (
    <div
      style={{
        background: 'var(--bg-card, #161624)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 20,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        {/* Vulcan agent badge */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'rgba(255,107,53,0.15)',
            border: '1.5px solid #ff6b35',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          🔥
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
            Vulcan Code Review
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            PR #{prNumber} · {prTitle}
          </div>
        </div>
      </div>

      {/* Quality score */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Quality Score
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: qualityScore >= 80 ? '#6bffa0' : qualityScore >= 60 ? '#ffb86b' : '#ff6b6b',
            }}
          >
            {qualityScore}
          </div>
        </div>
        <QualityScoreBar score={qualityScore} />
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{fileCount}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Files</div>
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: issueCount > 0 ? '#ffb86b' : '#6bffa0' }}>{issueCount}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Issues</div>
        </div>
      </div>

      {/* Review summary */}
      <div
        style={{
          background: 'rgba(255,107,53,0.06)',
          border: '1px solid rgba(255,107,53,0.2)',
          borderRadius: 8,
          padding: 12,
          fontSize: 12,
          color: 'var(--text)',
          lineHeight: 1.6,
        }}
      >
        {summary}
      </div>
    </div>
  );
}
