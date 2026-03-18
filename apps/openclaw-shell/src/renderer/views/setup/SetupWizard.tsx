import React, { useState, useCallback, useRef, useEffect } from 'react';

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg:       'var(--bg, #0f172a)',
  bgCard:   'var(--bg-card, #131d33)',
  bgMid:    'var(--bg-mid, #131d33)',
  border:   'var(--border, rgba(241,245,249,0.14))',
  border2:  'rgba(241,245,249,0.06)',
  text:     'var(--text, #f1f5f9)',
  text2:    'var(--text-2, #cbd5e1)',
  muted:    'var(--muted, #94a3b8)',
  accent:   'var(--accent, #a3862a)',
  accentBg: 'var(--accent-bg, rgba(163,134,42,0.15))',
  accentHover: 'rgba(163,134,42,0.9)',
  green:    '#2ecc71',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SetupAgentConfig {
  id: string;
  displayName: string;
  emoji: string;
  role: string;
  enabled: boolean;
}

export interface SetupResult {
  userName: string;
  enabledServices: string[];
  agents: SetupAgentConfig[];
}

interface SetupWizardProps {
  onComplete: (result: SetupResult) => void;
}

// ─── Static data ──────────────────────────────────────────────────────────────

interface AgentDef {
  id: string;
  emoji: string;
  defaultName: string;
  role: string;
  desc: string;
  department: string;
  deployed: boolean; // true = active by default, false = available but not deployed
}

const DEFAULT_AGENTS: AgentDef[] = [
  // ── Orchestration ──
  { id: 'cd',       emoji: '🧠', defaultName: 'CD',       role: 'Chief of Staff',       desc: 'Orchestrates all agents and manages your daily workflow',   department: 'Orchestration', deployed: true },
  // ── Communications ──
  { id: 'karoline', emoji: '🛡️', defaultName: 'Karoline', role: 'Comms Commander',       desc: 'Manages email, chat, and all communications',              department: 'Communications', deployed: true },
  { id: 'iris',     emoji: '🌈', defaultName: 'Iris',     role: 'Channel Aggregator',    desc: 'Polls and aggregates messages across all channels',         department: 'Communications', deployed: true },
  { id: 'hermes',   emoji: '📡', defaultName: 'Hermes',   role: 'People Intelligence',   desc: 'Tracks contacts, relationships, and networking insights',   department: 'Communications', deployed: true },
  // ── Scheduling & Finance ──
  { id: 'kronos',   emoji: '⏳', defaultName: 'Kronos',   role: 'Calendar',              desc: 'Manages your schedule, meetings, and time blocks',          department: 'Scheduling & Finance', deployed: true },
  { id: 'marcus',   emoji: '🏛️', defaultName: 'Marcus',   role: 'Finance',               desc: 'Tracks budgets, invoices, and financial data',              department: 'Scheduling & Finance', deployed: true },
  // ── Knowledge & Learning ──
  { id: 'ada',      emoji: '🔮', defaultName: 'Ada',      role: 'Knowledge',             desc: 'Maintains your knowledge base and research notes',          department: 'Knowledge & Learning', deployed: true },
  { id: 'hypatia',  emoji: '📡', defaultName: 'Hypatia',  role: 'Research',              desc: 'Deep web research and competitive intelligence',            department: 'Knowledge & Learning', deployed: false },
  { id: 'socrates', emoji: '🏛️', defaultName: 'Socrates', role: 'Learning Coach',        desc: 'Tracks your learning goals and skill development',          department: 'Knowledge & Learning', deployed: false },
  // ── Personal & Operations ──
  { id: 'vesta',    emoji: '🏠', defaultName: 'Vesta',    role: 'Personal',              desc: 'Handles personal tasks and home management',                department: 'Personal & Ops', deployed: true },
  { id: 'boswell',  emoji: '📜', defaultName: 'Boswell',  role: 'Shadow Logger',         desc: 'Records activity streams and decision history',             department: 'Personal & Ops', deployed: false },
  { id: 'argus',    emoji: '👁️', defaultName: 'Argus',    role: 'Operations',            desc: 'Infrastructure monitoring and configuration hardening',     department: 'Personal & Ops', deployed: false },
  { id: 'kairos',   emoji: '⏱️', defaultName: 'Kairos',   role: 'Urgent Ops',            desc: 'Handles time-sensitive deadlines and escalations',          department: 'Personal & Ops', deployed: false },
  // ── Build & Verification ──
  { id: 'vulcan',   emoji: '🔥', defaultName: 'Vulcan',   role: 'Build',                 desc: 'Manages code, PRs, and deployment pipelines',               department: 'Build & Verification', deployed: true },
  { id: 'themis',   emoji: '⚖️', defaultName: 'Themis',   role: 'Verification',          desc: 'Quality assurance, testing, and compliance checks',         department: 'Build & Verification', deployed: false },
  { id: 'sentinel', emoji: '📡', defaultName: 'Sentinel', role: 'Monitoring',            desc: 'Watches pipelines and alerts on failures',                  department: 'Build & Verification', deployed: false },
];

