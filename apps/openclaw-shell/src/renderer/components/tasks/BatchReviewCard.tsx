import React, { useState } from 'react';
import type { TaskDocument } from '../../../shared/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function categorize(tasks: TaskDocument[]): Record<string, number> {
  const counts: Record<string, number> = {
    emails: 0,
    invites: 0,
    prs: 0,
    other: 0,
  };

  for (const task of tasks) {
    const tags = task.tags ?? [];
    const agent = task.owner_agent ?? '';

    if (
      tags.includes('email') ||
      tags.includes('comms') ||
      agent === 'comms'
    ) {
      counts.emails += 1;
    } else if (
      tags.includes('calendar') ||
      tags.includes('invite') ||
      agent === 'calendar'
    ) {
      counts.invites += 1;
    } else if (
      tags.includes('pr') ||
      tags.includes('github') ||
      tags.includes('build') ||
      agent === 'build'
    ) {
      counts.prs += 1;
    } else {
      counts.other += 1;
    }
  }

  return counts;
}

// ─── BatchReviewCard ──────────────────────────────────────────────────────────

export interface BatchReviewCardProps {
  handledTasks: TaskDocument[];
  needsDecisionTasks: TaskDocument[];
  fyiTaskIds: string[];
  onBatchApprove: (ids: string[]) => Promise<void>;
  onReviewItems: () => void;
}

export function BatchReviewCard({
  handledTasks,
  needsDecisionTasks,
  fyiTaskIds,
  onBatchApprove,
  onReviewItems,
}: BatchReviewCardProps) {
  const [approving, setApproving] = useState(false);

  const handled = handledTasks.length;
  const needsCall = needsDecisionTasks.length;
  const cats = categorize(handledTasks);

  const breakdownParts: string[] = [];
  if (cats.emails > 0) breakdownParts.push(`${cats.emails} email${cats.emails > 1 ? 's' : ''} triaged`);
  if (cats.invites > 0) breakdownParts.push(`${cats.invites} invite${cats.invites > 1 ? 's' : ''} accepted`);
  if (cats.prs > 0) breakdownParts.push(`${cats.prs} PR${cats.prs > 1 ? 's' : ''} merged`);
  if (cats.other > 0) breakdownParts.push(`${cats.other} other`);

  const handleApproveAll = async () => {
    if (fyiTaskIds.length === 0) return;
    setApproving(true);
    try {
      await onBatchApprove(fyiTaskIds);
    } finally {
      setApproving(false);
    }
  };

  if (handled === 0 && needsCall === 0) return null;

  return (
    <div
      style={{
        borderRadius: '8px',
        border: '1px solid #3f3f46',
        backgroundColor: '#27272a',
        padding: '12px',
        marginBottom: '12px',
      }}
    >
      {/* Summary line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#f4f4f5' }}>
          {handled > 0 && (
            <span style={{ color: '#10b981' }}>{handled} handled autonomously</span>
          )}
          {handled > 0 && needsCall > 0 && (
            <span style={{ color: '#71717a' }}> · </span>
          )}
          {needsCall > 0 && (
            <span style={{ color: '#f59e0b' }}>{needsCall} need{needsCall === 1 ? 's' : ''} your call</span>
          )}
        </span>
      </div>

      {/* Breakdown */}
      {breakdownParts.length > 0 && (
        <p style={{ fontSize: '11px', color: '#71717a', margin: '0 0 10px 0' }}>
          {breakdownParts.join(' · ')}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {fyiTaskIds.length > 0 && (
          <button
            onClick={handleApproveAll}
            disabled={approving}
            style={{
              padding: '5px 12px',
              borderRadius: '5px',
              border: 'none',
              cursor: approving ? 'not-allowed' : 'pointer',
              fontSize: '11px',
              fontWeight: 600,
              color: '#fff',
              backgroundColor: approving ? '#374151' : '#059669',
              opacity: approving ? 0.7 : 1,
              transition: 'background-color 0.15s',
            }}
          >
            {approving ? 'Approving…' : `Approve All Safe (${fyiTaskIds.length})`}
          </button>
        )}
        {needsCall > 0 && (
          <button
            onClick={onReviewItems}
            style={{
              padding: '5px 12px',
              borderRadius: '5px',
              border: '1px solid #52525b',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
              color: '#a1a1aa',
              backgroundColor: 'transparent',
              transition: 'border-color 0.15s, color 0.15s',
            }}
          >
            Review Items
          </button>
        )}
      </div>
    </div>
  );
}
