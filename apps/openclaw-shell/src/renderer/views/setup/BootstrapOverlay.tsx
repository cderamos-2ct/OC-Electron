import React, { useEffect, useState, useRef } from 'react';

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg:       'var(--bg, #0f172a)',
  bgCard:   'var(--bg-card, #131d33)',
  border:   'var(--border, rgba(241,245,249,0.14))',
  text:     'var(--text, #f1f5f9)',
  text2:    'var(--text-2, #cbd5e1)',
  muted:    'var(--muted, #94a3b8)',
  accent:   'var(--accent, #a3862a)',
  accentBg: 'var(--accent-bg, rgba(163,134,42,0.15))',
  green:    '#2ecc71',
  red:      '#e74c3c',
};

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentBootStatus = 'waiting' | 'syncing' | 'ready' | 'skipped' | 'error';

interface AgentBootState {
  id: string;
  displayName: string;
  emoji: string;
  role: string;
  status: AgentBootStatus;
  detail: string;
}

export interface BootstrapConfig {
  userName: string;
  enabledServices: string[];
  agents: Array<{
    id: string;
    displayName: string;
    emoji: string;
    role: string;
    enabled: boolean;
  }>;
}

interface BootstrapOverlayProps {
  config: BootstrapConfig;
  onComplete: () => void;
}

// ─── Agent → IPC mapping ─────────────────────────────────────────────────────
// Maps agent IDs to the IPC calls they need to bootstrap initial data.

interface BootTask {
  agentId: string;
  label: string;
  invoke: () => Promise<unknown>;
}

function buildBootTasks(enabledServices: string[]): BootTask[] {
  const tasks: BootTask[] = [];
  const api = window.electronAPI;

  // Gmail — if gmail service is enabled
  if (enabledServices.includes('gmail')) {
    tasks.push({
      agentId: 'comms',
      label: 'Pulling inbox...',
      invoke: () => api.invoke('api.gmail.list', 'comms', 'in:inbox', 25),
    });
  }

  // Calendar — if google-calendar is enabled
  if (enabledServices.includes('google-calendar')) {
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    tasks.push({
      agentId: 'calendar',
      label: 'Loading calendar...',
      invoke: () => api.invoke('api.calendar.list', 'calendar', now.toISOString(), weekEnd.toISOString()),
    });
  }

  // GitHub — if github is enabled
  if (enabledServices.includes('github')) {
    tasks.push({
      agentId: 'build',
      label: 'Fetching notifications...',
      invoke: () => api.invoke('api.github.notifications', 'build', false),
    });
  }

  // Gateway connection check — always (for CD)
  tasks.push({
    agentId: 'cd',
    label: 'Connecting to gateway...',
    invoke: () => api.invoke('gateway:rpc', 'status'),
  });

  return tasks;
}

// ─── Spinner SVG ──────────────────────────────────────────────────────────────