const AVAILABLE_SERVICES = [
  { id: 'gmail',            icon: '✉️',  name: 'Gmail',             desc: 'Email via Google Workspace' },
  { id: 'google-calendar',  icon: '📅',  name: 'Google Calendar',   desc: 'Calendar & scheduling' },
  { id: 'google-chat',      icon: '💬',  name: 'Google Chat',       desc: 'Team messaging' },
  { id: 'teams',            icon: '🟣',  name: 'Microsoft Teams',   desc: 'Team collaboration' },
  { id: 'slack',            icon: '💬',  name: 'Slack',             desc: 'Workspace messaging' },
  { id: 'github',           icon: '🐙',  name: 'GitHub',            desc: 'Code repositories & PRs' },
  { id: 'trello',           icon: '📋',  name: 'Trello',            desc: 'Project boards' },
  { id: 'fireflies',        icon: '🔥',  name: 'Fireflies',         desc: 'Meeting transcription' },
];

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === step ? 20 : 7,
            height: 7,
            borderRadius: 4,
            background: i === step ? C.accent : 'transparent',
            border: `1.5px solid ${i <= step ? C.accent : C.border}`,
            opacity: i > step ? 0.4 : 1,
            transition: 'all 0.3s ease',
          }}
        />
      ))}
    </div>
  );
}

interface PrimaryBtnProps {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

function PrimaryBtn({ onClick, disabled, children }: PrimaryBtnProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '10px 28px',
        fontSize: 12,
        fontWeight: 700,
        borderRadius: 8,
        border: 'none',
        background: disabled ? 'rgba(163,134,42,0.3)' : hovered ? C.accentHover : C.accent,
        color: disabled ? 'rgba(255,255,255,0.4)' : '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        letterSpacing: '0.3px',
        transition: 'background 0.15s, opacity 0.15s',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

interface SecondaryBtnProps {
  onClick: () => void;
  children: React.ReactNode;
}

function SecondaryBtn({ onClick, children }: SecondaryBtnProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '10px 24px',
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 8,
        border: `1px solid ${C.border}`,
        background: hovered ? 'rgba(241,245,249,0.05)' : 'transparent',
        color: C.text2,
        cursor: 'pointer',
        letterSpacing: '0.3px',
        transition: 'background 0.15s',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

// ─── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: checked ? C.accent : 'rgba(241,245,249,0.1)',
        border: `1px solid ${checked ? C.accent : C.border}`,
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.2s, border-color 0.2s',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      />
    </div>
  );
}

// ─── Step animations wrapper ──────────────────────────────────────────────────

function StepPane({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute' as const,
        inset: 0,
        display: 'flex',
        flexDirection: 'column' as const,
        opacity: active ? 1 : 0,
        transform: active ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        pointerEvents: active ? 'auto' : 'none',
      }}
    >
      {children}
    </div>
  );
}

// ─── Step 0: Welcome ──────────────────────────────────────────────────────────

interface WelcomeStepProps {
  userName: string;
  onChangeName: (v: string) => void;
  onNext: () => void;
}

