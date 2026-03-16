import React, { useState, useMemo } from 'react';
import { TaskCard, TaskItem, TaskPriority } from './TaskCard';
import { FilterBar, FilterKey } from './FilterBar';
import { ApprovalFlow, ApprovalRequest } from './ApprovalFlow';
import { BatchReview } from './BatchReview';

// ─── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_TASKS: TaskItem[] = [
  {
    id: 'TSK-047',
    title: 'Deploy staging build to production',
    description:
      'The staging environment has been validated. This task will promote the current build to production. CI checks passed. Requires manual approval before rollout.',
    priority: 'approval',
    agent: 'build',
    agentColor: '#3b82f6',
    agentInitial: 'B',
    updatedAt: new Date(Date.now() - 8 * 60000).toISOString(),
    tags: ['deploy', 'prod'],
  },
  {
    id: 'TSK-048',
    title: 'Mobile CI pipeline stuck — Node OOM on test runner',
    description:
      'The mobile CI pipeline has been stuck for 2h 14m. The Node process is running out of memory on the test runner. Needs intervention to unblock the mobile team release.',
    priority: 'urgent',
    agent: 'build',
    agentColor: '#3b82f6',
    agentInitial: 'B',
    updatedAt: new Date(Date.now() - 134 * 60000).toISOString(),
    tags: ['ci', 'mobile'],
  },
  {
    id: 'TSK-043',
    title: 'Compile competitive analysis on AI orchestration platforms',
    description:
      'Researched 4 competing platforms: LangGraph, CrewAI, AutoGen, and Vertex AI Agents. Report includes feature matrix, pricing, and strategic recommendations.',
    priority: 'done',
    agent: 'research',
    agentColor: '#8b5cf6',
    agentInitial: 'R',
    updatedAt: new Date(Date.now() - 3 * 60 * 60000).toISOString(),
    tags: ['research'],
  },
  {
    id: 'TSK-049',
    title: 'Reply to Alphagraphics email re: print order',
    description:
      'Drafted a reply confirming the print order details and requesting a proof before final run. Lynn Nelson is the contact — awaiting your review before sending.',
    priority: 'approval',
    agent: 'comms',
    agentColor: '#f59e0b',
    agentInitial: 'C',
    updatedAt: new Date(Date.now() - 25 * 60000).toISOString(),
    tags: ['email'],
  },
  {
    id: 'TSK-050',
    title: 'Reconcile monthly subscriptions',
    description:
      'Identified $340/mo in subscriptions that are not in the approved budget. Categories: 2 SaaS tools flagged for review, 1 auto-renewed annual plan.',
    priority: 'running',
    agent: 'finance',
    agentColor: '#10b981',
    agentInitial: 'F',
    updatedAt: new Date(Date.now() - 45 * 60000).toISOString(),
    tags: ['finance'],
  },
  {
    id: 'TSK-044',
    title: 'Sync Google Calendar events to task board',
    description:
      'Pull today and tomorrow events from Google Calendar and create associated tasks. 2 meetings and 1 deadline synced successfully.',
    priority: 'done',
    agent: 'calendar',
    agentColor: '#06b6d4',
    agentInitial: 'CA',
    updatedAt: new Date(Date.now() - 5 * 60 * 60000).toISOString(),
    tags: ['calendar'],
  },
  {
    id: 'TSK-051',
    title: 'Draft LinkedIn post about Aegilume v0.4 launch',
    description:
      'Draft ready for review. 280 characters, includes key feature highlights and CTA. Scheduled for 10 AM Pacific.',
    priority: 'pending',
    agent: 'comms',
    agentColor: '#f59e0b',
    agentInitial: 'C',
    updatedAt: new Date(Date.now() - 2 * 60000).toISOString(),
    tags: ['social'],
  },
];

const MOCK_APPROVALS: ApprovalRequest[] = [
  {
    id: 'APR-001',
    agent: 'Build Agent',
    agentColor: '#3b82f6',
    agentInitial: 'B',
    action: 'Deploy to production — v0.4.1',
    detail:
      'All CI checks passed on staging. This action will promote the current artifact to the production environment and update the DNS alias.',
    risk: 'high',
  },
  {
    id: 'APR-002',
    agent: 'Comms Agent',
    agentColor: '#f59e0b',
    agentInitial: 'C',
    action: 'Send email to Lynn Nelson (Alphagraphics)',
    detail:
      'Reply to print order inquiry — confirming 500 units, requesting digital proof before final run. Delivery week of March 24.',
    risk: 'low',
  },
];

