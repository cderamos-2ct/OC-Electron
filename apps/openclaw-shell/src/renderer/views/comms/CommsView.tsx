import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '../../lib/ipc-client';
import type { GmailMessage } from '../../../shared/types';

// ── CSS variable values (inline style constants) ───────────────────────
const C = {
  bg:        '#0f172a',
  bgMid:     '#131d33',
  bgCard:    '#131d33',
  border:    'rgba(241,245,249,0.14)',
  border2:   'rgba(241,245,249,0.08)',
  text:      '#f1f5f9',
  text2:     '#cbd5e1',
  text3:     '#cbd5e1',
  muted:     '#94a3b8',
  dim:       '#94a3b8',
  dimmer:    '#94a3b8',
  faint:     'rgba(241,245,249,0.2)',
  accent:    '#a3862a',
  accentBg:  'rgba(163,134,42,0.2)',
  accentBg2: 'rgba(163,134,42,0.12)',
  green:     '#2ecc71',
  yellow:    '#e0c875',
  red:       '#e74c3c',
  sidebar:   '#0e0e12',
  chrome:    '#0d0d11',
};

// ── Types ─────────────────────────────────────────────────────────────
type CommsTab = 'email' | 'imsg' | 'voicemail';

// ── Small helpers ─────────────────────────────────────────────────────

function ChanBadge({ kind, label }: { kind: string; label: string }) {
  const map: Record<string, React.CSSProperties> = {
    email:  { color: '#6ba0ff', borderColor: '#1f2d4e', background: '#111827' },
    imsg:   { color: '#6bffb0', borderColor: '#1a4a2e', background: '#101e18' },
    slack:  { color: '#c99bff', borderColor: '#2e1f4e', background: '#18101e' },
    social: { color: '#6bc8ff', borderColor: '#1a3350', background: '#101820' },
    phone:  { color: '#ffb86b', borderColor: '#4e3a1f', background: '#1e1810' },
  };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px',
      color: C.muted, background: C.border2, border: `1px solid ${C.border}`,
      borderRadius: 4, padding: '3px 8px', marginBottom: 14,
      ...(map[kind] ?? {}),
    }}>{label}</span>
  );
}

function Divider() {
  return <div style={{ height: 1, background: C.border2, margin: '16px 0' }} />;
}

// ── Skeleton loader for message list rows ─────────────────────────────
function SkeletonRow() {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.border2, flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ width: 120, height: 12, borderRadius: 4, background: C.border2 }} />
          <div style={{ width: 40, height: 12, borderRadius: 4, background: C.border2 }} />
        </div>
        <div style={{ width: '80%', height: 11, borderRadius: 4, background: C.border2, marginBottom: 5 }} />
        <div style={{ width: '60%', height: 11, borderRadius: 4, background: C.border2 }} />
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────
function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '48px 24px', gap: 12, flex: 1,
    }}>
      <div style={{ fontSize: 32, opacity: 0.5 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: C.muted, textAlign: 'center' }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: C.dimmer, textAlign: 'center', maxWidth: 220, lineHeight: 1.5 }}>{subtitle}</div>}
    </div>
  );
}

// ── Error state ───────────────────────────────────────────────────────
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '48px 24px', gap: 12, flex: 1,
    }}>
      <div style={{ fontSize: 28, opacity: 0.6 }}>⚠</div>
      <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', maxWidth: 240, lineHeight: 1.5 }}>{message}</div>
      <button onClick={onRetry} style={{
        padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
        background: 'transparent', border: `1px solid ${C.border}`, color: C.text3, fontFamily: 'inherit',
      }}>Retry</button>
    </div>
  );
}

// ── Coming soon placeholder ───────────────────────────────────────────
function ComingSoon({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', gap: 14, padding: '48px 32px',
    }}>
      <div style={{ fontSize: 40, opacity: 0.4 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 500, color: C.muted }}>{title}</div>
      <div style={{ fontSize: 12, color: C.dimmer, textAlign: 'center', maxWidth: 260, lineHeight: 1.6 }}>{description}</div>
      <div style={{
        marginTop: 8, padding: '4px 12px', borderRadius: 20,
        background: C.border2, border: `1px solid ${C.border}`,
        fontSize: 11, fontWeight: 600, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.5px',
      }}>Coming soon</div>
    </div>
  );
}

