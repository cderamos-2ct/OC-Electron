import React, { useState, useEffect } from 'react';
import { invoke, on } from '../../lib/ipc-client';
import type { ServiceConfig, BrowserTab } from '../../../shared/types';

// ─── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  bg:       'var(--bg, #0f172a)',
  bgMid:    'var(--bg-mid, #131d33)',
  bgCard:   'var(--bg-card, #131d33)',
  border:   'var(--border, rgba(241,245,249,0.14))',
  border2:  'rgba(241,245,249,0.08)',
  text:     'var(--text, #f1f5f9)',
  text2:    'var(--text-2, #cbd5e1)',
  muted:    'var(--muted, #94a3b8)',
  accent:   'var(--accent, #a3862a)',
  accentBg: 'rgba(163,134,42,0.2)',
  green:    '#2ecc71',
  yellow:   '#e0c875',
  red:      '#e74c3c',
};

// ─── AddAppModal ────────────────────────────────────────────────────────────────

interface AddAppModalProps {
  onClose: () => void;
  onAdd: (name: string, url: string) => void;
}

function AddAppModal({ onClose, onAdd }: AddAppModalProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  const handleSubmit = () => {
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    if (!trimmedName || !trimmedUrl) return;
    const finalUrl = trimmedUrl.startsWith('http') ? trimmedUrl : `https://${trimmedUrl}`;
    onAdd(trimmedName, finalUrl);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: '24px',
          width: 360,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Add App</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            App Name
          </label>
          <input
            autoFocus
            type="text"
            placeholder="e.g. Linear"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: 7,
              padding: '8px 12px',
              fontSize: 13,
              color: C.text,
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            URL
          </label>
          <input
            type="text"
            placeholder="e.g. linear.app"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: 7,
              padding: '8px 12px',
              fontSize: 13,
              color: C.text,
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 16px',
              fontSize: 12,
              fontWeight: 600,
              border: `1px solid ${C.border}`,
              borderRadius: 7,
              background: 'transparent',
              color: C.text2,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !url.trim()}
            style={{
              padding: '7px 16px',
              fontSize: 12,
              fontWeight: 700,
              border: 'none',
              borderRadius: 7,
              background: name.trim() && url.trim() ? C.accent : 'rgba(163,134,42,0.3)',
              color: '#fff',
              cursor: name.trim() && url.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Add App
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PinnedAppGrid ──────────────────────────────────────────────────────────────

interface PinnedApp {
  id: string;
  name: string;
  url: string;
  icon?: string;
}

interface PinnedAppGridProps {
  apps: PinnedApp[];
  onOpenApp: (app: PinnedApp) => void;
  onAddApp: () => void;
}

function PinnedAppGrid({ apps, onOpenApp, onAddApp }: PinnedAppGridProps) {
  if (apps.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          color: C.muted,
        }}
      >
        <div style={{ fontSize: 40 }}>🌐</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text2 }}>Add apps to your browser</div>
        <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', maxWidth: 260 }}>
          Pin frequently used web apps for quick access.
        </div>
        <button
          onClick={onAddApp}
          style={{
            padding: '9px 20px',
            fontSize: 13,
            fontWeight: 700,
            border: 'none',
            borderRadius: 8,
            background: C.accent,
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          + Add App
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Pinned Apps
        </div>
        <button
          onClick={onAddApp}
          style={{
            padding: '5px 12px',
            fontSize: 11,
            fontWeight: 600,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            background: 'transparent',
            color: C.text2,
            cursor: 'pointer',
          }}
        >
          + Add App
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: 12,
        }}
      >
        {apps.map(app => (
          <AppTile key={app.id} app={app} onClick={() => onOpenApp(app)} />
        ))}
      </div>
    </div>
  );
}

function AppTile({ app, onClick }: { app: PinnedApp; onClick: () => void }) {
  const initial = app.name.charAt(0).toUpperCase();
  const faviconUrl = app.url ? `https://www.google.com/s2/favicons?sz=64&domain=${new URL(app.url).hostname}` : null;

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '16px 12px',
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        cursor: 'pointer',
        color: C.text,
        transition: 'border-color 0.15s',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: `linear-gradient(135deg, ${C.accentBg}, rgba(163,134,42,0.08))`,
          border: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {faviconUrl ? (
          <img
            src={faviconUrl}
            alt={app.name}
            style={{ width: 24, height: 24 }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <span style={{ fontSize: 18, fontWeight: 700, color: C.accent }}>{initial}</span>
        )}
      </div>
      <span style={{ fontSize: 12, fontWeight: 500, color: C.text2, textAlign: 'center', lineHeight: 1.3, wordBreak: 'break-word' }}>
        {app.name}
      </span>
    </button>
  );
}