// ─── TasksView ─────────────────────────────────────────────────────────────────

export function TasksView() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [showBatch, setShowBatch] = useState(false);
  const [approvals, setApprovals] = useState(MOCK_APPROVALS);

  const filterOptions = useMemo(() => {
    const counts: Partial<Record<FilterKey, number>> = { all: MOCK_TASKS.length };
    for (const t of MOCK_TASKS) {
      counts[t.priority] = (counts[t.priority] ?? 0) + 1;
    }
    return [
      { key: 'all' as FilterKey, label: 'All', count: counts.all },
      { key: 'urgent' as FilterKey, label: 'Urgent', count: counts.urgent ?? 0 },
      { key: 'approval' as FilterKey, label: 'Approval', count: counts.approval ?? 0 },
      { key: 'running' as FilterKey, label: 'Running', count: counts.running ?? 0 },
      { key: 'done' as FilterKey, label: 'Done', count: counts.done ?? 0 },
      { key: 'pending' as FilterKey, label: 'Pending', count: counts.pending ?? 0 },
    ];
  }, []);

  const filteredTasks = useMemo(() => {
    if (activeFilter === 'all') return MOCK_TASKS;
    return MOCK_TASKS.filter((t) => t.priority === activeFilter);
  }, [activeFilter]);

  const approvalTasks = MOCK_TASKS.filter((t) => t.priority === 'approval');

  const handleApprove = (id: string) => {
    setApprovals((prev) => prev.filter((a) => a.id !== id));
  };

  const handleReject = (id: string) => {
    setApprovals((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      {/* Main content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '32px 40px',
          minWidth: 0,
        }}
      >
        {/* Page header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}
        >
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Tasks
          </h1>
          <button
            onClick={() => setShowBatch((v) => !v)}
            style={{
              padding: '7px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-default)',
              backgroundColor: showBatch ? 'rgba(59,130,246,0.1)' : 'var(--bg-tertiary)',
              color: showBatch ? 'var(--accent-blue)' : 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Batch Review
          </button>
        </div>

        {/* Filter bar */}
        <div style={{ marginBottom: '24px' }}>
          <FilterBar
            options={filterOptions}
            active={activeFilter}
            onChange={setActiveFilter}
          />
        </div>

        {/* Batch review panel */}
        {showBatch && (
          <BatchReview
            tasks={approvalTasks}
            onApproveAll={(ids) => {
              setApprovals((prev) => prev.filter((a) => !ids.includes(a.id)));
            }}
            onDismiss={() => setShowBatch(false)}
          />
        )}

        {/* Pending approvals */}
        {approvals.length > 0 && activeFilter === 'all' && (
          <div style={{ marginBottom: '24px' }}>
            <p
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                margin: '0 0 12px 0',
              }}
            >
              Awaiting Approval ({approvals.length})
            </p>
            {approvals.map((req) => (
              <ApprovalFlow
                key={req.id}
                request={req}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </div>
        )}

        {/* Task list */}
        <div>
          <p
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              margin: '0 0 12px 0',
            }}
          >
            {activeFilter === 'all' ? 'All Tasks' : `${activeFilter.charAt(0).toUpperCase()}${activeFilter.slice(1)}`} ({filteredTasks.length})
          </p>
          {filteredTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
          {filteredTasks.length === 0 && (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
              No tasks in this category.
            </p>
          )}
        </div>
      </div>

      {/* Right rail placeholder */}
      <div
        style={{
          width: '280px',
          flexShrink: 0,
          borderLeft: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-secondary)',
          padding: '24px 20px',
        }}
      >
        <p
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            margin: '0 0 12px 0',
          }}
        >
          Task Stats
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            { label: 'Running', value: 1, color: '#3b82f6' },
            { label: 'Approval', value: 2, color: '#f5c842' },
            { label: 'Urgent', value: 1, color: '#ef4444' },
            { label: 'Done today', value: 2, color: '#22c55e' },
            { label: 'Pending', value: 1, color: '#a3a3a3' },
          ].map((stat) => (
            <div key={stat.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{stat.label}</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: stat.color }}>{stat.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