// ── Gmail message row ─────────────────────────────────────────────────

function initials(from: string): string {
  // Parse "Name <email>" or plain email
  const name = from.replace(/<[^>]+>/, '').trim();
  const parts = name.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  return '??';
}

function senderName(from: string): string {
  const match = from.match(/^([^<]+)</);
  if (match) return match[1].trim();
  const emailMatch = from.match(/([^@]+)@/);
  if (emailMatch) return emailMatch[1];
  return from;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

// Deterministic avatar background from sender string
const AVATAR_COLORS = [
  '#1f4e5e', '#1f3d2d', '#4e3d1f', '#5e1f3d', '#2d1f4e',
  '#3d2d5e', '#1f3d5e', '#5e3d1f', '#1a3050', '#1f4e3d',
];
function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function isUnread(msg: GmailMessage): boolean {
  return msg.labelIds.includes('UNREAD');
}

interface GmailRowProps {
  msg: GmailMessage;
  selected: boolean;
  onClick: () => void;
}

function GmailRow({ msg, selected, onClick }: GmailRowProps) {
  const unread = isUnread(msg);
  const name = senderName(msg.from);
  const inits = initials(msg.from);
  const bg = avatarColor(msg.from);
  const time = formatDate(msg.date);

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)',
        cursor: 'pointer', position: 'relative',
        background: selected ? '#1d1a14' : unread ? '#141418' : 'transparent',
        borderLeft: `2px solid ${selected ? C.accent : 'transparent'}`,
      }}
    >
      {unread && <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, flexShrink: 0, marginTop: 6 }} />}
      {!unread && <div style={{ width: 8, height: 8, flexShrink: 0, marginTop: 6 }} />}
      <span style={{ fontSize: 11, lineHeight: 1, marginTop: 3, flexShrink: 0, width: 14, textAlign: 'center', opacity: 0.75 }}>✉️</span>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0, marginTop: 2, color: '#fff' }}>{inits}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: unread ? 600 : 400, color: unread ? C.text : C.text3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
          <span style={{ fontSize: 11, color: unread ? C.text2 : C.dim, flexShrink: 0, fontWeight: unread ? 500 : 400 }}>{time}</span>
        </div>
        <div style={{ fontSize: 13, color: unread ? C.text2 : C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>{msg.subject || '(no subject)'}</div>
        <div style={{ fontSize: 12, color: C.dim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg.snippet}</div>
      </div>
    </div>
  );
}

// ── Email reading pane ────────────────────────────────────────────────

function EmailReadingPane({ msg }: { msg: GmailMessage | null }) {
  const pane: React.CSSProperties = { flex: 1, overflowY: 'auto', padding: '20px 28px', minWidth: 0, paddingBottom: 80 };

  if (!msg) {
    return (
      <div style={pane}>
        <EmptyState icon="✉️" title="Select a message" subtitle="Choose a message from the list to read it here." />
      </div>
    );
  }

  const name = senderName(msg.from);
  const inits = initials(msg.from);
  const bg = avatarColor(msg.from);
  const time = formatDate(msg.date);
  const unread = isUnread(msg);

  return (
    <div style={pane}>
      <ChanBadge kind="email" label="✉️ via Email" />
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 400, color: C.text, marginBottom: 12, lineHeight: 1.3 }}>
          {msg.subject || '(no subject)'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600, flexShrink: 0, background: bg, color: '#fff' }}>{inits}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{name}</div>
            <div style={{ fontSize: 12, color: C.dim }}>to {msg.to || 'me'}</div>
          </div>
          <div style={{ fontSize: 12, color: C.dim, marginLeft: 'auto' }}>{time}</div>
        </div>
        {/* Labels */}
        {msg.labelIds.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
            {msg.labelIds.filter(l => !['INBOX', 'UNREAD', 'CATEGORY_PERSONAL', 'CATEGORY_PROMOTIONS', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS', 'CATEGORY_SOCIAL'].includes(l)).map(l => (
              <span key={l} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: C.border2, color: C.muted, border: `1px solid ${C.border}` }}>{l}</span>
            ))}
          </div>
        )}
        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[{ label: '↩ Reply', primary: true }, { label: '↪ Forward' }, { label: '⋮' }].map((a, i) => (
            <button key={i} style={{
              padding: '7px 16px', borderRadius: 6, fontSize: 12, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 6,
              background: a.primary ? C.accent : 'transparent',
              border: `1px solid ${a.primary ? C.accent : C.border}`,
              color: a.primary ? '#fff' : C.text3,
            }}>{a.label}</button>
          ))}
          {unread && (
            <span style={{ marginLeft: 'auto', fontSize: 10, padding: '3px 8px', borderRadius: 4, background: C.accentBg2, color: '#ff9b7b', border: '1px solid #4d1f15', alignSelf: 'center' }}>Unread</span>
          )}
        </div>
      </div>
      <Divider />
      {/* Body */}
      {msg.body ? (
        <div style={{ fontSize: 14, lineHeight: 1.75, color: C.text2 }}>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{msg.body}</pre>
        </div>
      ) : (
        <div style={{ fontSize: 14, lineHeight: 1.75, color: C.text2 }}>
          <p style={{ marginBottom: 14, fontStyle: 'italic', color: C.muted }}>{msg.snippet}</p>
          <p style={{ color: C.dimmer, fontSize: 12 }}>Full message body not loaded. This is a preview.</p>
        </div>
      )}
    </div>
  );
}

