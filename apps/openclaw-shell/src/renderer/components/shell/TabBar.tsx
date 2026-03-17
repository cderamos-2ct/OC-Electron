import React, { useState } from 'react';
import { useViewStore, ViewId } from '../../stores/view-store';
import { useShellStore } from '../../stores/shell-store';
import type { ServiceConfig } from '../../../shared/types';

// ---- Nav tab definitions matching the mockup --------------------------------

interface NavTab {
  id: ViewId;
  icon: string;
  label: string;
  badge?: number;
}

const NAV_TABS: NavTab[] = [
  { id: 'home', icon: '\u{1F3E0}', label: 'Home' },
  { id: 'tasks', icon: '\u{1F4CB}', label: 'Tasks' },
  { id: 'agents', icon: '\u{1F465}', label: 'Agents' },
  { id: 'comms', icon: '\u{1F4AC}', label: 'Comms' },
  { id: 'calendar', icon: '\u{1F4C5}', label: 'Calendar' },
  { id: 'github', icon: '\u26A1', label: 'GitHub' },
  { id: 'browser', icon: '\u{1F310}', label: 'Browser' },
  { id: 'vault', icon: '\u{1F510}', label: 'Vault' },
];

// Service tabs (non-navigating, webview-based)
interface ServiceTab {
  icon: string;
  label: string;
  mono?: boolean;
}

const SERVICE_TABS: ServiceTab[] = [
  { icon: '\u{1F4AC}', label: 'Slack' },
  { icon: '\u{1F4CB}', label: 'Linear' },
  { icon: '>', label: 'code-server', mono: true },
];

// ---- Add Tab Dialog ---------------------------------------------------------

interface AddTabDialogProps {
  onAdd: (name: string, url: string) => void;
  onClose: () => void;
}

function AddTabDialog({ onAdd, onClose }: AddTabDialogProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('https://');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = url.trim();
    const trimmedName = name.trim() || trimmedUrl;
    if (!trimmedUrl || trimmedUrl === 'https://') return;
    onAdd(trimmedName, trimmedUrl);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'var(--bg-mid)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          minWidth: '340px',
        }}
      >
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
          Add Tab
        </span>
        <input
          type="text"
          placeholder="Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            padding: '6px 10px',
            borderRadius: '5px',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: '13px',
            outline: 'none',
          }}
        />
        <input
          type="url"
          placeholder="https://..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoFocus
          style={{
            padding: '6px 10px',
            borderRadius: '5px',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: '13px',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '5px 14px',
              borderRadius: '5px',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-2)',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{
              padding: '5px 14px',
              borderRadius: '5px',
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Add
          </button>
        </div>
      </form>
    </div>
  );
}

// ---- TabBar -----------------------------------------------------------------

export function TabBar() {
  const activeView = useViewStore((s) => s.activeView);
  const setActiveView = useViewStore((s) => s.setActiveView);
  const addService = useShellStore((s) => s.addService);
  const services = useShellStore((s) => s.services);
  const setActiveService = useShellStore((s) => s.setActiveService);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  const handleAddService = (name: string, url: string) => {
    const id = `custom-${Date.now()}`;
    const newService: ServiceConfig = {
      id,
      name,
      url,
      partition: `persist:service-${id}`,
      pinned: false,
      order: services.length,
    };
    addService(newService);
    window.electronAPI?.invoke?.('service:add', newService);
    setActiveService(id);
  };

  const tabStyle = (isActive: boolean, tabId: string): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '0 14px',
    height: '100%',
    border: 'none',
    background: 'transparent',
    color: isActive ? 'var(--text)' : hoveredTab === tabId ? 'var(--text-2)' : 'var(--muted)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: isActive ? 600 : 400,
    whiteSpace: 'nowrap',
    flexShrink: 0,
    position: 'relative',
    boxShadow: isActive ? 'inset 0 -2px 0 var(--accent)' : 'none',
    transition: 'color 0.15s',
  });

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          height: '40px',
          background: 'var(--bg-mid)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'none',
        }}
      >
        {/* Nav tabs */}
        {NAV_TABS.map((tab) => {
          const isActive = activeView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              onMouseEnter={() => setHoveredTab(tab.id)}
              onMouseLeave={() => setHoveredTab(null)}
              style={tabStyle(isActive, tab.id)}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge != null && tab.badge > 0 && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#fff',
                    backgroundColor: 'var(--red)',
                    borderRadius: '8px',
                    padding: '1px 6px',
                    marginLeft: '2px',
                    lineHeight: '14px',
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Separator */}
        <div
          style={{
            width: '1px',
            background: 'var(--border)',
            margin: '8px 4px',
            flexShrink: 0,
          }}
        />

        {/* Service tabs (non-navigating) */}
        {SERVICE_TABS.map((tab) => (
          <button
            key={tab.label}
            onMouseEnter={() => setHoveredTab(`svc-${tab.label}`)}
            onMouseLeave={() => setHoveredTab(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '0 14px',
              height: '100%',
              border: 'none',
              background: 'transparent',
              color: hoveredTab === `svc-${tab.label}` ? 'var(--text-2)' : 'var(--muted)',
              cursor: 'pointer',
              fontSize: '13px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'color 0.15s',
            }}
          >
            <span style={tab.mono ? { fontFamily: 'monospace' } : undefined}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}

        {/* Add tab button */}
        <button
          onClick={() => setShowAddDialog(true)}
          title="Add tab"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '40px',
            border: 'none',
            background: 'transparent',
            color: 'var(--muted)',
            cursor: 'pointer',
            fontSize: '16px',
            flexShrink: 0,
            transition: 'color 0.1s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)';
          }}
        >
          +
        </button>
      </div>

      {showAddDialog && (
        <AddTabDialog
          onAdd={handleAddService}
          onClose={() => setShowAddDialog(false)}
        />
      )}
    </>
  );
}