function WelcomeStep({ userName, onChangeName, onNext }: WelcomeStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && userName.trim()) onNext();
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        padding: '48px 40px',
        textAlign: 'center',
      }}
    >
      {/* Brand mark */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          border: `1.5px solid ${C.accent}`,
          background: C.accentBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 28,
            fontWeight: 700,
            color: C.accent,
            letterSpacing: '0.05em',
            lineHeight: 1,
          }}
        >
          AE
        </span>
      </div>

      {/* Heading */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h1
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 28,
            fontWeight: 700,
            color: C.text,
            margin: 0,
            letterSpacing: '0.04em',
            lineHeight: 1.2,
          }}
        >
          Welcome to Aegilume
        </h1>
        <p
          style={{
            fontSize: 14,
            color: C.muted,
            margin: 0,
            lineHeight: 1.6,
            maxWidth: 340,
          }}
        >
          Your AI-powered command center. Let's get you set up in three quick steps.
        </p>
      </div>

      {/* Name input */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 340 }}>
        <label
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            textAlign: 'left',
          }}
        >
          What should we call you?
        </label>
        <input
          ref={inputRef}
          type="text"
          placeholder="Your name..."
          value={userName}
          onChange={e => onChangeName(e.target.value)}
          onKeyDown={handleKey}
          style={{
            padding: '11px 14px',
            fontSize: 14,
            background: C.bgCard,
            border: `1px solid ${userName.trim() ? C.accent : C.border}`,
            borderRadius: 8,
            color: C.text,
            outline: 'none',
            transition: 'border-color 0.2s',
            fontFamily: 'inherit',
            width: '100%',
          }}
        />
      </div>

      {/* CTA */}
      <PrimaryBtn onClick={onNext} disabled={!userName.trim()}>
        Get Started →
      </PrimaryBtn>
    </div>
  );
}

// ─── Step 1: Services ─────────────────────────────────────────────────────────

interface ServicesStepProps {
  selected: Set<string>;
  onToggle: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}

function ServicesStep({ selected, onToggle, onNext, onBack }: ServicesStepProps) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '36px 40px 20px', flexShrink: 0 }}>
        <h2
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 20,
            fontWeight: 700,
            color: C.text,
            margin: '0 0 8px',
            letterSpacing: '0.04em',
          }}
        >
          Connect Your Services
        </h2>
        <p style={{ fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.6 }}>
          Select the services you'd like to integrate. You can add more later.
        </p>
      </div>

      {/* Services grid */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 40px 24px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          alignContent: 'start',
        }}
      >
        {AVAILABLE_SERVICES.map(svc => {
          const isSelected = selected.has(svc.id);
          return (
            <ServiceCard
              key={svc.id}
              service={svc}
              selected={isSelected}
              onToggle={() => onToggle(svc.id)}
            />
          );
        })}
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 40px 28px',
          flexShrink: 0,
          borderTop: `1px solid ${C.border2}`,
        }}
      >
        <div style={{ fontSize: 11, color: C.muted }}>
          {selected.size} service{selected.size !== 1 ? 's' : ''} selected
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <SecondaryBtn onClick={onBack}>← Back</SecondaryBtn>
          <PrimaryBtn onClick={onNext}>Continue →</PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

interface ServiceCardProps {
  service: typeof AVAILABLE_SERVICES[number];
  selected: boolean;
  onToggle: () => void;
}

function ServiceCard({ service, selected, onToggle }: ServiceCardProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 10,
        background: selected ? C.accentBg : hovered ? 'rgba(241,245,249,0.03)' : C.bgCard,
        border: `1px solid ${selected ? C.accent : hovered ? 'rgba(241,245,249,0.2)' : C.border}`,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        userSelect: 'none',
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: selected ? 'rgba(163,134,42,0.25)' : 'rgba(241,245,249,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
      >
        {service.icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: selected ? C.text : C.text2, marginBottom: 2 }}>
          {service.name}
        </div>
        <div
          style={{
            fontSize: 11,
            color: C.muted,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {service.desc}
        </div>
      </div>

      {/* Checkmark */}
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: 5,
          border: `1.5px solid ${selected ? C.accent : C.border}`,
          background: selected ? C.accent : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.15s',
        }}
      >
        {selected && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  );
}

// ─── Step 2: Agents ───────────────────────────────────────────────────────────

interface AgentsStepProps {
  agents: SetupAgentConfig[];
  onRename: (id: string, name: string) => void;
  onToggle: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}