// ── Agent Toolbar ─────────────────────────────────────────────────────
function AgentToolbar({ onReviewDrafts, msgCount }: { onReviewDrafts: () => void; msgCount: number }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: 52,
      background: 'rgba(14,14,18,0.88)', backdropFilter: 'blur(12px)',
      borderTop: '1px solid rgba(232,93,58,0.35)',
      display: 'flex', alignItems: 'center', padding: '0 16px',
      zIndex: 20, boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginRight: 16 }}>
        <div style={{ position: 'relative', width: 38, height: 28 }}>
          <div style={{ position: 'absolute', left: 0, top: 0, zIndex: 2, width: 28, height: 28, borderRadius: 7, background: '#5e1f2d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, border: '1px solid rgba(0,0,0,0.5)' }}>
            🌹
            <div style={{ position: 'absolute', bottom: -2, right: -2, width: 8, height: 8, borderRadius: '50%', background: C.green, border: '2px solid #0e0e12' }} />
          </div>
          <div style={{ position: 'absolute', left: 12, top: 0, zIndex: 1, opacity: 0.85, width: 28, height: 28, borderRadius: 7, background: '#1f3d5e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, border: '1px solid rgba(0,0,0,0.5)' }}>🌈</div>
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', marginLeft: 14 }}>Karoline + Iris</span>
      </div>
      <div style={{ width: 1, height: 24, background: C.border, margin: '0 14px', flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: 12, color: C.text3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
        {msgCount > 0 ? (
          <>
            <span style={{ color: C.accent, fontWeight: 500 }}>{msgCount} messages</span>
            <span style={{ color: C.border, margin: '0 4px' }}>·</span>
            <span>Email inbox connected</span>
          </>
        ) : (
          <span style={{ color: C.muted }}>Karoline is monitoring your inbox</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 14 }}>
        <button onClick={onReviewDrafts} style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', border: 'none', fontFamily: 'inherit', background: C.accent, color: '#fff' }}>Review Drafts</button>
        <button style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', border: 'none', fontFamily: 'inherit', background: C.border, color: C.text3 }}>Triage Settings</button>
        <button style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', border: `1px solid ${C.border}`, color: C.muted }}>Pause Agents</button>
      </div>
    </div>
  );
}

// ── Right Rail ────────────────────────────────────────────────────────
function RightRail() {
  const tabs = ['🧠', '🌹', '🌈', '📡', '⏳', '🏛️', '🔮', '🏠'];
  return (
    <div style={{ width: 280, minWidth: 240, background: C.sidebar, borderLeft: `1px solid ${C.border2}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: '8px 6px', borderBottom: `1px solid ${C.border2}` }}>
        {tabs.map((t, i) => (
          <div key={i} style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, cursor: 'pointer', position: 'relative', background: i === 1 ? C.border2 : 'transparent', border: `1px solid ${i === 1 ? C.border : 'transparent'}` }}>
            {t}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: `1px solid ${C.border2}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#5e1f2d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🌹</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Karoline</div>
            <div style={{ fontSize: 11, color: C.dim }}>Comms Commander</div>
          </div>
        </div>
        <div style={{ fontSize: 10, fontWeight: 600, color: C.green, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ background: C.accentBg, border: `1px solid ${C.accent}`, borderRadius: 8, padding: '10px 12px', fontSize: 12, color: C.text2, lineHeight: 1.6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: C.accent, marginBottom: 4 }}>🌹 COMMS SUMMARY</div>
          Gmail inbox connected<br />
          Monitoring for new messages
        </div>
        <div style={{ background: C.border2, borderRadius: 8, padding: '10px 12px', fontSize: 12, color: C.text2, lineHeight: 1.6 }}>
          <strong style={{ color: C.text }}>Karoline</strong><br />
          Your Gmail inbox is live. I'll triage incoming messages, flag urgent ones, and prepare draft replies for your review.
        </div>
      </div>
      <div style={{ padding: '10px 12px', borderTop: `1px solid ${C.border2}`, flexShrink: 0 }}>
        <input type="text" placeholder="Message Karoline or Iris..." style={{ width: '100%', background: '#141418', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: C.text2, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
      </div>
    </div>
  );
}

// ── Email tab ─────────────────────────────────────────────────────────

interface EmailTabState {
  status: 'idle' | 'loading' | 'loaded' | 'error';
  messages: GmailMessage[];
  error: string | null;
  selectedId: string | null;
  selectedMsg: GmailMessage | null;
  loadingDetail: boolean;
}

function EmailTab({ agentId }: { agentId: string }) {
  const [state, setState] = useState<EmailTabState>({
    status: 'idle',
    messages: [],
    error: null,
    selectedId: null,
    selectedMsg: null,
    loadingDetail: false,
  });
  const [showDrafts, setShowDrafts] = useState(false);

  const loadMessages = useCallback(async () => {
    setState(s => ({ ...s, status: 'loading', error: null }));
    try {
      const result = await invoke('api.gmail.list', agentId, 'in:inbox', 50);
      const msgs = (result as GmailMessage[]) ?? [];
      setState(s => ({
        ...s, status: 'loaded', messages: msgs,
        selectedId: msgs.length > 0 ? msgs[0].id : null,
        selectedMsg: msgs.length > 0 ? msgs[0] : null,
      }));
    } catch (err) {
      setState(s => ({ ...s, status: 'error', error: String(err) }));
    }
  }, [agentId]);

  useEffect(() => { void loadMessages(); }, [loadMessages]);

  const handleSelect = useCallback(async (msg: GmailMessage) => {
    // Optimistically show the message from list data
    setState(s => ({ ...s, selectedId: msg.id, selectedMsg: msg, loadingDetail: true }));
    try {
      const detail = await invoke('api.gmail.get', agentId, msg.id);
      setState(s => ({ ...s, selectedMsg: detail as GmailMessage, loadingDetail: false }));
    } catch {
      setState(s => ({ ...s, loadingDetail: false }));
    }
  }, [agentId]);

  const { status, messages, error, selectedId, selectedMsg, loadingDetail } = state;

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minWidth: 0 }}>
      {/* List pane */}
      <div style={{ width: 380, minWidth: 280, borderRight: `1px solid ${C.border2}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
        {/* List header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: `1px solid ${C.border2}`, flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 400, color: C.text }}>
            Inbox
            {status === 'loaded' && messages.length > 0 && (
              <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>{messages.length}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <div
              onClick={() => void loadMessages()}
              style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: C.muted, cursor: 'pointer' }}
            >↻</div>
            <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: C.muted, cursor: 'pointer' }}>⋮</div>
          </div>
        </div>
        {/* Rows */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {status === 'loading' && (
            Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
          )}
          {status === 'error' && (
            <ErrorState message={error ?? 'Failed to load messages'} onRetry={loadMessages} />
          )}
          {status === 'loaded' && messages.length === 0 && (
            <EmptyState icon="📭" title="No messages" subtitle="Your inbox is empty or Gmail is not connected." />
          )}
          {status === 'loaded' && messages.map(m => (
            <GmailRow
              key={m.id}
              msg={m}
              selected={m.id === selectedId}
              onClick={() => void handleSelect(m)}
            />
          ))}
        </div>
      </div>

      {/* Reading pane */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, position: 'relative' }}>
        {loadingDetail ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
            <div style={{ width: 80, height: 18, borderRadius: 4, background: C.border2, marginBottom: 20 }} />
            <div style={{ width: '70%', height: 24, borderRadius: 4, background: C.border2, marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.border2 }} />
              <div>
                <div style={{ width: 120, height: 13, borderRadius: 4, background: C.border2, marginBottom: 6 }} />
                <div style={{ width: 80, height: 11, borderRadius: 4, background: C.border2 }} />
              </div>
            </div>
            <div style={{ height: 1, background: C.border2, margin: '16px 0' }} />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ width: `${80 - i * 8}%`, height: 13, borderRadius: 4, background: C.border2, marginBottom: 10 }} />
            ))}
          </div>
        ) : (
          <EmailReadingPane msg={selectedMsg} />
        )}
        {showDrafts && (
          <div style={{ position: 'absolute', bottom: 60, right: 16, width: 320, background: '#131318', border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px', zIndex: 50, boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Pending Drafts</span>
              <button onClick={() => setShowDrafts(false)} style={{ background: 'transparent', border: 'none', color: C.dimmer, cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <EmptyState icon="📝" title="No drafts yet" subtitle="Karoline will prepare drafts for your review here." />
          </div>
        )}
        <AgentToolbar onReviewDrafts={() => setShowDrafts(v => !v)} msgCount={messages.length} />
      </div>
    </div>
  );
}

// ── Root export ───────────────────────────────────────────────────────
export function CommsView() {
  const [activeNav, setActiveNav] = useState('inbox');
  const [activeTab, setActiveTab] = useState<CommsTab>('email');

  // The Gmail API worker uses 'karoline' agent by convention
  const GMAIL_AGENT_ID = 'karoline';

  const subtabs: Array<{ key: CommsTab; label: string; icon: string }> = [
    { key: 'email', label: 'Email', icon: '✉️' },
    { key: 'imsg', label: 'iMessage', icon: '💬' },
    { key: 'voicemail', label: 'Voicemail', icon: '📞' },
  ];

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', background: C.bg, overflow: 'hidden' }}>

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', background: C.bgMid, minWidth: 0 }}>

        {/* Browser chrome */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', height: 36, background: C.chrome, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {['←', '→', '↻'].map((b, i) => (
              <div key={i} style={{ width: 24, height: 24, borderRadius: 5, background: 'transparent', border: `1px solid ${C.border2}`, color: C.dimmer, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>{b}</div>
            ))}
          </div>
          <div style={{ flex: 1, background: '#1a1a1e', border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 12px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: C.green, fontSize: 10 }}>🔒</span>
            <span style={{ color: C.muted }}>comms.aegilume.local</span>
          </div>
        </div>

        {/* Comms app */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Sidebar */}
          <div style={{ width: 200, minWidth: 200, background: C.sidebar, borderRight: `1px solid ${C.border2}`, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '8px 0', flexShrink: 0 }}>
            <button style={{ margin: '8px 12px 16px', padding: '10px 16px', borderRadius: 20, background: '#3c1e17', border: `1px solid ${C.accent}`, color: C.text, fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}>
              <span style={{ fontSize: 16 }}>✏</span> Compose
            </button>

            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: C.faint, padding: '12px 16px 4px' }}>Inboxes</div>
            {[
              { id: 'inbox', label: 'All Inbound', icon: '📥' },
              { id: 'reply', label: 'Needs Reply', icon: '↩' },
              { id: 'flagged', label: 'Flagged', icon: '⚑' },
            ].map(n => (
              <div key={n.id} onClick={() => setActiveNav(n.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px', fontSize: 13, cursor: 'pointer', borderRadius: '0 20px 20px 0', marginRight: 8, whiteSpace: 'nowrap', background: activeNav === n.id ? C.accentBg : 'transparent', color: activeNav === n.id ? C.text : C.text3 }}>
                <span style={{ width: 18, textAlign: 'center', fontSize: 14, flexShrink: 0 }}>{n.icon}</span>
                {n.label}
              </div>
            ))}

            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: C.faint, padding: '12px 16px 4px' }}>Channels</div>
            {[
              { id: 'ch-email', label: 'Email', icon: '➕' },
              { id: 'ch-imsg', label: 'iMessage', icon: '💬' },
              { id: 'ch-slack', label: 'Slack', icon: '👔' },
              { id: 'ch-social', label: 'Social DMs', icon: '🌐' },
              { id: 'ch-phone', label: 'Phone', icon: '📞' },
            ].map(n => (
              <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px', fontSize: 13, color: C.text3, cursor: 'pointer', borderRadius: '0 20px 20px 0', marginRight: 8, whiteSpace: 'nowrap' }}>
                <span style={{ width: 18, textAlign: 'center', fontSize: 14, flexShrink: 0 }}>{n.icon}</span>
                {n.label}
              </div>
            ))}

            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: C.faint, padding: '12px 16px 4px' }}>Labels</div>
            {[
              { id: 'lbl-inv', label: 'Investors', dot: '#4a9fff' },
              { id: 'lbl-act', label: 'Action Required', dot: '#ff8888' },
              { id: 'lbl-tri', label: 'Triaged', dot: '#6bffb0' },
            ].map(n => (
              <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px', fontSize: 13, color: C.text3, cursor: 'pointer', borderRadius: '0 20px 20px 0', marginRight: 8, whiteSpace: 'nowrap' }}>
                <span style={{ width: 18, textAlign: 'center', fontSize: 14, flexShrink: 0, color: n.dot }}>⬤</span>
                {n.label}
              </div>
            ))}
          </div>

          {/* Main (tabs + content) */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '8px 16px 0', borderBottom: `1px solid ${C.border2}`, background: C.sidebar, flexShrink: 0 }}>
              {subtabs.map(t => (
                <div
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 14px 8px', fontSize: 12, cursor: 'pointer',
                    flexShrink: 0, whiteSpace: 'nowrap', marginBottom: -1,
                    borderBottom: `2px solid ${activeTab === t.key ? C.accent : 'transparent'}`,
                    color: activeTab === t.key ? C.text : C.muted,
                    fontWeight: activeTab === t.key ? 500 : 400,
                  }}
                >
                  <span style={{ fontSize: 11 }}>{t.icon}</span>
                  {t.label}
                </div>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {activeTab === 'email' && (
                <EmailTab agentId={GMAIL_AGENT_ID} />
              )}
              {activeTab === 'imsg' && (
                <ComingSoon
                  icon="💬"
                  title="iMessage not connected"
                  description="Connect your iMessage account to view and reply to messages directly from Aegilume."
                />
              )}
              {activeTab === 'voicemail' && (
                <ComingSoon
                  icon="📞"
                  title="Voicemail not connected"
                  description="Link your phone to access voicemails, transcripts, and call logs in one place."
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Rail */}
      <RightRail />
    </div>
  );
}
