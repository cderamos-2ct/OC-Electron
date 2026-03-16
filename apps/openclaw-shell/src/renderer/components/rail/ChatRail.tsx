import React, { useCallback, useRef, useState } from 'react';
import { useShellStore } from '../../stores/shell-store';
import { RAIL_MIN_WIDTH, RAIL_MAX_WIDTH } from '../../../shared/constants';
import { useChat } from '../../hooks/use-chat';
import { useGateway } from '../../hooks/use-gateway';
import { ChatThread } from './ChatThread';
import { ChatComposer } from './ChatComposer';
import { ApprovalCard } from './ApprovalCard';

// ---- Agent avatar tabs (matching mockup) ------------------------------------

const AGENT_TABS = [
  { emoji: '\u{1F9E0}', label: 'CD', active: true },
  { emoji: '\u{1F6E1}\uFE0F', label: 'Karoline', badge: 3 },
  { emoji: '\u{1F308}', label: 'Iris' },
  { emoji: '\u{1F4E1}', label: 'Hermes' },
  { emoji: '\u23F3', label: 'Kronos' },
  { emoji: '\u{1F3DB}\uFE0F', label: 'Marcus' },
  { emoji: '\u{1F52E}', label: 'Ada' },
  { emoji: '\u{1F3E0}', label: 'Vesta' },
];

// ---- Chat messages (matching mockup) ----------------------------------------

interface MockMessage {
  label: string;
  text: React.ReactNode;
  time: string;
  actions?: Array<{ label: string; variant: 'primary' | 'secondary' }>;
}

const MOCK_MESSAGES: MockMessage[] = [
  {
    label: 'CD',
    text: (
      <>
        Good morning! I&rsquo;ve prepared your daily brief. 47 emails triaged overnight &mdash; 4
        items need your attention. The investor email from Marcus Chen looks time-sensitive.
      </>
    ),
    time: '8:42 AM',
  },
  {
    label: 'CD',
    text: (
      <>
        Hermes flagged Lynn Nelson &mdash; risk score went from moderate to high overnight. Kyle sold
        him another project without clearing the backlog. Want me to have Karoline draft the pipeline
        review?
      </>
    ),
    time: '8:44 AM',
    actions: [
      { label: 'Yes, draft it', variant: 'primary' },
      { label: "I'll handle", variant: 'secondary' },
    ],
  },
  {
    label: 'CD',
    text: (
      <>
        Your 10am Investor sync has a prep brief ready. Kronos detected a 4:30 conflict &mdash;
        PrintDeed and VG standup overlap. Which should I move?
      </>
    ),
    time: '8:45 AM',
    actions: [
      { label: 'Move PrintDeed', variant: 'primary' },
      { label: 'Move VG', variant: 'secondary' },
    ],
  },
];

// ---- ChatRail component -----------------------------------------------------

