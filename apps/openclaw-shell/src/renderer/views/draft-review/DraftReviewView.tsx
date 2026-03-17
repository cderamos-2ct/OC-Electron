import React, { useState, useEffect } from 'react';
import { invoke } from '../../lib/ipc-client';
import type { GmailDraft } from '../../../shared/types';
import { DraftEditor } from './DraftEditor';
import { ToneSelector } from './ToneSelector';
import { InlineDiff } from './InlineDiff';
import { VersionBar } from './VersionBar';
import { DraftFields } from './DraftFields';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DraftData {
  id: string;
  to: string;
  cc: string;
  subject: string;
  content: string;
  title: string;
  subtitle: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractHeader(body: string, header: string): string {
  const re = new RegExp(`^${header}:\\s*(.+)$`, 'mi');
  const m = body.match(re);
  return m ? m[1].trim() : '';
}

function stripHeaders(body: string): string {
  // Strip email headers (To:, From:, Subject:, Cc:, Date:) from top of body
  return body.replace(/^(To|From|Cc|Bcc|Subject|Date|Reply-To):\s*.+\n?/gim, '').trim();
}

function draftToData(draft: GmailDraft): DraftData {
  const msg = draft.message;
  const body = msg.body ?? msg.snippet ?? '';
  const subject = msg.subject || extractHeader(body, 'Subject') || 'Draft';
  const to      = msg.to    || extractHeader(body, 'To')      || '';
  const cc      = extractHeader(body, 'Cc');
  const cleanBody = stripHeaders(body);

  const toName = to.split('<')[0].trim() || to;

  return {
    id:       draft.id,
    to,
    cc,
    subject,
    content:  cleanBody || msg.snippet,
    title:    subject,
    subtitle: toName ? `Reply to ${toName} · Drafted by Scribe` : 'Drafted by Scribe',
  };
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function DraftSkeleton() {
  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[200, 160, 300, 120, 260].map((w, i) => (
        <div key={i} style={{
          height: i === 2 ? 120 : 14,
          borderRadius: 6,
          background: 'rgba(241,245,249,0.06)',
          maxWidth: w,
          animation: 'draftSkelPulse 1.6s ease-in-out infinite',
        }} />
      ))}
    </div>
  );
}

// ─── Right Rail ───────────────────────────────────────────────────────────────

const AVATAR_STACK = ['📜', '🧠', '🌈'];

