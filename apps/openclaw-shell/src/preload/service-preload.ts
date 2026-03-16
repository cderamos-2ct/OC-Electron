/**
 * service-preload.ts — Base Preload for Service Webviews
 *
 * This script runs in a sandboxed context with contextIsolation=true.
 * It is the security boundary between webview content and the host.
 * Never expose Node.js or Electron internals to page scripts.
 */

import { contextBridge, ipcRenderer } from 'electron';
import { extractPageContext } from './adapters/generic-adapter';

// ─── MutationObserver State ───────────────────────────────────────────────────

let _observer: MutationObserver | null = null;
let _debounceTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 500;

// ─── Notification Interception ────────────────────────────────────────────────

const OriginalNotification = window.Notification;

class InterceptedNotification extends OriginalNotification {
  constructor(title: string, options?: NotificationOptions) {
    super(title, options);
    // Forward to host shell so it can display native notifications
    ipcRenderer.sendToHost('observe:notification', {
      title,
      body: options?.body ?? '',
      tag: options?.tag ?? '',
    });
  }
}

// Preserve static properties (permission, requestPermission)
Object.defineProperty(InterceptedNotification, 'permission', {
  get: () => OriginalNotification.permission,
});
InterceptedNotification.requestPermission =
  OriginalNotification.requestPermission.bind(OriginalNotification);

window.Notification = InterceptedNotification as typeof Notification;

// ─── Badge Update Helper ──────────────────────────────────────────────────────

function sendBadgeUpdate(count: number): void {
  ipcRenderer.sendToHost('observe:badge', { count });
}

// sendBadgeUpdate is module-scoped; used within preload only (no window assignment needed)

// ─── Observation Helpers ──────────────────────────────────────────────────────

import type { ObserveConfig } from '../shared/types.js';

function startObserving(config: ObserveConfig = {}): void {
  stopObserving();
  const target = config.observeSelector
    ? (document.querySelector(config.observeSelector) ?? document.body)
    : document.body;

  _observer = new MutationObserver((mutations) => {
    if (_debounceTimer !== null) clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => {
      try {
        let addedNodes = 0;
        let removedNodes = 0;
        let textChanges = 0;
        for (const m of mutations) {
          addedNodes += m.addedNodes.length;
          removedNodes += m.removedNodes.length;
          if (m.type === 'characterData') textChanges += 1;
        }
        ipcRenderer.sendToHost('observe:mutation', {
          addedNodes,
          removedNodes,
          textChanges,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[openclaw/preload] observe:mutation failed:', err);
      }
    }, DEBOUNCE_MS);
  });

  _observer.observe(target, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function stopObserving(): void {
  if (_debounceTimer !== null) {
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
  }
  if (_observer) {
    _observer.disconnect();
    _observer = null;
  }
}

// ─── IPC Host Command Listeners ───────────────────────────────────────────────

ipcRenderer.on('observe:extract', () => {
  try {
    const result = extractPageContext();
    ipcRenderer.sendToHost('observe:page-context', result);
  } catch (err) {
    console.error('[openclaw/preload] observe:extract failed:', err);
  }
});

ipcRenderer.on('observe:start', (_event, config: ObserveConfig) => {
  try {
    startObserving(config);
  } catch (err) {
    console.error('[openclaw/preload] observe:start failed:', err);
  }
});

ipcRenderer.on('observe:stop', () => {
  stopObserving();
});

// Placeholder for Phase 5 action bridge
ipcRenderer.on('action:execute', (_event, _payload: unknown) => {
  // TODO Phase 5: Route action to openclawAction.execute
});

// ─── contextBridge API Exposure ───────────────────────────────────────────────

/**
 * window.openclawObserve
 * Read-only observation surface for agents bound to this service.
 */
contextBridge.exposeInMainWorld('openclawObserve', {
  /**
   * Extracts current page context via the generic adapter.
   * structuredContent is null in the base preload; adapters may override.
   */
  extractPageContext,

  /**
   * Sets up a MutationObserver on the given selector (default: document.body).
   * Changes are debounced 500ms and sent to the host via observe:mutation.
   */
  startObserving,

  /**
   * Disconnects any active MutationObserver.
   */
  stopObserving,

  /**
   * Returns the current unread/badge count.
   * Default is 0; service-specific adapters override this.
   */
  getUnreadCount(): number {
    return 0;
  },
});

/**
 * window.openclawAction
 * Controlled action surface. All actions are routed through the main process
 * so they can be audited and rate-limited.
 */
contextBridge.exposeInMainWorld('openclawAction', {
  async execute(
    actionType: string,
    params: Record<string, unknown>,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await ipcRenderer.invoke('service:action', {
        actionType,
        params,
        url: location.href,
      });
      return result as { success: boolean; error?: string };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
});
