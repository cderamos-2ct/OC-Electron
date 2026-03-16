import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BrowserTab, AddAppConfig } from '@openclaw/core';

// Re-export canonical types for use in view components
export type { BrowserTab, AddAppConfig };

// ─── Store-local types ────────────────────────────────────────────────────────

/** Pinned app entry — AddAppConfig + a stable local id for keying */
export interface PinnedApp extends AddAppConfig {
  /** Locally-generated stable id (not in the canonical AddAppConfig) */
  localId: string;
}

// ─── State / Actions ─────────────────────────────────────────────────────────

interface BrowserState {
  tabs: BrowserTab[];
  activeTabId: string | null;
  pinnedApps: PinnedApp[];
  /** Per-tab URL history stack for back-navigation */
  tabHistory: Record<string, string[]>;
}

interface BrowserActions {
  // Tab management
  addTab: (partial: Pick<BrowserTab, 'url' | 'title'> & Partial<BrowserTab>) => string;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, patch: Partial<BrowserTab>) => void;

  // Navigation
  navigateTab: (tabId: string, url: string) => void;
  goBack: (tabId: string) => void;
  goForward: (tabId: string) => void;

  // Tab ordering
  reorderTabs: (orderedIds: string[]) => void;

  // Pinned apps (persisted)
  addPinnedApp: (app: AddAppConfig) => void;
  removePinnedApp: (localId: string) => void;

  // Agent overlay
  setAgentOverlay: (tabId: string, agentId: string | undefined) => void;
}

type BrowserStore = BrowserState & BrowserActions;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeTab(partial: Pick<BrowserTab, 'url' | 'title'> & Partial<BrowserTab>): BrowserTab {
  const now = new Date().toISOString();
  return {
    state: 'loading',
    isPinned: false,
    createdAt: now,
    updatedAt: now,
    ...partial,
    id: generateId('tab'),
  };
}

// ─── Persisted slice ──────────────────────────────────────────────────────────

interface PersistedSlice {
  pinnedApps: PinnedApp[];
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useBrowserStore = create<BrowserStore>()(
  persist(
    (set, get) => ({
      // ── State ──────────────────────────────────────────────────────────────
      tabs: [],
      activeTabId: null,
      pinnedApps: [],
      tabHistory: {},

      // ── Tab management ─────────────────────────────────────────────────────

      addTab: (partial) => {
        const tab = makeTab(partial);
        set((state) => ({
          tabs: [...state.tabs, tab],
          activeTabId: tab.id,
          tabHistory: { ...state.tabHistory, [tab.id]: [tab.url] },
        }));
        return tab.id;
      },

      closeTab: (tabId) => {
        set((state) => {
          const remaining = state.tabs.filter((t) => t.id !== tabId);
          let nextActiveId = state.activeTabId;

          if (state.activeTabId === tabId) {
            if (remaining.length > 0) {
              const closedIdx = state.tabs.findIndex((t) => t.id === tabId);
              const nextIdx = Math.min(closedIdx, remaining.length - 1);
              nextActiveId = remaining[nextIdx].id;
            } else {
              nextActiveId = null;
            }
          }

          const { [tabId]: _removed, ...restHistory } = state.tabHistory;
          return { tabs: remaining, activeTabId: nextActiveId, tabHistory: restHistory };
        });
      },

      setActiveTab: (tabId) => set({ activeTabId: tabId }),

      updateTab: (tabId, patch) => {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t
          ),
        }));
      },

      // ── Navigation ─────────────────────────────────────────────────────────

      navigateTab: (tabId, url) => {
        set((state) => {
          const history = state.tabHistory[tabId] ?? [];
          return {
            tabs: state.tabs.map((t) =>
              t.id === tabId
                ? { ...t, url, state: 'loading' as const, updatedAt: new Date().toISOString() }
                : t
            ),
            tabHistory: { ...state.tabHistory, [tabId]: [...history, url] },
          };
        });
      },

      goBack: (tabId) => {
        const state = get();
        const history = state.tabHistory[tabId] ?? [];
        if (history.length < 2) return;
        const prevHistory = history.slice(0, -1);
        const prevUrl = prevHistory[prevHistory.length - 1];
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId
              ? { ...t, url: prevUrl, state: 'loading' as const, updatedAt: new Date().toISOString() }
              : t
          ),
          tabHistory: { ...s.tabHistory, [tabId]: prevHistory },
        }));
      },

      goForward: (_tabId) => {
        // Stub — the webview/CDP layer handles forward navigation.
        // State is updated reactively via updateTab from the webview did-navigate event.
      },

      // ── Tab ordering ───────────────────────────────────────────────────────

      reorderTabs: (orderedIds) => {
        set((state) => {
          const map = new Map(state.tabs.map((t) => [t.id, t]));
          const reordered: BrowserTab[] = [];
          orderedIds.forEach((id) => {
            const t = map.get(id);
            if (t) reordered.push(t);
          });
          state.tabs.forEach((t) => {
            if (!orderedIds.includes(t.id)) reordered.push(t);
          });
          return { tabs: reordered };
        });
      },

      // ── Pinned apps ────────────────────────────────────────────────────────

      addPinnedApp: (app) => {
        set((state) => {
          const exists = state.pinnedApps.some((a) => a.url === app.url);
          if (exists) return {};
          const pinned: PinnedApp = { ...app, localId: generateId('app') };
          return { pinnedApps: [...state.pinnedApps, pinned] };
        });
      },

      removePinnedApp: (localId) => {
        set((state) => ({
          pinnedApps: state.pinnedApps.filter((a) => a.localId !== localId),
        }));
      },

      // ── Agent overlay ──────────────────────────────────────────────────────

      setAgentOverlay: (tabId, agentId) => {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId
              ? { ...t, agentId, updatedAt: new Date().toISOString() }
              : t
          ),
        }));
      },
    }),
    {
      name: 'openclaw-browser-store',
      // Only persist pinnedApps; tabs are ephemeral session state
      partialize: (state): PersistedSlice => ({ pinnedApps: state.pinnedApps }),
    }
  )
);
