import React, { useEffect, useCallback } from 'react';
import { useShellStore } from './stores/shell-store';
import { on } from './lib/ipc-client';
import { TabBar } from './components/shell/TabBar';
import { ViewContainer } from './components/shell/ViewContainer';
import { ServiceWebview } from './components/services/ServiceWebview';
import { ChatRail } from './components/rail/ChatRail';
import { AgentStatusBar, ToastStack, ActionPanel } from './components/overlay';
import { useViewStore } from './stores/view-store';
import { useSetupStore } from './stores/setup-store';
import { SetupWizard } from './views/setup/SetupWizard';
import type { SetupResult } from './views/setup/SetupWizard';
import { BootstrapOverlay } from './views/setup/BootstrapOverlay';

export function App() {
  const services = useShellStore((s) => s.services);
  const activeServiceId = useShellStore((s) => s.activeServiceId);
  const setActiveService = useShellStore((s) => s.setActiveService);
  const removeService = useShellStore((s) => s.removeService);
  const activeView = useViewStore((s) => s.activeView);
  const setupComplete = useSetupStore((s) => s.setupComplete);
  const setupLoading = useSetupStore((s) => s.setupLoading);
  const bootstrapping = useSetupStore((s) => s.bootstrapping);
  const bootstrapConfig = useSetupStore((s) => s.bootstrapConfig);

  // Check setup status on mount
  useEffect(() => {
    window.electronAPI.setupCheck().then((result: unknown) => {
      const r = result as { setupComplete: boolean; config?: { userName?: string } };
      useSetupStore.getState().setSetupComplete(r.setupComplete);
      if (r.config?.userName) {
        useSetupStore.getState().setUserName(r.config.userName);
      }
      useSetupStore.getState().setSetupLoading(false);
    }).catch(() => {
      useSetupStore.getState().setSetupLoading(false);
    });
  }, []);

  const handleSetupComplete = useCallback((result: SetupResult) => {
    const config = {
      ...result,
      completedAt: new Date().toISOString(),
    };
    window.electronAPI.setupComplete(config).then(() => {
      useSetupStore.getState().setUserName(result.userName);
      // Transition to bootstrap phase — agents pull initial data
      useSetupStore.getState().setBootstrapping(true, {
        userName: result.userName,
        enabledServices: result.enabledServices,
        agents: result.agents,
      });
    }).catch(console.error);
  }, []);

  const handleBootstrapComplete = useCallback(() => {
    useSetupStore.getState().setBootstrapping(false);
    useSetupStore.getState().setSetupComplete(true);
  }, []);

  // Handle IPC events from the main process
  useEffect(() => {
    const unsubFocus = on('shell:focus-service', (payload) => {
      if ('serviceId' in payload) {
        setActiveService(payload.serviceId);
      } else if ('serviceIndex' in payload) {
        const sorted = [...services].sort((a, b) => a.order - b.order);
        const target = sorted[payload.serviceIndex];
        if (target) setActiveService(target.id);
      }
    });

    const unsubCloseTab = on('shell:close-active-tab', () => {
      const sorted = [...services].sort((a, b) => a.order - b.order);
      const current = sorted.find((s) => s.id === activeServiceId);
      if (current && !current.pinned) {
        removeService(current.id);
      }
    });

    const unsubToggleRail = on('shell:toggle-rail', () => {
      useShellStore.getState().toggleRail();
    });

    return () => {
      unsubFocus();
      unsubCloseTab();
      unsubToggleRail();
    };
  }, [services, activeServiceId, setActiveService, removeService]);

  // Browser view uses existing ServiceWebview infrastructure
  const isBrowserView = activeView === 'browser';

  return (
    <>
      {/* Setup wizard overlay */}
      {!setupLoading && !setupComplete && !bootstrapping && (
        <SetupWizard onComplete={handleSetupComplete} />
      )}

      {/* Bootstrap overlay — agents pull initial data after setup */}
      {bootstrapping && bootstrapConfig && (
        <BootstrapOverlay config={bootstrapConfig} onComplete={handleBootstrapComplete} />
      )}

      {/* Loading state while checking setup */}
      {setupLoading && (
        <div style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
          zIndex: 9999,
        }}>
          <div style={{
            fontFamily: "'Cinzel', serif",
            fontSize: '18px',
            color: 'var(--accent)',
            letterSpacing: '2px',
          }}>
            AE
          </div>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: 'var(--bg)',
          overflow: 'hidden',
        }}
      >
      {/* Title bar drag region with branding */}
      <div
        style={{
          height: '38px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          // @ts-expect-error Electron CSS property
          WebkitAppRegion: 'drag',
          background: 'var(--bg)',
          borderBottom: '1px solid var(--border)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <span
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: '12px',
            letterSpacing: '1px',
            color: 'var(--dimmer)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span style={{ fontWeight: 700, color: 'var(--text-3)' }}>AE</span>
          <span style={{ color: 'var(--muted)', fontSize: '10px' }}>|</span>
          <span style={{ letterSpacing: '0.5px' }}>Aegilume</span>
        </span>
      </div>

      {/* Tab bar navigation */}
      <TabBar />

      {/* App shell: main content + chat rail */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {/* Main content: view router or webviews */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          }}
        >
          {/* View router -- shown for all non-browser views */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: isBrowserView ? 'none' : 'flex',
              flexDirection: 'column',
            }}
          >
            <ViewContainer />
          </div>

          {/* Webview container -- shown for browser view (ServiceWebview) */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: isBrowserView ? 'flex' : 'none',
              flexDirection: 'column',
            }}
          >
            {services.map((service) => (
              <ServiceWebview key={service.id} service={service} />
            ))}
          </div>

          {/* Toast notifications (top-right of content area) */}
          <ToastStack />

          {/* Floating action panel (above status bar) */}
          <ActionPanel />

          {/* Agent status bar (bottom of content area) */}
          <AgentStatusBar />
        </div>

        {/* CD Chat Rail (right) */}
        <ChatRail />
      </div>
    </div>
    </>
  );
}
