import React, { useState } from 'react';
import { PRRow } from './PRRow';
import { VulcanReviewCard } from './VulcanReviewCard';
import { DeployCard } from './DeployCard';
import { IssueList } from './IssueList';
import type { GitHubPR, GitHubIssue } from '../../../shared/types.js';

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_PRS: GitHubPR[] = [
  {
    number: 142,
    title: 'feat: Add Calendar view with week grid and agenda sidebar',
    state: 'open',
    user: 'christian',
    base: 'main',
    head: 'feat/calendar-view',
    mergeable: true,
    reviewDecision: 'APPROVED',
    url: '#',
  },
  {
    number: 141,
    title: 'feat: GitHub view with PR rows, deploy cards, and Vulcan review',
    state: 'open',
    user: 'christian',
    base: 'main',
    head: 'feat/github-view',
    mergeable: true,
    reviewDecision: 'REVIEW_REQUIRED',
    url: '#',
  },
  {
    number: 139,
    title: 'fix: Vault pending card collapse animation on dark theme',
    state: 'merged',
    user: 'christian',
    base: 'main',
    head: 'fix/vault-card-collapse',
    mergeable: null,
    reviewDecision: 'APPROVED',
    url: '#',
  },
  {
    number: 137,
    title: 'chore: Upgrade Electron to 35.x and audit peer deps',
    state: 'open',
    user: 'christian',
    base: 'main',
    head: 'chore/electron-upgrade',
    mergeable: false,
    reviewDecision: 'CHANGES_REQUESTED',
    url: '#',
  },
  {
    number: 135,
    title: 'feat: Add Browser view with Product Hunt mockup and Add App modal',
    state: 'merged',
    user: 'christian',
    base: 'main',
    head: 'feat/browser-view',
    mergeable: null,
    reviewDecision: 'APPROVED',
    url: '#',
  },
  {
    number: 130,
    title: 'draft: Experiment with multi-model agent routing via gateway',
    state: 'open',
    user: 'christian',
    base: 'main',
    head: 'draft/agent-routing',
    mergeable: true,
    reviewDecision: undefined,
    url: '#',
  },
];

const MOCK_ISSUES: GitHubIssue[] = [
  {
    number: 88,
    title: 'Shell rail agent badge count not updating on reconnect',
    state: 'open',
    user: 'christian',
    labels: ['bug', 'rail'],
    assignees: ['christian'],
    url: '#',
  },
  {
    number: 87,
    title: 'Calendar time indicator flickers when switching views',
    state: 'open',
    user: 'christian',
    labels: ['bug', 'calendar'],
    assignees: [],
    url: '#',
  },
  {
    number: 85,
    title: 'Implement real GitHub API integration via GWS CLI',
    state: 'open',
    user: 'christian',
    labels: ['enhancement', 'github'],
    assignees: ['christian'],
    url: '#',
  },
  {
    number: 83,
    title: 'Add keyboard shortcuts for view navigation',
    state: 'open',
    user: 'christian',
    labels: ['enhancement', 'ux'],
    assignees: [],
    url: '#',
  },
];

type TabKey = 'prs' | 'issues' | 'deploys' | 'reviews';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'prs', label: 'Pull Requests' },
  { key: 'issues', label: 'Issues' },
  { key: 'deploys', label: 'Deploys' },
  { key: 'reviews', label: 'Reviews' },
];

const REPOS = ['aegilume/aegilume-shell', 'aegilume/dashboard', 'aegilume/gateway'];

// ─── GitHubView ───────────────────────────────────────────────────────────────

export function GitHubView() {
  const [activeTab, setActiveTab] = useState<TabKey>('prs');
  const [selectedRepo, setSelectedRepo] = useState(REPOS[0]);

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        background: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      {/* Main content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '32px 40px',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}
      >
        {/* Page header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 24,
          }}
        >
          {/* Repo selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--bg-card, #161624)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text)',
            }}
          >
            <span style={{ fontSize: 14 }}>&#128220;</span>
            <select
              value={selectedRepo}
              onChange={(e) => setSelectedRepo(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {REPOS.map((r) => (
                <option key={r} value={r} style={{ background: '#161624' }}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1 }} />

          {/* Quick stats */}
          <div style={{ display: 'flex', gap: 16 }}>
            {[
              { label: 'Open PRs', value: MOCK_PRS.filter((p) => p.state === 'open').length },
              { label: 'Open Issues', value: MOCK_ISSUES.filter((i) => i.state === 'open').length },
            ].map(({ label, value }) => (
              <div key={label} style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Filter tabs */}
        <div
          style={{
            display: 'flex',
            gap: 2,
            marginBottom: 20,
            borderBottom: '1px solid var(--border)',
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-muted)',
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: activeTab === tab.key ? 600 : 400,
                cursor: 'pointer',
                transition: 'color 0.12s',
                marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'prs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MOCK_PRS.map((pr) => (
              <PRRow key={pr.number} pr={pr} />
            ))}
          </div>
        )}

        {activeTab === 'issues' && <IssueList issues={MOCK_ISSUES} />}

        {activeTab === 'deploys' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <DeployCard
              environment="production"
              status="success"
              commitHash="3730a03"
              message="Fix vault view layout: pending card collapse and topbar overflow"
              deployedAt="2 hours ago"
              branch="main"
            />
            <DeployCard
              environment="staging"
              status="building"
              commitHash="f9d87e4"
              message="Add Vault view with Themis gatekeeper agent"
              deployedAt="Just now"
              branch="feat/vault-view"
            />
            <DeployCard
              environment="development"
              status="success"
              commitHash="21aeace"
              message="Add browser view with Product Hunt mockup"
              deployedAt="1 day ago"
              branch="feat/browser-view"
            />
          </div>
        )}

        {activeTab === 'reviews' && (
          <VulcanReviewCard
            prNumber={142}
            prTitle="feat: Add Calendar view with week grid and agenda sidebar"
            qualityScore={87}
            summary="Solid implementation of the week grid with correct CSS grid layout. Event block color coding is consistent with the design system. Minor: consider memoizing getThisWeekEvents() to avoid recreating on each render. No security issues. 3 style nits."
            fileCount={7}
            issueCount={4}
          />
        )}
      </div>

      {/* Right rail */}
      <div
        style={{
          width: 240,
          borderLeft: '1px solid var(--border)',
          background: 'var(--bg-secondary, var(--bg))',
          padding: '20px 16px',
          overflowY: 'auto',
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
          Activity
        </div>

        {[
          { actor: 'Vulcan', action: 'reviewed PR #142', time: '5m ago', color: '#ff6b35' },
          { actor: 'christian', action: 'opened PR #141', time: '1h ago', color: '#6bb8ff' },
          { actor: 'christian', action: 'merged PR #139', time: '3h ago', color: '#6bffa0' },
          { actor: 'Vulcan', action: 'requested changes on PR #137', time: '1d ago', color: '#ff6b35' },
          { actor: 'christian', action: 'closed issue #82', time: '2d ago', color: '#6bb8ff' },
        ].map((item, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: item.color + '33',
                  border: `1.5px solid ${item.color}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 9,
                  fontWeight: 700,
                  color: item.color,
                  flexShrink: 0,
                }}
              >
                {item.actor[0].toUpperCase()}
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{item.actor}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 26 }}>
              {item.action}
              <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.6 }}>· {item.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
