// ─── Browser Action Types ────────────────────────────────────────────────────

export type BrowserTabState = 'loading' | 'ready' | 'error' | 'blank' | 'failed' | 'crashed';

export type BrowserTab = {
  id: string;
  url: string;
  title: string;
  state: BrowserTabState;
  /** Alias used by webview event handlers - same semantic as state */
  loadState?: BrowserTabState;
  favicon?: string;
  isPinned: boolean;
  agentId?: string;
  canGoBack?: boolean;
  canGoForward?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BrowserViewConfig = {
  tabId: string;
  url: string;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type AgentBrowserOverlay = {
  agentId: string;
  tabId: string;
  highlightSelector?: string;
  tooltipText?: string;
  isActive: boolean;
};

export type AddAppConfig = {
  name: string;
  url: string;
  iconUrl?: string;
  description?: string;
  agentId?: string;
  autoPin?: boolean;
};

// ─── Browser Action Result ───────────────────────────────────────────────────

export type BrowserAction =
  | { type: 'navigate'; url: string; tabId?: string }
  | { type: 'click'; selector: string; tabId?: string }
  | { type: 'fill'; selector: string; value: string; tabId?: string }
  | { type: 'screenshot'; tabId?: string; fullPage?: boolean }
  | { type: 'read'; tabId?: string; selector?: string }
  | { type: 'scroll'; selector?: string; deltaY: number; tabId?: string }
  | { type: 'wait'; ms: number; tabId?: string }
  | { type: 'evaluate'; expression: string; tabId?: string }
  | { type: 'network-enable'; tabId?: string }
  | { type: 'get-document'; tabId?: string }
  | { type: 'add-tab'; config: AddAppConfig }
  | { type: 'close-tab'; tabId: string }
  | { type: 'pin-tab'; tabId: string }
  | { type: 'unpin-tab'; tabId: string }
  | { type: 'list-tabs' };

export type BrowserActionResult = {
  success: boolean;
  tabId?: string;
  data?: unknown;
  screenshotBase64?: string;
  error?: string;
  durationMs: number;
};
