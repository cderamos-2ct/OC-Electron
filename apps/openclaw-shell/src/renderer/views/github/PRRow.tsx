import React from 'react';
import type { GitHubPR } from '../../../shared/types.js';

// ─── Status helpers ────────────────────────────────────────────────────────────

function getStatusStyle(state: string, mergeable: boolean | null): { bg: string; color: string; label: string } {
  if (state === 'merged') return { bg: 'rgba(61,31,94,0.3)', color: '#c99bff', label: 'Merged' };
  if (state === 'closed') return { bg: 'rgba(94,31,31,0.3)', color: '#ff6b6b', label: 'Closed' };
  if (mergeable === null || mergeable === false) return { bg: 'transparent', color: 'var(--text-muted)', label: 'Draft' };
  return { bg: 'rgba(31,94,45,0.3)', color: '#6bffb0', label: 'Open' };
}

function getReviewStyle(decision?: string): { color: string; label: string } | null {
  if (!decision) return null;
  if (decision === 'APPROVED') return { color: '#6bffa0', label: 'Approved' };
  if (decision === 'CHANGES_REQUESTED') return { color: '#ffb86b', label: 'Changes Requested' };
  if (decision === 'REVIEW_REQUIRED') return { color: 'var(--text-muted)', label: 'Review Pending' };
  return null;
}

function isDraft(pr: GitHubPR): boolean {
  return pr.state === 'open' && pr.mergeable === true && !pr.reviewDecision;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PRRowProps {
  pr: GitHubPR;
}

// ─── PRRow ────────────────────────────────────────────────────────────────────

export function PRRow({ pr }: PRRowProps) {
  const draft = isDraft(pr);
  const status = getStatusStyle(pr.state, pr.mergeable);
  const review = getReviewStyle(pr.reviewDecision);
  const canMerge = pr.state === 'open' && pr.mergeable && pr.reviewDecision === 'APPROVED';

  return (
    <div
      style={{
        background: 'var(--bg-card, #161624)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        transition: 'border-color 0.12s',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-hover, rgba(255,255,255,0.15))')}
      onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)')}
    >
      {/* PR number */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-muted)',
          minWidth: 36,
          flexShrink: 0,
        }}
      >
        #{pr.number}
      </div>

      {/* Title + branch */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: draft ? 'var(--text-muted)' : 'var(--text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: 2,
          }}
        >
          {pr.title}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {pr.head} → {pr.base} · by {pr.user}
        </div>
      </div>

      {/* Review decision */}
      {review && (
        <div
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: review.color,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {review.label}
        </div>
      )}

      {/* Status badge */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: status.color,
          background: status.bg,
          border: draft ? '1px solid var(--border)' : undefined,
          borderRadius: 6,
          padding: '2px 8px',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {draft ? 'Draft' : status.label}
      </div>

      {/* Merge button */}
      {canMerge && (
        <button
          onClick={(e) => {
            e.stopPropagation();
          }}
          style={{
            background: 'rgba(31,94,45,0.4)',
            border: '1px solid #1f5e2d',
            borderRadius: 6,
            color: '#6bffb0',
            fontSize: 11,
            fontWeight: 600,
            padding: '4px 10px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Merge
        </button>
      )}
    </div>
  );
}
