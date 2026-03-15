import React, { useEffect } from 'react';
import { useShellStore } from './stores/shell-store';
import { on } from './lib/ipc-client';
import { TabBar } from './components/shell/TabBar';
import { ServiceWebview } from './components/services/ServiceWebview';
import { ChatRail } from './components/rail/ChatRail';
import { AgentStatusBar, ToastStack, ActionPanel } from './components/overlay';

export function App() {
  const services = useShellStore((s) => s.services);
  const activeServiceId = useShellStore((s) => s.activeServiceId);
  const setActiveService = useShellStore((s) => s.setActiveService);
  const removeService = useShellStore((s) => s.removeService);

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

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        height: '100%',
        background: 'var(--bg-primary)',
        overflow: 'hidden',
      }}
    >
      {/* Content area: tab bar + webviews */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        <TabBar />

        {/* Webview + overlay container */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Webview container — all webviews mounted simultaneously, only active is visible */}
          <div
            style={{
              flex: 1,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {services.map((service) => (
              <ServiceWebview key={service.id} service={service} />
            ))}

            {/* Toast notifications (top-right of content area) */}
            <ToastStack />

            {/* Floating action panel (above status bar) */}
            <ActionPanel />
          </div>

          {/* Agent status bar (bottom of content area) */}
          <AgentStatusBar />
        </div>
      </div>

      {/* CD Chat Rail (right) */}
      <ChatRail />
    </div>
  );
}