function DraftRightRail({ draftId }: { draftId: string | null }) {
  const [chatInput, setChatInput] = useState('');

  return (
    <div style={{
      width: 380,
      flexShrink: 0,
      borderLeft: '1px solid var(--border-default)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg-secondary)',
    }}>
      {/* Context bar */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: draftId ? 'var(--accent-green)' : 'var(--text-muted)',
          flexShrink: 0,
          boxShadow: draftId ? '0 0 6px var(--accent-green)' : 'none',
          animation: draftId ? 'pulse 2s infinite' : 'none',
        }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          {draftId ? 'Scribe is active' : 'No draft selected'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: -4 }}>
          {AVATAR_STACK.map((emoji, i) => (
            <div key={i} style={{
              width: 24, height: 24, borderRadius: 6,
              background: '#131d33',
              border: '1px solid var(--border-default)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12,
              marginLeft: i > 0 ? -6 : 0,
              zIndex: AVATAR_STACK.length - i,
              position: 'relative',
            }}>
              {emoji}
            </div>
          ))}
        </div>
      </div>

      {/* Empty thread placeholder */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!draftId && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 20 }}>
            Select a draft to start the redraft session with Scribe
          </div>
        )}
        {draftId && (
          <div style={{
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 12,
            lineHeight: 1.6,
            color: 'var(--text-muted)',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-subtle)',
            textAlign: 'center',
          }}>
            Redraft session started · draft {draftId.slice(0, 12)}…
          </div>
        )}
      </div>

      {/* Chat input */}
      <div style={{
        padding: '10px 12px',
        borderTop: '1px solid var(--border-default)',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
      }}>
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Ask Scribe to revise..."
          disabled={!draftId}
          style={{
            flex: 1,
            padding: '7px 10px',
            borderRadius: 8,
            border: '1px solid var(--border-default)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            fontSize: 12,
            outline: 'none',
            opacity: draftId ? 1 : 0.5,
          }}
        />
        <button
          disabled={!draftId}
          style={{
            width: 30, height: 30,
            borderRadius: 7, border: 'none',
            background: draftId ? 'var(--accent-blue)' : 'var(--border-default)',
            color: '#fff', fontSize: 14, cursor: draftId ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
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

const AGENT_ID = 'primary';

const PLACEHOLDER_VERSIONS = [
  { id: 'v1', label: 'v1 — Draft', isCurrent: true },
];

export function DraftReviewView() {
  const [activeTone, setActiveTone]       = useState('professional');
  const [activeVersion, setActiveVersion] = useState('v1');
  const [diffApplied, setDiffApplied]     = useState(false);

  const [draft, setDraft]     = useState<DraftData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Fetch drafts from Gmail
    invoke('api.gmail.list', AGENT_ID, 'in:drafts', 20)
      .then((raw) => {
        if (cancelled) return;
        // The gmail list returns GmailMessage[] — find messages with DRAFT label
        const list = Array.isArray(raw) ? (raw as GmailDraft[]) : [];
        // Use first draft found
        const first = list[0] as GmailDraft | undefined;
        if (first) {
          setDraft(draftToData(first));
        } else {
          setDraft(null);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(String(err));
        setDraft(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const wordCount = draft?.content.split(/\s+/).filter(Boolean).length ?? 0;

  return (
    <>
      <style>{`
        @keyframes draftSkelPulse { 0%,100%{opacity:0.4} 50%{opacity:0.9} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
        background: 'var(--bg-primary)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Main content */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}>
          {/* Page nav */}
          <div style={{
            padding: '10px 20px',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--bg-secondary)',
          }}>
            <button style={{
              width: 28, height: 28, borderRadius: 7,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              cursor: 'pointer', fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              ←
            </button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Drafts</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {loading ? 'Loading…' : draft?.title ?? 'No drafts'}
            </span>
          </div>

          {/* Draft page header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            background: 'var(--bg-secondary)',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: '#5e1f2d',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, flexShrink: 0,
            }}>
              📝
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                {loading ? 'Loading draft…' : draft?.title ?? 'No drafts pending review'}
              </span>
              {draft && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {draft.subtitle}
                </span>
              )}
            </div>
          </div>

          {/* Loading state */}
          {loading && <DraftSkeleton />}

          {/* Error state */}
          {!loading && error && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: 'var(--text-muted)', padding: 40 }}>
              <div style={{ fontSize: 32 }}>⚠</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Failed to load drafts</div>
              <div style={{ fontSize: 12 }}>{error}</div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && !draft && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 40 }}>📝</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>No drafts pending review</div>
              <div style={{ fontSize: 13 }}>Scribe will surface drafts here when ready</div>
            </div>
          )}

          {/* Draft content — only when loaded */}
          {!loading && !error && draft && (
            <>
              {/* Version bar */}
              <VersionBar
                versions={PLACEHOLDER_VERSIONS}
                activeVersionId={activeVersion}
                onSelectVersion={setActiveVersion}
              />

              {/* DraftFields ABOVE ToneSelector (matches mockup order) */}
              <DraftFields
                to={draft.to}
                subject={draft.subject}
                cc={draft.cc || undefined}
              />

              <ToneSelector activeTone={activeTone} onSelectTone={setActiveTone} />

              {/* Scrollable body */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', paddingTop: 12, paddingBottom: 80 }}>
                <DraftEditor
                  content={draft.content}
                  label="Draft Body"
                  meta={`Tone: ${activeTone.charAt(0).toUpperCase() + activeTone.slice(1)} · ${wordCount} words`}
                />

                {!diffApplied && (
                  <InlineDiff
                    chunks={[]}
                    onApplyAll={() => setDiffApplied(true)}
                  />
                )}
              </div>
            </>
          )}

          {/* Bottom action bar */}
          {!loading && !error && draft && (
            <div style={{
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
            }}>
              <button style={{
                padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                cursor: 'pointer',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
              }}>
                Edit Draft
              </button>
              <button
                onClick={() => invoke('api.gmail.send-draft', AGENT_ID, draft.id).catch(() => {})}
                style={{
                  padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', border: 'none',
                  background: 'var(--accent-green)',
                  color: '#000',
                }}
              >
                Approve &amp; Send
              </button>
              <button style={{
                marginLeft: 'auto',
                padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                cursor: 'pointer',
                border: '1px solid rgba(239,68,68,0.3)',
                background: 'rgba(239,68,68,0.08)',
                color: 'var(--accent-red)',
              }}>
                Reject
              </button>
            </div>
          )}
        </div>

        {/* Right rail */}
        <DraftRightRail draftId={draft?.id ?? null} />
      </div>
    </>
  );
}
