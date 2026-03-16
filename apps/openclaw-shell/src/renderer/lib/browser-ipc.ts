// ─── Browser IPC — typed renderer-side wrappers ──────────────────────────────
// Delegates all calls to window.electronAPI (set up in preload.ts).

import type { BrowserTab } from '../../shared/types.js';

type Unsubscribe = () => void;

export interface BrowserActionResult {
  success: boolean;
  data?: unknown;
  screenshotBase64?: string;
  error?: string;
  durationMs: number;
}

// ── Navigation & Interaction ───────────────────────────────────────────────

export function browserNavigate(url: string, tabId?: string): Promise<BrowserActionResult> {
  return window.electronAPI.browserNavigate(url, tabId) as Promise<BrowserActionResult>;
}

export function browserClick(selector: string, tabId?: string): Promise<BrowserActionResult> {
  return window.electronAPI.browserClick(selector, tabId) as Promise<BrowserActionResult>;
}

export function browserFill(selector: string, value: string, tabId?: string): Promise<BrowserActionResult> {
  return window.electronAPI.browserFill(selector, value, tabId) as Promise<BrowserActionResult>;
}

export function browserScroll(selector: string | undefined, deltaY: number, tabId?: string): Promise<BrowserActionResult> {
  return window.electronAPI.browserScroll(selector, deltaY, tabId) as Promise<BrowserActionResult>;
}

// ── Observation ────────────────────────────────────────────────────────────

export function browserScreenshot(tabId?: string, fullPage?: boolean): Promise<BrowserActionResult> {
  return window.electronAPI.browserScreenshot(tabId, fullPage) as Promise<BrowserActionResult>;
}

export function browserRead(tabId?: string, selector?: string): Promise<BrowserActionResult> {
  return window.electronAPI.browserRead(tabId, selector) as Promise<BrowserActionResult>;
}

export function browserGetDocument(tabId?: string): Promise<BrowserActionResult> {
  return window.electronAPI.browserGetDocument(tabId) as Promise<BrowserActionResult>;
}

// ── Scripting ─────────────────────────────────────────────────────────────

export function browserEvaluate(expression: string, tabId?: string): Promise<BrowserActionResult> {
  return window.electronAPI.browserEvaluate(expression, tabId) as Promise<BrowserActionResult>;
}

export function browserWait(ms: number, tabId?: string): Promise<BrowserActionResult> {
  return window.electronAPI.browserWait(ms, tabId) as Promise<BrowserActionResult>;
}

export function browserNetworkEnable(tabId?: string): Promise<BrowserActionResult> {
  return window.electronAPI.browserNetworkEnable(tabId) as Promise<BrowserActionResult>;
}

// ── Tab Management ────────────────────────────────────────────────────────

export function browserAddTab(name: string, url: string, agentId?: string, autoPin?: boolean): Promise<BrowserTab> {
  return window.electronAPI.browserAddTab(name, url, agentId, autoPin) as Promise<BrowserTab>;
}

export function browserCloseTab(tabId: string): Promise<{ ok: boolean }> {
  return window.electronAPI.browserCloseTab(tabId) as Promise<{ ok: boolean }>;
}

export function browserPinTab(tabId: string): Promise<BrowserTab> {
  return window.electronAPI.browserPinTab(tabId) as Promise<BrowserTab>;
}

export function browserUnpinTab(tabId: string): Promise<BrowserTab> {
  return window.electronAPI.browserUnpinTab(tabId) as Promise<BrowserTab>;
}

export function browserListTabs(): Promise<BrowserTab[]> {
  return window.electronAPI.browserListTabs() as Promise<BrowserTab[]>;
}

// ── Events ────────────────────────────────────────────────────────────────

export function onBrowserTabUpdated(callback: (tab: BrowserTab) => void): Unsubscribe {
  return window.electronAPI.onBrowserTabUpdated(callback);
}

export function onBrowserTabRemoved(callback: (data: { tabId: string }) => void): Unsubscribe {
  return window.electronAPI.onBrowserTabRemoved(callback);
}

export function onBrowserTabsList(callback: (tabs: BrowserTab[]) => void): Unsubscribe {
  return window.electronAPI.onBrowserTabsList(callback);
}