function Spinner({ size = 14, color = C.accent }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Status icon ──────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: AgentBootStatus }) {
  switch (status) {
    case 'waiting':
      return <div style={{ width: 14, height: 14, borderRadius: '50%', border: `1.5px solid ${C.border}` }} />;
    case 'syncing':
      return <Spinner />;
    case 'ready':
      return (
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
            <path d="M1 3L3 5L7 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      );
    case 'skipped':
      return <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(241,245,249,0.08)', border: `1px solid ${C.border}` }} />;
    case 'error':
      return <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(231,76,60,0.2)', border: `1px solid ${C.red}` }} />;
  }
}

// ─── BootstrapOverlay ─────────────────────────────────────────────────────────

const MIN_DISPLAY_MS = 2500; // minimum time to show the overlay (UX polish)
const TASK_TIMEOUT_MS = 8000; // timeout per agent task

export function BootstrapOverlay({ config, onComplete }: BootstrapOverlayProps) {
  const [agentStates, setAgentStates] = useState<AgentBootState[]>(() => {
    return config.agents
      .filter(a => a.enabled)
      .map(a => ({
        id: a.id,
        displayName: a.displayName,
        emoji: a.emoji,
        role: a.role,
        status: 'waiting' as AgentBootStatus,
        detail: 'Standing by...',
      }));
  });

  const [overallProgress, setOverallProgress] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);
  const startTime = useRef(Date.now());
  const hasCompleted = useRef(false);

  // Update a single agent's state
  const updateAgent = (id: string, patch: Partial<AgentBootState>) => {
    setAgentStates(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  };

  // Run bootstrap tasks
  useEffect(() => {
    const tasks = buildBootTasks(config.enabledServices);
    const enabledIds = new Set(config.agents.filter(a => a.enabled).map(a => a.id));
    let completed = 0;
    const total = enabledIds.size;

    // Mark agents that have no boot task as "ready" immediately (they just need gateway)
    const agentsWithTasks = new Set(tasks.map(t => t.agentId));

    // Stagger agent initialization for visual effect
    const runTasks = async () => {
      // First, mark agents without specific tasks
      for (const id of enabledIds) {
        if (!agentsWithTasks.has(id)) {
          // Small delay for visual stagger
          await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
          updateAgent(id, { status: 'syncing', detail: 'Initializing...' });
          await new Promise(r => setTimeout(r, 400 + Math.random() * 600));
          updateAgent(id, { status: 'ready', detail: 'Ready' });
          completed++;
          setOverallProgress(Math.round((completed / total) * 100));
        }
      }

      // Then run actual IPC tasks
      for (const task of tasks) {
        if (!enabledIds.has(task.agentId)) continue;

        updateAgent(task.agentId, { status: 'syncing', detail: task.label });

        try {
          const result = await Promise.race([
            task.invoke(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TASK_TIMEOUT_MS)),
          ]);

          // Check for error responses
          const r = result as Record<string, unknown> | undefined;
          if (r && 'error' in r) {
            updateAgent(task.agentId, { status: 'ready', detail: 'Connected (no data yet)' });
          } else {
            updateAgent(task.agentId, { status: 'ready', detail: 'Synced' });
          }
        } catch {
          // Non-fatal — agent just won't have initial data
          updateAgent(task.agentId, { status: 'ready', detail: 'Will sync when available' });
        }

        completed++;
        setOverallProgress(Math.round((completed / total) * 100));

        // Small stagger between tasks
        await new Promise(r => setTimeout(r, 150));
      }

      // All done — respect minimum display time
      const elapsed = Date.now() - startTime.current;
      const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);
      await new Promise(r => setTimeout(r, remaining));

      if (!hasCompleted.current) {
        hasCompleted.current = true;
        setFadingOut(true);
        setTimeout(onComplete, 500); // fade-out duration
      }
    };

    // Small initial delay so the overlay renders first
    const timer = setTimeout(() => { void runTasks(); }, 400);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const readyCount = agentStates.filter(a => a.status === 'ready').length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: C.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        opacity: fadingOut ? 0 : 1,
        transition: 'opacity 0.5s ease',
      }}
    >
      {/* Subtle glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 50% 35% at 50% 50%, rgba(163,134,42,0.04) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 520,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 32,
          padding: '48px 40px',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h1
            style={{
              fontFamily: "'Cinzel', serif",
              fontSize: 22,
              fontWeight: 700,
              color: C.text,
              margin: 0,
              letterSpacing: '0.04em',
            }}
          >
            Booting Your Team
          </h1>
          <p style={{ fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.6 }}>
            Your agents are pulling in your data so everything is ready when you arrive.
          </p>
        </div>

        {/* Progress bar */}
        <div style={{ width: '100%', maxWidth: 360 }}>
          <div
            style={{
              height: 3,
              borderRadius: 2,
              background: 'rgba(241,245,249,0.06)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${overallProgress}%`,
                background: `linear-gradient(90deg, ${C.accent}, ${C.green})`,
                borderRadius: 2,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 6,
              fontSize: 10,
              color: C.muted,
            }}
          >
            <span>{readyCount} of {agentStates.length} agents ready</span>
            <span>{overallProgress}%</span>
          </div>
        </div>

        {/* Agent status list */}
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {agentStates.map((agent, i) => (
            <div
              key={agent.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 16px',
                borderBottom: i < agentStates.length - 1 ? `1px solid rgba(241,245,249,0.06)` : 'none',
                opacity: agent.status === 'waiting' ? 0.4 : 1,
                transition: 'opacity 0.3s ease',
              }}
            >
              {/* Emoji */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: agent.status === 'ready' ? 'rgba(46,204,113,0.1)' : C.accentBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  flexShrink: 0,
                  transition: 'background 0.3s ease',
                }}
              >
                {agent.emoji}
              </div>

              {/* Name + detail */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                  {agent.displayName}
                  <span style={{ fontWeight: 400, color: C.muted, fontSize: 10, marginLeft: 6 }}>
                    {agent.role}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: agent.status === 'ready' ? C.green : C.muted,
                    marginTop: 1,
                    transition: 'color 0.2s',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {agent.detail}
                </div>
              </div>

              {/* Status indicator */}
              <StatusIcon status={agent.status} />
            </div>
          ))}
        </div>

        {/* Subtle footer */}
        <p style={{ fontSize: 11, color: 'rgba(241,245,249,0.25)', margin: 0, textAlign: 'center' }}>
          This only takes a moment. Your agents will continue syncing in the background.
        </p>
      </div>

      {/* Inject spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