// ─── BrowserToolbar ─────────────────────────────────────────────────────────────

interface BrowserToolbarProps {
  currentUrl: string;
  onNavigate: (url: string) => void;
}

function BrowserToolbar({ currentUrl, onNavigate }: BrowserToolbarProps) {
  const [urlInput, setUrlInput] = useState(currentUrl);

  useEffect(() => {
    setUrlInput(currentUrl);
  }, [currentUrl]);

  const handleNavigate = () => {
    let url = urlInput.trim();
    if (!url) return;
    if (!url.startsWith('http')) url = `https://${url}`;
    onNavigate(url);
  };

  return (
    <div
      style={{
        background: C.bgMid,
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
      }}
    >
      <button
        style={{ background: 'none', border: 'none', color: C.text2, fontSize: 16, cursor: 'pointer', padding: '4px 8px', borderRadius: 6, lineHeight: 1 }}
      >
        ←
      </button>
      <button
        style={{ background: 'none', border: 'none', color: C.muted, fontSize: 16, cursor: 'pointer', padding: '4px 8px', borderRadius: 6, lineHeight: 1 }}
      >
        →
      </button>
      <button
        style={{ background: 'none', border: 'none', color: C.text2, fontSize: 16, cursor: 'pointer', padding: '4px 8px', borderRadius: 6, lineHeight: 1 }}
      >
        ↻
      </button>

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(241,245,249,0.06)',
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: '6px 12px',
        }}
      >
        <span style={{ color: C.green, fontSize: 12, flexShrink: 0 }}>🔒</span>
        <input
          type="text"
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleNavigate()}
          placeholder="Enter URL or search..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: C.text2,
            fontSize: 13,
          }}
        />
      </div>
    </div>
  );
}

// ─── BrowserTabBar ──────────────────────────────────────────────────────────────