function AgentsStep({ agents, onRename, onToggle, onNext, onBack }: AgentsStepProps) {
  // Group agents by department
  const departments: Array<{ label: string; agents: SetupAgentConfig[] }> = [];
  const seen = new Set<string>();
  for (const agent of agents) {
    const meta = DEFAULT_AGENTS.find(a => a.id === agent.id);
    const dept = meta?.department ?? 'Other';
    if (!seen.has(dept)) {
      seen.add(dept);
      departments.push({ label: dept, agents: [] });
    }
    departments.find(d => d.label === dept)!.agents.push(agent);
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '36px 40px 20px', flexShrink: 0 }}>
        <h2
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 20,
            fontWeight: 700,
            color: C.text,
            margin: '0 0 8px',
            letterSpacing: '0.04em',
          }}
        >
          Meet Your Agents
        </h2>
        <p style={{ fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.6 }}>
          {agents.length} agents across {departments.length} departments. Enable the ones you need — you can hire more later.
        </p>
      </div>

      {/* Agents list grouped by department */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 40px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {departments.map(dept => (
          <React.Fragment key={dept.label}>
            {/* Department header */}
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                padding: '12px 0 4px',
              }}
            >
              {dept.label}
            </div>
            {dept.agents.map(agent => {
              const meta = DEFAULT_AGENTS.find(a => a.id === agent.id);
              return (
                <AgentRow
                  key={agent.id}
                  agent={agent}
                  desc={meta?.desc ?? ''}
                  deployed={meta?.deployed ?? true}
                  onRename={onRename}
                  onToggle={onToggle}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 40px 28px',
          flexShrink: 0,
          borderTop: `1px solid ${C.border2}`,
        }}
      >
        <div style={{ fontSize: 11, color: C.muted }}>
          {agents.filter(a => a.enabled).length} of {agents.length} agents hired
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <SecondaryBtn onClick={onBack}>← Back</SecondaryBtn>
          <PrimaryBtn onClick={onNext}>Continue →</PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

interface AgentRowProps {
  agent: SetupAgentConfig;
  desc: string;
  deployed: boolean;
  onRename: (id: string, name: string) => void;
  onToggle: (id: string) => void;
}

function AgentRow({ agent, desc, deployed, onRename, onToggle }: AgentRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(agent.displayName);
  const inputRef = useRef<HTMLInputElement>(null);

  const commitEdit = () => {
    const trimmed = draft.trim();
    if (trimmed) onRename(agent.id, trimmed);
    else setDraft(agent.displayName);
    setEditing(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') { setDraft(agent.displayName); setEditing(false); }
  };

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 14px',
        borderRadius: 10,
        background: C.bgCard,
        border: `1px solid ${agent.enabled ? C.border : C.border2}`,
        opacity: agent.enabled ? 1 : 0.5,
        transition: 'opacity 0.2s, border-color 0.2s',
      }}
    >
      {/* Emoji avatar */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: agent.enabled ? C.accentBg : 'rgba(241,245,249,0.05)',
          border: `1px solid ${agent.enabled ? 'rgba(163,134,42,0.3)' : C.border2}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          flexShrink: 0,
          transition: 'background 0.2s, border-color 0.2s',
        }}
      >
        {agent.emoji}
      </div>

      {/* Name + role + desc */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKey}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: C.text,
                background: 'rgba(241,245,249,0.07)',
                border: `1px solid ${C.accent}`,
                borderRadius: 5,
                padding: '1px 7px',
                outline: 'none',
                fontFamily: 'inherit',
                width: 120,
              }}
            />
          ) : (
            <span
              onClick={() => agent.enabled && setEditing(true)}
              title={agent.enabled ? 'Click to rename' : undefined}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: C.text,
                cursor: agent.enabled ? 'text' : 'default',
                borderBottom: agent.enabled ? `1px dashed rgba(163,134,42,0.4)` : 'none',
                lineHeight: 1.4,
              }}
            >
              {agent.displayName}
            </span>
          )}
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              paddingLeft: 2,
            }}
          >
            {agent.role}
          </span>
          {!deployed && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: 'rgba(241,245,249,0.4)',
                background: 'rgba(241,245,249,0.06)',
                padding: '1px 6px',
                borderRadius: 4,
                letterSpacing: '0.04em',
              }}
            >
              Optional
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            color: C.muted,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {desc}
        </div>
      </div>

      {/* Toggle */}
      <Toggle checked={agent.enabled} onChange={() => onToggle(agent.id)} />
    </div>
  );
}

// ─── Step 3: Complete ─────────────────────────────────────────────────────────

interface CompleteStepProps {
  userName: string;
  enabledServices: number;
  enabledAgents: number;
  onLaunch: () => void;
}

function CompleteStep({ userName, enabledServices, enabledAgents, onLaunch }: CompleteStepProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        padding: '48px 40px',
        textAlign: 'center',
      }}
    >
      {/* Checkmark circle */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'rgba(46,204,113,0.12)',
          border: `1.5px solid ${C.green}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transform: mounted ? 'scale(1)' : 'scale(0.7)',
          opacity: mounted ? 1 : 0,
          transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
        }}
      >
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path
            d="M8 16L13 21L24 10"
            stroke={C.green}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 24,
              strokeDashoffset: mounted ? 0 : 24,
              transition: 'stroke-dashoffset 0.5s ease 0.2s',
            }}
          />
        </svg>
      </div>

      {/* Heading */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h1
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 26,
            fontWeight: 700,
            color: C.text,
            margin: 0,
            letterSpacing: '0.04em',
            lineHeight: 1.2,
          }}
        >
          You're all set{userName ? `, ${userName}` : ''}!
        </h1>
        <p style={{ fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.7 }}>
          Your command center is ready. Your agents are standing by.
        </p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12 }}>
        <SummaryChip icon="🔌" count={enabledServices} label="services connected" />
        <SummaryChip icon="🧠" count={enabledAgents} label="agents ready" />
      </div>

      {/* Launch button */}
      <PrimaryBtn onClick={onLaunch}>
        Launch Aegilume →
      </PrimaryBtn>
    </div>
  );
}

