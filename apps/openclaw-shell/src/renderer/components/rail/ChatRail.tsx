import React, { useCallback, useRef, useState } from 'react';
import { useShellStore } from '../../stores/shell-store';
import { RAIL_MIN_WIDTH, RAIL_MAX_WIDTH } from '../../../shared/constants';
import { useChat } from '../../hooks/use-chat';
import { useGateway } from '../../hooks/use-gateway';
import { useTasks } from '../../hooks/use-tasks';
import { ChatThread } from './ChatThread';
import { ChatComposer } from './ChatComposer';
import { ApprovalCard } from './ApprovalCard';

// ---- Agent avatar tabs ------------------------------------------------------

const AGENT_TABS = [
  { emoji: '\u{1F9E0}', label: 'CD', role: 'Chief of Staff' },
  { emoji: '\u{1F6E1}\uFE0F', label: 'Karoline', role: 'Comms Commander' },
  { emoji: '\u{1F308}', label: 'Iris', role: 'Creative Director' },
  { emoji: '\u{1F4E1}', label: 'Hermes', role: 'People Intelligence' },
  { emoji: '\u23F3', label: 'Kronos', role: 'Calendar' },
  { emoji: '\u{1F3DB}\uFE0F', label: 'Marcus', role: 'Finance' },
  { emoji: '\u{1F52E}', label: 'Ada', role: 'Knowledge' },
  { emoji: '\u{1F3E0}', label: 'Vesta', role: 'Personal' },
];

// ---- ChatRail component -----------------------------------------------------

export function ChatRail() {
  const railVisible = useShellStore((s) => s.railVisible);
  const railWidth = useShellStore((s) => s.railWidth);
  const setRailWidth = useShellStore((s) => s.setRailWidth);

  const { messages, loading, sendMessage } = useChat();
  const { connectionState, isConnected } = useGateway();
  const { needsChristianTasks } = useTasks();

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

  const currentAgent = AGENT_TABS[activeAgent];

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
                gap: '6px',
                padding: '10px 12px',
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
                    borderRadius: '8px',
                    border: i === activeAgent ? '1px solid var(--accent)' : '1px solid transparent',
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
                </button>
              ))}
            </div>

            {/* Rail header — dynamic based on selected agent */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderBottom: '1px solid var(--border)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    flexShrink: 0,
                  }}
                >
                  {currentAgent.emoji}
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>
                    {currentAgent.label}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    {currentAgent.role}
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '12px',
                  color: statusColor,
                  fontWeight: 500,
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

            {/* Needs attention card — data-driven from tasks */}
            {needsChristianTasks.length > 0 && (
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
                    fontSize: '10px',
                    fontWeight: 700,
                    color: 'var(--accent)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '6px',
                  }}
                >
                  &#9889; {needsChristianTasks.length} item{needsChristianTasks.length !== 1 ? 's' : ''} need{needsChristianTasks.length === 1 ? 's' : ''} you
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: '1.7' }}>
                  {needsChristianTasks.slice(0, 5).map((t) => (
                    <div key={t.id}>
                      &bull; {t.id.toUpperCase()}: {t.title}
                    </div>
                  ))}
                  {needsChristianTasks.length > 5 && (
                    <div style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '4px' }}>
                      + {needsChristianTasks.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Chat messages area — live gateway messages only */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              {/* Empty state when no messages */}
              {messages.length === 0 && !loading && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 1,
                    gap: '8px',
                    color: 'var(--muted)',
                    fontSize: '13px',
                    textAlign: 'center',
                    padding: '20px',
                  }}
                >
                  <span style={{ fontSize: '24px' }}>{currentAgent.emoji}</span>
                  <span>No messages yet</span>
                  <span style={{ fontSize: '11px', color: 'var(--dimmer)' }}>
                    Send a message to start chatting with {currentAgent.label}
                  </span>
                </div>
              )}

              {/* Live chat thread from gateway */}
              <ChatThread messages={messages} loading={loading} />
            </div>

            {/* Composer input */}
            <div
              style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--border)',
                flexShrink: 0,
              }}
            >
              <input
                type="text"
                placeholder={`Message ${currentAgent.label}...`}
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
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
