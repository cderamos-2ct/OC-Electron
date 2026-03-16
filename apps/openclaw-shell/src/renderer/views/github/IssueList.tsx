import React from 'react';
import type { GitHubIssue } from '../../../shared/types.js';

// ─── Label color map ──────────────────────────────────────────────────────────

function getLabelStyle(label: string): { color: string; bg: string } {
  switch (label.toLowerCase()) {
    case 'bug':
      return { color: '#ff6b6b', bg: 'rgba(94,31,31,0.3)' };
    case 'enhancement':
      return { color: '#6bb8ff', bg: 'rgba(31,61,94,0.3)' };
    case 'documentation':
      return { color: '#c99bff', bg: 'rgba(61,31,94,0.3)' };
    case 'good first issue':
      return { color: '#6bffa0', bg: 'rgba(31,94,45,0.3)' };
    default:
      return { color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.06)' };
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface IssueListProps {
  issues: GitHubIssue[];
}

// ─── IssueList ────────────────────────────────────────────────────────────────

export function IssueList({ issues }: IssueListProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {issues.map((issue) => (
        <div
          key={issue.number}
          style={{
            background: 'var(--bg-card, #161624)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
            transition: 'border-color 0.12s',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-hover, rgba(255,255,255,0.15))')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)')}
        >
          {/* Issue number */}
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', minWidth: 36, flexShrink: 0 }}>
            #{issue.number}
          </div>

          {/* Open circle icon */}
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              border: '2px solid #6bffa0',
              flexShrink: 0,
            }}
          />

          {/* Title */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginBottom: 4,
              }}
            >
              {issue.title}
            </div>

            {/* Labels */}
            {issue.labels.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {issue.labels.map((label: string) => {
                  const style = getLabelStyle(label);
                  return (
                    <span
                      key={label}
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        color: style.color,
                        background: style.bg,
                        borderRadius: 4,
                        padding: '1px 6px',
                        textTransform: 'capitalize',
                      }}
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Assignees */}
          {issue.assignees.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              {issue.assignees.map((assignee: string) => (
                <div
                  key={assignee}
                  title={assignee}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'rgba(107,184,255,0.2)',
                    border: '1.5px solid #6bb8ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontWeight: 700,
                    color: '#6bb8ff',
                  }}
                >
                  {assignee[0].toUpperCase()}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
