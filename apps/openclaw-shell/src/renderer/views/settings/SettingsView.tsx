import React, { useState, useEffect, useCallback } from 'react';
import { invoke, on } from '../../lib/ipc-client';

// ─── Design tokens ──────────────────────────────────────────────────────────

const C = {
  bg:       'var(--bg, #0f172a)',
  bgCard:   'var(--bg-card, #131d33)',
  border:   'var(--border, rgba(241,245,249,0.14))',
  text:     'var(--text, #f1f5f9)',
  text2:    'var(--text-2, #cbd5e1)',
  muted:    'var(--muted, #94a3b8)',
  accent:   'var(--accent, #a3862a)',
  green:    '#2ecc71',
  red:      '#e74c3c',
};

type SettingsTab = 'general' | 'data' | 'connections' | 'permissions' | 'services' | 'advanced';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'data', label: 'Data' },
  { id: 'connections', label: 'Connections' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'services', label: 'Services' },
  { id: 'advanced', label: 'Advanced' },
];

function GeneralTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h3 style={{ color: C.text, margin: 0 }}>General Settings</h3>
      <div style={{ color: C.text2, fontSize: '13px' }}>
        Application preferences, theme, and notification settings.
      </div>
    </div>
  );
}

function DataTab() {
  const handleReProvision = useCallback(async (serviceId: string) => {
    try {
      await invoke('provisioning:retry', serviceId);
    } catch (err) {
      console.error('Re-provision failed:', err);
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h3 style={{ color: C.text, margin: 0 }}>Data & Storage</h3>
      <div style={{ color: C.text2, fontSize: '13px' }}>
        Manage data directories, database, and backups.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {['paths', 'postgres'].map((svc) => (
          <div key={svc} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 12px', background: C.bgCard, borderRadius: '6px', border: `1px solid ${C.border}`,
          }}>
            <span style={{ color: C.text, fontSize: '13px', textTransform: 'capitalize' }}>{svc}</span>
            <button
              onClick={() => handleReProvision(svc)}
              style={{
                padding: '4px 10px', background: 'transparent', color: C.accent,
                border: `1px solid ${C.accent}`, borderRadius: '4px', fontSize: '11px', cursor: 'pointer',
              }}
            >
              Re-provision
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectionsTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h3 style={{ color: C.text, margin: 0 }}>Connections</h3>
      <div style={{ color: C.text2, fontSize: '13px' }}>
        Manage API credentials, Google Workspace auth, and GitHub tokens.
      </div>
    </div>
  );
}

function PermissionsTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h3 style={{ color: C.text, margin: 0 }}>Permissions</h3>
      {navigator.platform.toLowerCase().includes('mac') ? (
        <div style={{ color: C.text2, fontSize: '13px' }}>
          macOS permissions can be managed in System Settings. Click a permission to open the relevant pane.
        </div>
      ) : (
        <div style={{ color: C.muted, fontSize: '13px' }}>
          No additional permissions required on this platform.
        </div>
      )}
    </div>
  );
}

function ServicesTab() {
  const services = ['postgres', 'gateway', 'dashboard', 'code-server', 'gws'];

  const handleReProvision = useCallback(async (serviceId: string) => {
    try {
      await invoke('provisioning:retry', serviceId);
    } catch (err) {
      console.error('Re-provision failed:', err);
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h3 style={{ color: C.text, margin: 0 }}>Services</h3>
      <div style={{ color: C.text2, fontSize: '13px' }}>
        Manage provisioned services. Re-run provisioning for individual components.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {services.map((svc) => (
          <div key={svc} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 12px', background: C.bgCard, borderRadius: '6px', border: `1px solid ${C.border}`,
          }}>
            <span style={{ color: C.text, fontSize: '13px', textTransform: 'capitalize' }}>{svc}</span>
            <button
              onClick={() => handleReProvision(svc)}
              style={{
                padding: '4px 10px', background: 'transparent', color: C.accent,
                border: `1px solid ${C.accent}`, borderRadius: '4px', fontSize: '11px', cursor: 'pointer',
              }}
            >
              Re-provision
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdvancedTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h3 style={{ color: C.text, margin: 0 }}>Advanced</h3>
      <div style={{ color: C.text2, fontSize: '13px' }}>
        Database management, debug logging, and developer tools.
      </div>
    </div>
  );
}

export function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  return (
    <div style={{ display: 'flex', height: '100%', background: C.bg }}>
      {/* Sidebar */}
      <div style={{
        width: '180px', borderRight: `1px solid ${C.border}`, padding: '16px 0',
        display: 'flex', flexDirection: 'column', gap: '2px',
      }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'block', width: '100%', padding: '8px 16px', textAlign: 'left',
              background: activeTab === tab.id ? C.bgCard : 'transparent',
              color: activeTab === tab.id ? C.text : C.muted,
              border: 'none', cursor: 'pointer', fontSize: '13px',
              borderLeft: activeTab === tab.id ? `2px solid ${C.accent}` : '2px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
        {activeTab === 'general' && <GeneralTab />}
        {activeTab === 'data' && <DataTab />}
        {activeTab === 'connections' && <ConnectionsTab />}
        {activeTab === 'permissions' && <PermissionsTab />}
        {activeTab === 'services' && <ServicesTab />}
        {activeTab === 'advanced' && <AdvancedTab />}
      </div>
    </div>
  );
}
