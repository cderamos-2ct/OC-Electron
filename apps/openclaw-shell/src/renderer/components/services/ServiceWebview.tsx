import React, { useEffect, useRef, useState } from 'react';
import { ServiceConfig } from '../../../shared/types';
import { useShellStore } from '../../stores/shell-store';
import { invoke } from '../../lib/ipc-client';

// Electron's <webview> tag requires a type declaration
declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          partition?: string;
          preload?: string;
          allowpopups?: boolean | string;
          webpreferences?: string;
        },
        HTMLElement
      >;
    }
  }
}

interface ServiceWebviewProps {
  service: ServiceConfig;
}

type LoadState = 'loading' | 'ready' | 'crashed' | 'failed';

export function ServiceWebview({ service }: ServiceWebviewProps) {
  const activeServiceId = useShellStore((s) => s.activeServiceId);
  const serviceStates = useShellStore((s) => s.serviceStates);
  const updateServiceState = useShellStore((s) => s.updateServiceState);
  const updateBadge = useShellStore((s) => s.updateBadge);
  const isActive = service.id === activeServiceId;
  const webviewRef = useRef<HTMLElement>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');

  const serviceState = serviceStates[service.id];
  const isHibernated = serviceState === 'hibernated';

  // Resolve preload path — renderer can access __dirname via vite define or window.__preloadPath
  const preloadPath =
    typeof window !== 'undefined' && (window as Window & { __servicePreloadPath?: string }).__servicePreloadPath
      ? (window as Window & { __servicePreloadPath?: string }).__servicePreloadPath
      : undefined;

  useEffect(() => {
    const wv = webviewRef.current as HTMLElement & {
      addEventListener: (event: string, handler: (e: Event) => void) => void;
      removeEventListener: (event: string, handler: (e: Event) => void) => void;
      reload: () => void;
      send: (channel: string, ...args: unknown[]) => void;
    } | null;

    if (!wv) return;

    const handleFinishLoad = () => {
      setLoadState('ready');
      updateServiceState(service.id, 'active');
    };

    const handleFailLoad = () => {
      setLoadState('failed');
    };

    const handleCrashed = () => {
      setLoadState('crashed');
      updateServiceState(service.id, 'loading');
    };

    const handleTitleUpdated = (e: Event) => {
      const ev = e as Event & { title?: string };
      if (ev.title) {
        // Notify main process via IPC if needed in Phase 2
      }
    };

    const handleFaviconUpdated = (e: Event) => {
      const ev = e as Event & { favicons?: string[] };
      if (ev.favicons && ev.favicons.length > 0) {
        // Store favicon update via store action in Phase 2
      }
    };

    const handleNewWindow = (e: Event) => {
      const event = e as Event & { url?: string };
      if (event.url) {
        window.electronAPI?.openExternal?.(event.url);
      }
    };

    // Auto-fill: relay vault queries between webview preload and main process
    const handleIpcMessage = (e: Event) => {
      const ipcEvent = e as Event & { channel?: string; args?: unknown[] };
      const channel = ipcEvent.channel;
      const args = ipcEvent.args ?? [];

      if (channel === 'vault:autofill-query') {
        void invoke('vault:autofill-query', args[0] as { url: string }).then((result) => {
          wv?.send('vault:autofill-response', result);
        }).catch(() => {
          wv?.send('vault:autofill-response', null);
        });
      } else if (channel === 'vault:autofill-used') {
        void invoke('vault:autofill-used', args[0] as { secretName: string; url: string }).catch(() => {});
      } else if (channel === 'vault:autofill-offer-save') {
        void invoke('vault:autofill-offer-save', args[0] as { url: string; username: string; password: string }).catch(() => {});
      }
    };

    wv.addEventListener('did-finish-load', handleFinishLoad);
    wv.addEventListener('did-fail-load', handleFailLoad);
    wv.addEventListener('crashed', handleCrashed);
    wv.addEventListener('page-title-updated', handleTitleUpdated);
    wv.addEventListener('page-favicon-updated', handleFaviconUpdated);
    wv.addEventListener('new-window', handleNewWindow);
    wv.addEventListener('ipc-message', handleIpcMessage);

    return () => {
      wv.removeEventListener('did-finish-load', handleFinishLoad);
      wv.removeEventListener('did-fail-load', handleFailLoad);
      wv.removeEventListener('crashed', handleCrashed);
      wv.removeEventListener('page-title-updated', handleTitleUpdated);
      wv.removeEventListener('page-favicon-updated', handleFaviconUpdated);
      wv.removeEventListener('new-window', handleNewWindow);
      wv.removeEventListener('ipc-message', handleIpcMessage);
    };
  }, [service.id, updateBadge, updateServiceState]);

  const handleReload = () => {
    const wv = webviewRef.current as HTMLElement & { reload: () => void } | null;
    if (wv) {
      setLoadState('loading');
      wv.reload();
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: isActive ? 'flex' : 'none',
        flexDirection: 'column',
      }}
    >
      {/* Loading spinner */}
      {loadState === 'loading' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              border: '3px solid var(--border-default)',
              borderTopColor: 'var(--accent-blue)',
              borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }}
          />
        </div>
      )}

      {/* Crash indicator */}
      {loadState === 'crashed' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
            color: 'var(--text-secondary)',
            gap: '12px',
            zIndex: 10,
          }}
        >
          <span style={{ fontSize: '14px' }}>This service crashed.</span>
          <button
            onClick={handleReload}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              background: 'var(--accent-blue)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Reload
          </button>
        </div>
      )}

      {/* Webview — hidden (not destroyed) when hibernated */}
      {!isHibernated && (
        <webview
          ref={webviewRef as React.RefObject<HTMLElement>}
          src={service.url}
          partition={service.partition}
          {...(preloadPath ? { preload: preloadPath } : {})}
          allowpopups={true}
          webpreferences="contextIsolation=yes, nodeIntegration=no, sandbox=yes"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            flex: 1,
          }}
        />
      )}

      {/* Hibernated placeholder */}
      {isHibernated && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
            color: 'var(--text-secondary)',
            fontSize: '13px',
          }}
        >
          {service.name} is hibernated
        </div>
      )}
    </div>
  );
}

// Window.electronAPI type is declared in renderer/lib/ipc-client.ts