interface BrowserTabBarProps {
  tabs: BrowserTab[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
}

function BrowserTabBar({ tabs, activeTabId, onSelectTab, onCloseTab }: BrowserTabBarProps) {
  if (tabs.length === 0) return null;

  return (
    <div
      style={{
        background: C.bgMid,
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '0 12px',
        flexShrink: 0,
        overflowX: 'auto',
      }}
    >
      {tabs.map(tab => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              fontSize: 12,
              color: isActive ? C.text : C.muted,
              background: isActive ? 'rgba(241,245,249,0.06)' : 'transparent',
              borderBottom: isActive ? `2px solid ${C.accent}` : '2px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              maxWidth: 180,
              flexShrink: 0,
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
              {tab.title || tab.url}
            </span>
            <button
              onClick={e => { e.stopPropagation(); onCloseTab(tab.id); }}
              style={{
                background: 'none',
                border: 'none',
                color: C.muted,
                fontSize: 14,
                cursor: 'pointer',
                padding: 0,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main BrowserView ───────────────────────────────────────────────────────────

export function BrowserView() {
  const [tabs, setTabs] = useState<BrowserTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [pinnedApps, setPinnedApps] = useState<PinnedApp[]>([]);
  const [loadingTabs, setLoadingTabs] = useState(true);

  // Load pinned apps from services
  useEffect(() => {
    invoke('service:list').then((result) => {
      const services = (result as ServiceConfig[]) ?? [];
      const pinned: PinnedApp[] = services
        .filter(s => s.pinned)
        .sort((a, b) => a.order - b.order)
        .map(s => ({ id: s.id, name: s.name, url: s.url, icon: s.icon }));
      setPinnedApps(pinned);
    }).catch(() => {});
  }, []);

  // Load browser tabs
  useEffect(() => {
    invoke('browser:list-tabs').then((result) => {
      const list = (result as BrowserTab[]) ?? [];
      setTabs(list);
      if (list.length > 0 && !activeTabId) {
        setActiveTabId(list[0].id);
        setCurrentUrl(list[0].url);
      }
    }).catch(() => {}).finally(() => setLoadingTabs(false));

    const unsub1 = on('browser:tab-updated', (tab: BrowserTab) => {
      setTabs(prev => {
        const idx = prev.findIndex(t => t.id === tab.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = tab;
          return next;
        }
        return [...prev, tab];
      });
    });

    const unsub2 = on('browser:tab-removed', ({ tabId }: { tabId: string }) => {
      setTabs(prev => prev.filter(t => t.id !== tabId));
      setActiveTabId(prev => prev === tabId ? null : prev);
    });

    const unsub3 = on('browser:tabs-list', (list: BrowserTab[]) => {
      setTabs(list);
    });

    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  const handleNavigate = (url: string) => {
    setCurrentUrl(url);
    invoke('browser:navigate', url, activeTabId ?? undefined).catch(() => {});
  };

  const handleSelectTab = (tabId: string) => {
    setActiveTabId(tabId);
    const tab = tabs.find(t => t.id === tabId);
    if (tab) setCurrentUrl(tab.url);
  };

  const handleCloseTab = (tabId: string) => {
    invoke('browser:close-tab', tabId).catch(() => {});
  };

  const handleAddApp = (name: string, url: string) => {
    const config: ServiceConfig = {
      id: `svc-${Date.now()}`,
      name,
      url,
      partition: `persist:${name.toLowerCase().replace(/\s+/g, '-')}`,
      pinned: true,
      order: pinnedApps.length,
    };
    invoke('service:add', config).then(() => {
      setPinnedApps(prev => [...prev, { id: config.id, name: config.name, url: config.url }]);
    }).catch(() => {});
  };

  const handleOpenApp = (app: PinnedApp) => {
    invoke('browser:add-tab', app.name, app.url, undefined, true).catch(() => {});
    setCurrentUrl(app.url);
  };

  const activeTab = tabs.find(t => t.id === activeTabId) ?? null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: C.bg,
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: C.text,
      }}
    >
      {/* Toolbar */}
      <BrowserToolbar currentUrl={currentUrl} onNavigate={handleNavigate} />

      {/* Tab bar */}
      <BrowserTabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
      />

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Main content area */}
        {activeTab ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: C.bg,
              color: C.muted,
              gap: 12,
            }}
          >
            <div style={{ fontSize: 32 }}>🌐</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text2 }}>
              {activeTab.state === 'loading' ? 'Loading...' : activeTab.title || activeTab.url}
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>{activeTab.url}</div>
          </div>
        ) : (
          <PinnedAppGrid
            apps={pinnedApps}
            onOpenApp={handleOpenApp}
            onAddApp={() => setShowAddModal(true)}
          />
        )}

        {/* Agent rail */}
        <div
          style={{
            width: 260,
            flexShrink: 0,
            background: C.bgMid,
            borderLeft: `1px solid ${C.border}`,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
        >
          {/* Rail header */}
          <div
            style={{
              padding: '14px 16px',
              borderBottom: `1px solid ${C.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #a3862a, #c8a84b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                color: '#fff',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              CD
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>CD · Browser Assistant</div>
              <div style={{ fontSize: 11, color: C.muted }}>Context-aware browsing</div>
            </div>
          </div>

          {/* Rail body */}
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {activeTab ? (
              <>
                <div
                  style={{
                    background: 'rgba(241,245,249,0.04)',
                    border: `1px solid ${C.border2}`,
                    borderRadius: 10,
                    padding: '12px 14px',
                    fontSize: 12,
                    color: C.text2,
                    lineHeight: 1.6,
                  }}
                >
                  Browsing <span style={{ color: C.accent, fontWeight: 600 }}>{activeTab.title || activeTab.url}</span>. Ready to assist.
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    Quick Actions
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {[
                      { icon: '🔖', label: 'Save bookmark' },
                      { icon: '📤', label: 'Share page' },
                      { icon: '📱', label: 'Save as App' },
                    ].map(action => (
                      <button
                        key={action.label}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'none',
                          border: `1px solid ${C.border2}`,
                          borderRadius: 8,
                          padding: '9px 12px',
                          color: C.text2,
                          fontSize: 13,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{action.icon}</span>
                          <span>{action.label}</span>
                        </span>
                        <span style={{ color: C.muted, fontSize: 12 }}>→</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div
                style={{
                  background: 'rgba(241,245,249,0.04)',
                  border: `1px solid ${C.border2}`,
                  borderRadius: 10,
                  padding: '12px 14px',
                  fontSize: 12,
                  color: C.muted,
                  lineHeight: 1.6,
                }}
              >
                Open an app or navigate to a URL to get context-aware assistance.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom agent toolbar */}
      <div
        style={{
          background: C.bgMid,
          borderTop: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #a3862a, #c8a84b)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              color: '#fff',
              fontWeight: 700,
            }}
          >
            CD
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>CD · Browser Assistant</div>
            <div style={{ fontSize: 11, color: C.muted }}>
              {activeTab ? `${activeTab.url} · Secure connection` : 'No active tab'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { icon: '🔖', label: 'Bookmark' },
            { icon: '📤', label: 'Share' },
            { icon: '📱', label: 'Save as App' },
          ].map(btn => (
            <button
              key={btn.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(241,245,249,0.06)',
                border: `1px solid ${C.border}`,
                borderRadius: 7,
                padding: '6px 12px',
                color: C.text2,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <span>{btn.icon}</span>
              <span>{btn.label}</span>
            </button>
          ))}
        </div>
      </div>

      {showAddModal && (
        <AddAppModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddApp}
        />
      )}
    </div>
  );
}
