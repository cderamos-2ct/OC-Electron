import React, { useState, useCallback, useEffect } from 'react';
import { useProvisioningStore } from '../../stores/provisioning-store';
import type { ProvisioningPhase, ComponentStatus } from '../../stores/provisioning-store';
import { invoke, on, openExternal } from '../../lib/ipc-client';

// ─── Design tokens ──────────────────────────────────────────────────────────

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
  yellow:   '#f39c12',
};

const statusColor: Record<ComponentStatus, string> = {
  pending: C.muted,
  running: C.accent,
  success: C.green,
  failed: C.red,
  skipped: C.muted,
};

const statusIcon: Record<ComponentStatus, string> = {
  pending: '\u2022',
  running: '\u25B6',
  success: '\u2713',
  failed: '\u2717',
  skipped: '\u2014',
};

// ─── Phase components ───────────────────────────────────────────────────────

function WelcomePhase({ onNext }: { onNext: () => void }) {
  const dataDir = useProvisioningStore((s) => s.dataDir);
  const setDataDir = useProvisioningStore((s) => s.setDataDir);
  const [name, setName] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <h2 style={{ color: C.text, margin: 0, fontFamily: "'Cinzel', serif", letterSpacing: '1px' }}>
        Welcome to Aegilume
      </h2>
      <p style={{ color: C.text2, margin: 0 }}>
        Let's set up your personal AI command center. This will install and configure the services
        Aegilume needs to run.
      </p>

      <label style={{ color: C.muted, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
        Your name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          style={{
            display: 'block', width: '100%', marginTop: '6px', padding: '10px 12px',
            background: C.bg, border: `1px solid ${C.border}`, borderRadius: '6px',
            color: C.text, fontSize: '14px', outline: 'none',
          }}
        />
      </label>

      <label style={{ color: C.muted, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
        Data directory
        <input
          type="text"
          value={dataDir}
          onChange={(e) => setDataDir(e.target.value)}
          style={{
            display: 'block', width: '100%', marginTop: '6px', padding: '10px 12px',
            background: C.bg, border: `1px solid ${C.border}`, borderRadius: '6px',
            color: C.text, fontSize: '14px', fontFamily: 'monospace', outline: 'none',
          }}
        />
      </label>

      <div style={{ color: C.muted, fontSize: '12px' }}>
        Estimated disk space: ~800MB (PostgreSQL, Vaultwarden, Gateway, Dashboard, code-server)
      </div>

      <button onClick={onNext} style={btnStyle}>
        Continue
      </button>
    </div>
  );
}

function SystemPhase({ onNext }: { onNext: () => void }) {
  const components = useProvisioningStore((s) => s.components);
  const isProvisioning = useProvisioningStore((s) => s.isProvisioning);
  const setIsProvisioning = useProvisioningStore((s) => s.setIsProvisioning);
  const setComponentStatus = useProvisioningStore((s) => s.setComponentStatus);

  const handleInstallAll = useCallback(async () => {
    setIsProvisioning(true);
    try {
      await invoke('provisioning:run-all');
    } catch (err) {
      console.error('Provisioning failed:', err);
    }
    setIsProvisioning(false);
  }, [setIsProvisioning]);

  const handleRetry = useCallback(async (id: string) => {
    setComponentStatus(id, 'running', 'Retrying...');
    try {
      await invoke('provisioning:retry', id);
    } catch (err) {
      console.error(`Retry ${id} failed:`, err);
    }
  }, [setComponentStatus]);

  const handleSkip = useCallback(async (id: string) => {
    setComponentStatus(id, 'skipped', 'Skipped');
    await invoke('provisioning:skip', id);
  }, [setComponentStatus]);

  // Listen for progress events
  useEffect(() => {
    const unsub = on('provisioning:progress', (progress) => {
      setComponentStatus(
        progress.service,
        progress.status as ComponentStatus,
        progress.message,
        progress.percent,
      );
    });
    return unsub;
  }, [setComponentStatus]);

  const allDone = components.every((c) => c.status === 'success' || c.status === 'skipped');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2 style={{ color: C.text, margin: 0, fontFamily: "'Cinzel', serif" }}>System Setup</h2>
      <p style={{ color: C.text2, margin: 0, fontSize: '13px' }}>
        Installing and configuring backend services. This may take a few minutes.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {components.map((comp) => (
          <div key={comp.id} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '10px 12px', background: C.bgCard, borderRadius: '6px',
            border: `1px solid ${C.border}`,
          }}>
            <span style={{ color: statusColor[comp.status], fontSize: '16px', width: '20px', textAlign: 'center' }}>
              {statusIcon[comp.status]}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ color: C.text, fontSize: '13px' }}>{comp.name}</div>
              {comp.message && (
                <div style={{ color: C.muted, fontSize: '11px', marginTop: '2px' }}>{comp.message}</div>
              )}
            </div>
            {comp.percent !== undefined && comp.status === 'running' && (
              <div style={{ width: '60px', height: '4px', background: C.border, borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${comp.percent}%`, height: '100%', background: C.accent, transition: 'width 0.3s' }} />
              </div>
            )}
            {comp.status === 'failed' && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => handleRetry(comp.id)} style={smallBtnStyle}>Retry</button>
                <button onClick={() => handleSkip(comp.id)} style={{ ...smallBtnStyle, color: C.muted }}>Skip</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {!isProvisioning && !allDone && (
        <button onClick={handleInstallAll} style={btnStyle}>Install All</button>
      )}
      {allDone && (
        <button onClick={onNext} style={btnStyle}>Continue</button>
      )}
    </div>
  );
}

function AccountsPhase({ onNext }: { onNext: () => void }) {
  const githubPat = useProvisioningStore((s) => s.githubPat);
  const setGithubPat = useProvisioningStore((s) => s.setGithubPat);
  const githubValid = useProvisioningStore((s) => s.githubValid);
  const setGithubValid = useProvisioningStore((s) => s.setGithubValid);
  const gwsAuthed = useProvisioningStore((s) => s.gwsAuthed);

  const validateGithub = useCallback(async () => {
    if (!githubPat) return;
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: { Authorization: `token ${githubPat}` },
      });
      setGithubValid(response.ok);
    } catch {
      setGithubValid(false);
    }
  }, [githubPat, setGithubValid]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h2 style={{ color: C.text, margin: 0, fontFamily: "'Cinzel', serif" }}>Accounts</h2>
      <p style={{ color: C.text2, margin: 0, fontSize: '13px' }}>
        Connect your accounts. These can be added or changed later in Settings.
      </p>

      <div style={{ padding: '12px', background: C.bgCard, borderRadius: '6px', border: `1px solid ${C.border}` }}>
        <div style={{ color: C.text, fontSize: '13px', marginBottom: '8px' }}>Google Workspace</div>
        <div style={{ color: gwsAuthed ? C.green : C.muted, fontSize: '12px' }}>
          {gwsAuthed ? 'Authenticated' : 'Not authenticated — run `gws auth login` in terminal'}
        </div>
      </div>

      <div style={{ padding: '12px', background: C.bgCard, borderRadius: '6px', border: `1px solid ${C.border}` }}>
        <div style={{ color: C.text, fontSize: '13px', marginBottom: '8px' }}>GitHub Personal Access Token</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="password"
            value={githubPat}
            onChange={(e) => setGithubPat(e.target.value)}
            placeholder="ghp_..."
            style={{
              flex: 1, padding: '8px 10px', background: C.bg, border: `1px solid ${C.border}`,
              borderRadius: '4px', color: C.text, fontSize: '13px', fontFamily: 'monospace', outline: 'none',
            }}
          />
          <button onClick={validateGithub} style={smallBtnStyle}>Validate</button>
        </div>
        {githubValid && <div style={{ color: C.green, fontSize: '11px', marginTop: '4px' }}>Valid</div>}
      </div>

      <button onClick={onNext} style={btnStyle}>Continue</button>
    </div>
  );
}

function PermissionsPhase({ onNext }: { onNext: () => void }) {
  const isMac = navigator.platform.toLowerCase().includes('mac');

  if (!isMac) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h2 style={{ color: C.text, margin: 0, fontFamily: "'Cinzel', serif" }}>Permissions</h2>
        <p style={{ color: C.text2, fontSize: '13px' }}>No additional permissions needed on this platform.</p>
        <button onClick={onNext} style={btnStyle}>Continue</button>
      </div>
    );
  }

  const permissions = [
    { name: 'Full Disk Access', desc: 'Required for file operations', link: 'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles' },
    { name: 'Contacts', desc: 'For contact sync', link: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Contacts' },
    { name: 'Calendar', desc: 'For calendar sync', link: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars' },
    { name: 'Accessibility', desc: 'For automation', link: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility' },
    { name: 'Automation', desc: 'For app control', link: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2 style={{ color: C.text, margin: 0, fontFamily: "'Cinzel', serif" }}>macOS Permissions</h2>
      <p style={{ color: C.text2, margin: 0, fontSize: '13px' }}>
        Grant these permissions for full functionality. Click each to open System Settings.
      </p>

      {permissions.map((perm) => (
        <button
          key={perm.name}
          onClick={() => openExternal(perm.link)}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px',
            background: C.bgCard, borderRadius: '6px', border: `1px solid ${C.border}`,
            cursor: 'pointer', textAlign: 'left', width: '100%',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ color: C.text, fontSize: '13px' }}>{perm.name}</div>
            <div style={{ color: C.muted, fontSize: '11px' }}>{perm.desc}</div>
          </div>
          <span style={{ color: C.accent, fontSize: '12px' }}>Open Settings</span>
        </button>
      ))}

      <button onClick={onNext} style={btnStyle}>Continue</button>
    </div>
  );
}

function ConfigPhase({ onNext }: { onNext: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2 style={{ color: C.text, margin: 0, fontFamily: "'Cinzel', serif" }}>Configuration</h2>
      <p style={{ color: C.text2, margin: 0, fontSize: '13px' }}>
        Service and agent configuration can be customized in Settings after setup.
        Default configuration will be applied.
      </p>
      <button onClick={onNext} style={btnStyle}>Continue</button>
    </div>
  );
}

function VerifyPhase({ onComplete }: { onComplete: () => void }) {
  const components = useProvisioningStore((s) => s.components);
  const criticalServices = ['paths', 'postgres'];
  const allCriticalPassed = criticalServices.every(
    (id) => components.find((c) => c.id === id)?.status === 'success',
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2 style={{ color: C.text, margin: 0, fontFamily: "'Cinzel', serif" }}>Verification</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {components.map((comp) => (
          <div key={comp.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
            <span style={{
              width: '10px', height: '10px', borderRadius: '50%',
              background: comp.status === 'success' ? C.green : comp.status === 'skipped' ? C.yellow : C.red,
            }} />
            <span style={{ color: C.text, fontSize: '13px' }}>{comp.name}</span>
            <span style={{ color: C.muted, fontSize: '11px', marginLeft: 'auto' }}>{comp.status}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onComplete}
        disabled={!allCriticalPassed}
        style={{
          ...btnStyle,
          opacity: allCriticalPassed ? 1 : 0.5,
          cursor: allCriticalPassed ? 'pointer' : 'not-allowed',
        }}
      >
        Launch Aegilume
      </button>

      {!allCriticalPassed && (
        <div style={{ color: C.red, fontSize: '12px', textAlign: 'center' }}>
          Critical services (PostgreSQL) must be provisioned before launch.
        </div>
      )}
    </div>
  );
}

// ─── Main Wizard ───────────────────────────────────────────────────────────

export interface ProvisioningWizardProps {
  onComplete: () => void;
}

const PHASES: ProvisioningPhase[] = ['welcome', 'system', 'accounts', 'permissions', 'config', 'verify'];

export function ProvisioningWizard({ onComplete }: ProvisioningWizardProps) {
  const phase = useProvisioningStore((s) => s.phase);
  const setPhase = useProvisioningStore((s) => s.setPhase);

  const goNext = useCallback(() => {
    const idx = PHASES.indexOf(phase);
    if (idx < PHASES.length - 1) {
      setPhase(PHASES[idx + 1]);
    }
  }, [phase, setPhase]);

  const phaseIndex = PHASES.indexOf(phase);

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: C.bg, zIndex: 10000,
    }}>
      <div style={{
        width: '480px', maxHeight: '90vh', overflow: 'auto',
        padding: '32px', background: C.bgCard, borderRadius: '12px',
        border: `1px solid ${C.border}`, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        {/* Progress indicator */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px' }}>
          {PHASES.map((p, i) => (
            <div key={p} style={{
              flex: 1, height: '3px', borderRadius: '2px',
              background: i <= phaseIndex ? C.accent : C.border,
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {phase === 'welcome' && <WelcomePhase onNext={goNext} />}
        {phase === 'system' && <SystemPhase onNext={goNext} />}
        {phase === 'accounts' && <AccountsPhase onNext={goNext} />}
        {phase === 'permissions' && <PermissionsPhase onNext={goNext} />}
        {phase === 'config' && <ConfigPhase onNext={goNext} />}
        {phase === 'verify' && <VerifyPhase onComplete={onComplete} />}
      </div>
    </div>
  );
}

// ─── Shared styles ──────────────────────────────────────────────────────────

const btnStyle: React.CSSProperties = {
  padding: '10px 20px',
  background: C.accent,
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  fontSize: '14px',
  cursor: 'pointer',
  fontWeight: 500,
};

const smallBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  background: 'transparent',
  color: C.accent,
  border: `1px solid ${C.accent}`,
  borderRadius: '4px',
  fontSize: '11px',
  cursor: 'pointer',
};
