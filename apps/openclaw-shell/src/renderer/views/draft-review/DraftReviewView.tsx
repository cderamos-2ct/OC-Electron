import React, { useState } from 'react';
import { DraftEditor } from './DraftEditor';
import { ToneSelector } from './ToneSelector';
import { InlineDiff } from './InlineDiff';
import { VersionBar } from './VersionBar';
import { DraftFields } from './DraftFields';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_DRAFT = {
  id: 'draft-001',
  taskId: 'TASK-142',
  title: 'Partnership Proposal — Meridian Tech',
  subtitle: 'Reply to Sarah Chen · Drafted by Scribe 📜',
  to: 'sarah.chen@meridiantech.io',
  cc: 'partnerships@aegilume.ai',
  subject: 'Re: Strategic Partnership Opportunity',
  content: `Hi Sarah,

Thank you for reaching out about the potential partnership between Meridian Tech and Aegilume. I've reviewed your proposal and I'm excited about the synergies we could create together.

Our platform's multi-agent orchestration capabilities would complement Meridian's enterprise workflow solutions quite well. I'd love to explore a deeper integration that could benefit both of our customer bases.

I'd propose we schedule a 45-minute technical sync next week to go over the integration specifics. Would Thursday or Friday work for your team?

Looking forward to building something great together.

Best regards,
Christian De Ramos
CTO, Aegilume`,
};

const MOCK_VERSIONS = [
  { id: 'v3', label: 'v3 — Current', isCurrent: true },
  { id: 'v2', label: 'v2 — Concise', isCurrent: false },
  { id: 'v1', label: 'v1 — Draft', isCurrent: false },
];

const MOCK_DIFF_CHUNKS = [
  {
    id: 'diff-1',
    removed: "I'm excited about the synergies we could create together.",
    added: 'The alignment with our roadmap is strong, and I see clear mutual upside.',
  },
  {
    id: 'diff-2',
    removed: 'Would Thursday or Friday work for your team?',
    added: 'I have availability Thursday 2–4 PM or Friday 10–11 AM PST — does either work?',
  },
];

const MOCK_THREAD = [
  {
    id: 'msg-1',
    author: 'Scribe',
    avatar: '📜',
    avatarBg: '#2d2d5e',
    time: '2m ago',
    text: 'I drafted this based on your previous partnership emails. Adjusted tone to Professional.',
  },
  {
    id: 'msg-2',
    author: 'You',
    avatar: 'CD',
    avatarBg: '#1a1a2e',
    time: '1m ago',
    text: 'Looks good. Can you make the scheduling part more specific?',
    isMe: true,
  },
  {
    id: 'msg-3',
    author: 'Scribe',
    avatar: '📜',
    avatarBg: '#2d2d5e',
    time: 'Just now',
    text: "Done — I've added specific time slots in the diff above. Apply when ready.",
  },
];

const MOCK_AVATAR_STACK = ['📜', '🧠', '🌈'];

// ─── Right Rail ───────────────────────────────────────────────────────────────

function DraftRightRail() {
  const [chatInput, setChatInput] = useState('');

  return (
    <div
      style={{
        width: 380,
        flexShrink: 0,
        borderLeft: '1px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-secondary)',
      }}
    >
      {/* Context bar */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--accent-green)',
            flexShrink: 0,
            boxShadow: '0 0 6px var(--accent-green)',
            animation: 'pulse 2s infinite',
          }}
        />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          Scribe is active
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: -4 }}>
          {MOCK_AVATAR_STACK.map((emoji, i) => (
            <div
              key={i}
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: '#131d33',
                border: '1px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                marginLeft: i > 0 ? -6 : 0,
                zIndex: MOCK_AVATAR_STACK.length - i,
                position: 'relative',
              }}
            >
              {emoji}
            </div>
          ))}
        </div>
      </div>

      {/* Thread */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {MOCK_THREAD.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              gap: 10,
              flexDirection: msg.isMe ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: msg.avatarBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: msg.isMe ? 10 : 14,
                fontWeight: msg.isMe ? 700 : 400,
                color: 'var(--text-primary)',
                flexShrink: 0,
              }}
            >
              {msg.avatar}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: '75%' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flexDirection: msg.isMe ? 'row-reverse' : 'row',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {msg.author}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{msg.time}</span>
              </div>
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: 'var(--text-primary)',
                  background: msg.isMe ? 'rgba(59,130,246,0.12)' : 'var(--bg-tertiary)',
                  border: msg.isMe
                    ? '1px solid rgba(59,130,246,0.2)'
                    : '1px solid var(--border-subtle)',
                }}
              >
                {msg.text}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chat input */}
      <div
        style={{
          padding: '10px 12px',
          borderTop: '1px solid var(--border-default)',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Ask Scribe to revise..."
          style={{
            flex: 1,
            padding: '7px 10px',
            borderRadius: 8,
            border: '1px solid var(--border-default)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            fontSize: 12,
            outline: 'none',
          }}
        />
        <button
          style={{
            width: 30,
            height: 30,
            borderRadius: 7,
            border: 'none',
            background: 'var(--accent-blue)',
            color: '#fff',
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function DraftReviewView() {
  const [activeTone, setActiveTone] = useState('professional');
  const [activeVersion, setActiveVersion] = useState('v3');
  const [diffApplied, setDiffApplied] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
        background: 'var(--bg-primary)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {/* Page nav */}
        <div
          style={{
            padding: '10px 20px',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--bg-secondary)',
          }}
        >
          <button
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ←
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Drafts</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{MOCK_DRAFT.title}</span>
        </div>

        {/* Draft page header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            background: 'var(--bg-secondary)',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: '#5e1f2d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            📝
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {MOCK_DRAFT.title}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {MOCK_DRAFT.subtitle} · Task{' '}
              <span style={{ color: 'var(--accent-blue)' }}>{MOCK_DRAFT.taskId}</span>
            </span>
          </div>
        </div>

        {/* Version bar */}
        <VersionBar
          versions={MOCK_VERSIONS}
          activeVersionId={activeVersion}
          onSelectVersion={setActiveVersion}
        />

        {/* Tone selector */}
        <ToneSelector activeTone={activeTone} onSelectTone={setActiveTone} />

        {/* Draft fields */}
        <DraftFields
          to={MOCK_DRAFT.to}
          subject={MOCK_DRAFT.subject}
          cc={MOCK_DRAFT.cc}
        />

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', paddingTop: 12, paddingBottom: 80 }}>
          <DraftEditor
            content={MOCK_DRAFT.content}
            label="Draft Body"
            meta={`Tone: ${activeTone.charAt(0).toUpperCase() + activeTone.slice(1)} · ${MOCK_DRAFT.content.split(' ').length} words`}
          />

          {!diffApplied && (
            <InlineDiff
              chunks={MOCK_DIFF_CHUNKS}
              onApplyAll={() => setDiffApplied(true)}
            />
          )}
        </div>

        {/* Bottom action bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 380,
            padding: '12px 20px',
            borderTop: '1px solid var(--border-default)',
            background: 'var(--bg-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <button
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
            }}
          >
            Edit Draft
          </button>
          <button
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: 'var(--accent-green)',
              color: '#000',
            }}
          >
            Approve &amp; Send
          </button>
          <button
            style={{
              marginLeft: 'auto',
              padding: '8px 18px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              border: '1px solid rgba(239,68,68,0.3)',
              background: 'rgba(239,68,68,0.08)',
              color: 'var(--accent-red)',
            }}
          >
            Reject
          </button>
        </div>
      </div>

      {/* Right rail */}
      <DraftRightRail />
    </div>
  );
}