export function ChatRail() {
  const railVisible = useShellStore((s) => s.railVisible);
  const railWidth = useShellStore((s) => s.railWidth);
  const setRailWidth = useShellStore((s) => s.setRailWidth);

  const { messages, loading, sendMessage } = useChat();
  const { connectionState, isConnected } = useGateway();

  const [activeAgent, setActiveAgent] = useState(0);
  const [inputValue, setInputValue] = useState('');

  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  // ---- Resize drag handlers -------------------------------------------------

  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true;
      dragStartX.current = e.clientX;
      dragStartWidth.current = railWidth;
      e.preventDefault();

      const onMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const delta = dragStartX.current - ev.clientX;
        const next = Math.min(
          RAIL_MAX_WIDTH,
          Math.max(RAIL_MIN_WIDTH, dragStartWidth.current + delta),
        );
        setRailWidth(next);
      };

      const onMouseUp = () => {
        isDragging.current = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [railWidth, setRailWidth],
  );

  // ---- Status ---------------------------------------------------------------

  const statusColor =
    connectionState === 'connected'
      ? 'var(--green)'
      : connectionState === 'connecting' || connectionState === 'authenticating'
      ? 'var(--yellow)'
      : 'var(--muted)';

  const statusText =
    connectionState === 'connected'
      ? 'Online'
      : connectionState === 'connecting' || connectionState === 'authenticating'
      ? 'Connecting...'
      : 'Offline';

  // ---- Render ---------------------------------------------------------------

  return (
    <div
      style={{
        width: railVisible ? `${railWidth}px` : '0px',
        minWidth: railVisible ? `${RAIL_MIN_WIDTH}px` : '0px',
        maxWidth: `${RAIL_MAX_WIDTH}px`,
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        flexShrink: 0,
        background: 'var(--bg-mid)',
        borderLeft: railVisible ? '1px solid var(--border)' : 'none',
        position: 'relative',
        overflow: 'hidden',
        transition: 'width 0.2s ease, min-width 0.2s ease',
      }}
    >
      {railVisible && (
        <>
          {/* Resize handle */}
          <div
            onMouseDown={onDragStart}
            style={{
              width: '4px',
              cursor: 'col-resize',
              background: 'transparent',
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'rgba(241,245,249,0.1)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'transparent';
            }}
          />

          {/* Rail content */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              minWidth: 0,
            }}
          >
            {/* Agent avatar tabs */}
            <div
              style={{
                display: 'flex',
                gap: '4px',
                padding: '8px 12px',
                borderBottom: '1px solid var(--border)',
                overflowX: 'auto',
                scrollbarWidth: 'none',
                flexShrink: 0,
              }}
            >
              {AGENT_TABS.map((tab, i) => (
                <button
                  key={tab.label}
                  onClick={() => setActiveAgent(i)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    border: i === activeAgent ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: i === activeAgent ? 'var(--accent-bg)' : 'transparent',
                    cursor: 'pointer',
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    position: 'relative',
                    padding: 0,
                  }}
                  title={tab.label}
                >
                  {tab.emoji}
                  {tab.badge != null && tab.badge > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        fontSize: '8px',
                        fontWeight: 700,
                        color: '#fff',
                        backgroundColor: 'var(--red)',
                        borderRadius: '6px',
                        padding: '1px 4px',
                        lineHeight: '11px',
                      }}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Rail header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderBottom: '1px solid var(--border)',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--accent-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  flexShrink: 0,
                }}
              >
                {AGENT_TABS[activeAgent].emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text)',
                  }}
                >
                  CD &mdash; Chief of Staff
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '11px',
                  color: statusColor,
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: statusColor,
                    flexShrink: 0,
                  }}
                />
                {statusText}
              </div>
            </div>

            {/* Offline banner */}
            {!isConnected && connectionState !== 'connecting' && connectionState !== 'authenticating' && (
              <div
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'rgba(163,134,42,0.3)',
                  borderBottom: '1px solid var(--border)',
                  color: 'var(--yellow)',
                  fontSize: '11px',
                  textAlign: 'center',
                  flexShrink: 0,
                }}
              >
                Gateway offline &mdash; reconnecting...
              </div>
            )}

            {/* Approval queue */}
            <ApprovalCard />

            {/* NEEDS CHRISTIAN card */}
            <div
              style={{
                margin: '10px 12px',
                padding: '12px 14px',
                border: '1px solid var(--accent)',
                borderRadius: '8px',
                backgroundColor: 'var(--accent-bg)',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--yellow)',
                  letterSpacing: '0.06em',
                  marginBottom: '8px',
                }}
              >
                &#9889; NEEDS CHRISTIAN
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: '1.7' }}>
                &bull; OPS-019: Budget approval
                <br />
                &bull; OPS-024: Investor reply
                <br />
                &bull; Nashville flights not booked
              </div>
            </div>

            {/* Chat messages area */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              {MOCK_MESSAGES.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: 'var(--bg)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--accent)',
                      marginBottom: '4px',
                    }}
                  >
                    {msg.label}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-2)',
                      lineHeight: '1.6',
                      marginBottom: msg.actions ? '8px' : '4px',
                    }}
                  >
                    {msg.text}
                  </div>
                  {msg.actions && (
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                      {msg.actions.map((action) => (
                        <button
                          key={action.label}
                          style={{
                            padding: '4px 12px',
                            borderRadius: '5px',
                            border:
                              action.variant === 'primary'
                                ? 'none'
                                : '1px solid var(--border)',
                            background:
                              action.variant === 'primary'
                                ? 'var(--accent)'
                                : 'transparent',
                            color:
                              action.variant === 'primary'
                                ? '#fff'
                                : 'var(--text-2)',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{msg.time}</div>
                </div>
              ))}

              {/* Live chat thread from gateway (below mock messages) */}
              <ChatThread messages={messages} loading={loading} />
            </div>

            {/* Composer input */}
            <div
              style={{
                padding: '10px 12px',
                borderTop: '1px solid var(--border)',
                flexShrink: 0,
              }}
            >
              <input
                type="text"
                placeholder="Message CD..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && inputValue.trim()) {
                    sendMessage(inputValue.trim());
                    setInputValue('');
                  }
                }}
                disabled={!isConnected}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