function SummaryChip({ icon, count, label }: { icon: string; count: number; label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '14px 20px',
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        minWidth: 100,
      }}
    >
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span style={{ fontSize: 22, fontWeight: 700, color: C.text, lineHeight: 1 }}>{count}</span>
      <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
    </div>
  );
}

// ─── SetupWizard (main) ───────────────────────────────────────────────────────

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(0);
  const [userName, setUserName] = useState('');
  const [selectedServices, setSelectedServices] = useState<Set<string>>(
    new Set(['gmail', 'google-calendar', 'github'])
  );
  const [agents, setAgents] = useState<SetupAgentConfig[]>(
    DEFAULT_AGENTS.map(a => ({
      id: a.id,
      displayName: a.defaultName,
      emoji: a.emoji,
      role: a.role,
      enabled: a.deployed,
    }))
  );

  const next = useCallback(() => setStep(s => Math.min(3, s + 1)), []);
  const back = useCallback(() => setStep(s => Math.max(0, s - 1)), []);

  const toggleService = useCallback((id: string) => {
    setSelectedServices(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const renameAgent = useCallback((id: string, name: string) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, displayName: name } : a));
  }, []);

  const toggleAgent = useCallback((id: string) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  }, []);

  const handleLaunch = useCallback(() => {
    onComplete({
      userName: userName.trim(),
      enabledServices: Array.from(selectedServices),
      agents,
    });
  }, [onComplete, userName, selectedServices, agents]);

  const enabledAgentCount = agents.filter(a => a.enabled).length;

  return (
    /* Full-screen overlay */
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: C.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Subtle radial glow behind card */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(163,134,42,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Wizard card */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 640,
          maxHeight: '88vh',
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(163,134,42,0.08)',
        }}
      >
        {/* Top bar: progress dots */}
        <div
          style={{
            padding: '20px 40px 0',
            flexShrink: 0,
          }}
        >
          <ProgressDots step={step} total={4} />
        </div>

        {/* Step pane container */}
        <div style={{ position: 'relative', flex: 1, overflow: 'hidden', minHeight: 420 }}>
          <StepPane active={step === 0}>
            <WelcomeStep
              userName={userName}
              onChangeName={setUserName}
              onNext={next}
            />
          </StepPane>

          <StepPane active={step === 1}>
            <ServicesStep
              selected={selectedServices}
              onToggle={toggleService}
              onNext={next}
              onBack={back}
            />
          </StepPane>

          <StepPane active={step === 2}>
            <AgentsStep
              agents={agents}
              onRename={renameAgent}
              onToggle={toggleAgent}
              onNext={next}
              onBack={back}
            />
          </StepPane>

          <StepPane active={step === 3}>
            <CompleteStep
              userName={userName.trim()}
              enabledServices={selectedServices.size}
              enabledAgents={enabledAgentCount}
              onLaunch={handleLaunch}
            />
          </StepPane>
        </div>

        {/* Subtle bottom accent line */}
        <div
          style={{
            height: 2,
            background: `linear-gradient(90deg, transparent, ${C.accent}, transparent)`,
            opacity: 0.4,
            flexShrink: 0,
          }}
        />
      </div>
    </div>
  );
}
