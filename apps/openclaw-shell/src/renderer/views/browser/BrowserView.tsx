import React, { useState, useEffect, useRef } from 'react';
import { useBrowserStore, PinnedApp } from '../../stores/browser-store';
import { BrowserTabBar } from './BrowserTabBar';
import { BrowserToolbar } from './BrowserToolbar';
import { PinnedAppGrid } from './PinnedAppGrid';
import { AddAppModal } from './AddAppModal';

// ─── Per-tab webview pane ─────────────────────────────────────────────────────
// Note: JSX.IntrinsicElements['webview'] is declared in ServiceWebview.tsx

interface TabWebviewProps {
  tabId: string;
  url: string;
  isActive: boolean;
}

function TabWebview({ tabId, url, isActive }: TabWebviewProps) {
  const webviewRef = useRef<HTMLElement>(null);
  const updateTab = useBrowserStore((s) => s.updateTab);

  useEffect(() => {
    const wv = webviewRef.current as (HTMLElement & {
      addEventListener: (e: string, h: (ev: Event) => void) => void;
      removeEventListener: (e: string, h: (ev: Event) => void) => void;
      reload: () => void;
      goBack: () => void;
      goForward: () => void;
    }) | null;

    if (!wv) return;

    const onFinishLoad = () => {
      updateTab(tabId, { state: 'ready' });
    };

    const onFailLoad = () => {
      updateTab(tabId, { state: 'error' });
    };

    const onCrashed = () => {
      updateTab(tabId, { state: 'error' });
    };

    const onTitleUpdated = (e: Event) => {
      const ev = e as Event & { title?: string };
      if (ev.title) updateTab(tabId, { title: ev.title });
    };

    const onFaviconUpdated = (e: Event) => {
      const ev = e as Event & { favicons?: string[] };
      if (ev.favicons && ev.favicons.length > 0) {
        updateTab(tabId, { favicon: ev.favicons[0] });
      }
    };

    const onDidNavigate = (e: Event) => {
      const ev = e as Event & { url?: string };
      if (ev.url) {
        updateTab(tabId, { url: ev.url, state: 'ready' });
      }
    };

    const onNewWindow = (e: Event) => {
      const ev = e as Event & { url?: string };
      if (ev.url) {
        window.electronAPI?.openExternal?.(ev.url);
      }
    };

    wv.addEventListener('did-finish-load', onFinishLoad);
    wv.addEventListener('did-fail-load', onFailLoad);
    wv.addEventListener('crashed', onCrashed);
    wv.addEventListener('page-title-updated', onTitleUpdated);
    wv.addEventListener('page-favicon-updated', onFaviconUpdated);
    wv.addEventListener('did-navigate', onDidNavigate);
    wv.addEventListener('new-window', onNewWindow);

    // Handle reload signal from BrowserToolbar
    const handleReload = (e: Event) => {
      const ev = e as CustomEvent<{ tabId: string }>;
      if (ev.detail?.tabId === tabId) {
        wv.reload();
        updateTab(tabId, { state: 'loading' });
      }
    };
    window.addEventListener('browser:reload', handleReload as EventListener);

    return () => {
      wv.removeEventListener('did-finish-load', onFinishLoad);
      wv.removeEventListener('did-fail-load', onFailLoad);
      wv.removeEventListener('crashed', onCrashed);
      wv.removeEventListener('page-title-updated', onTitleUpdated);
      wv.removeEventListener('page-favicon-updated', onFaviconUpdated);
      wv.removeEventListener('did-navigate', onDidNavigate);
      wv.removeEventListener('new-window', onNewWindow);
      window.removeEventListener('browser:reload', handleReload as EventListener);
    };
  }, [tabId, updateTab]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: isActive ? 'flex' : 'none',
        flexDirection: 'column',
      }}
    >
      <webview
        ref={webviewRef as React.RefObject<HTMLElement>}
        src={url}
        partition="persist:browser"
        allowpopups={true}
        webpreferences="contextIsolation=yes, nodeIntegration=no, sandbox=yes"
        style={{ width: '100%', height: '100%', border: 'none', flex: 1 }}
      />
    </div>
  );
}

// ─── Main BrowserView ─────────────────────────────────────────────────────────

export function BrowserView() {
  const tabs = useBrowserStore((s) => s.tabs);
  const activeTabId = useBrowserStore((s) => s.activeTabId);
  const addTab = useBrowserStore((s) => s.addTab);

  const [showAddModal, setShowAddModal] = useState(false);

  const handleNewTab = () => {
    addTab({ url: 'about:blank', title: 'New Tab' });
  };

  const handleOpenApp = (app: PinnedApp) => {
    addTab({ url: app.url, title: app.name, favicon: app.iconUrl });
  };

  const showNewTabPage = tabs.length === 0 || activeTabId === null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      {/* Tab bar */}
      <BrowserTabBar onNewTab={handleNewTab} />

      {/* Toolbar */}
      <BrowserToolbar tabId={activeTabId} />

      {/* Content area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* New tab / home page */}
        {showNewTabPage && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--bg)',
            }}
          >
            <PinnedAppGrid
              onOpenApp={handleOpenApp}
              onShowAddModal={() => setShowAddModal(true)}
            />
          </div>
        )}

        {/* Webview panes — one per tab, all mounted, toggled by display */}
        {tabs.map((tab) => (
          <TabWebview
            key={tab.id}
            tabId={tab.id}
            url={tab.url}
            isActive={tab.id === activeTabId && !showNewTabPage}
          />
        ))}
      </div>

      {/* Add App modal */}
      {showAddModal && <AddAppModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}
