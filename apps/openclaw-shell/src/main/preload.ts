import { contextBridge, ipcRenderer } from 'electron';
import type {
  MainToRendererEvents,
  RendererToMainHandlers,
  GatewayConnectionState,
  ServiceConfig,
  TaskPatch,
  QuickDecision,
  ShellConfig,
} from '../shared/types.js';

type MainToRendererChannel = keyof MainToRendererEvents;
type RendererToMainChannel = keyof RendererToMainHandlers;
type Unsubscribe = () => void;

// Allowed channels for invoke (renderer -> main)
const INVOKE_CHANNELS: RendererToMainChannel[] = [
  'gateway:rpc',
  'gateway:agent-rpc',
  'task:list',
  'task:get',
  'task:mutate',
  'task:quick-decision',
  'task:batch-approve',
  'service:list',
  'service:add',
  'service:remove',
  'service:reload',
  'service:hibernate',
  'shell:get-config',
  'shell:set-config',
  'shell:quit',
  'agent:bindings',
  'approval:list',
  'approval:decide',
  'approval:rules',
  'approval:revoke-rule',
  'approval:audit-log',
  'api.workers.status',
  'api.gmail.list',
  'api.gmail.get',
  'api.gmail.archive',
  'api.gmail.label',
  'api.gmail.draft',
  'api.gmail.send-draft',
  'api.gmail.delete',
  'api.gmail.batch-modify',
  'api.calendar.list',
  'api.calendar.get',
  'api.calendar.create',
  'api.calendar.update',
  'api.calendar.accept',
  'api.calendar.decline',
  'api.calendar.free-time',
  'api.github.notifications',
  'api.github.notification-read',
  'api.github.prs',
  'api.github.pr',
  'api.github.review',
  'api.github.merge',
  'api.github.issues',
  'api.github.comment',
  'browser:navigate',
  'browser:click',
  'browser:fill',
  'browser:screenshot',
  'browser:read',
  'browser:scroll',
  'browser:wait',
  'browser:evaluate',
  'browser:network-enable',
  'browser:get-document',
  'browser:add-tab',
  'browser:close-tab',
  'browser:pin-tab',
  'browser:unpin-tab',
  'browser:list-tabs',
];

// Allowed channels for on (main -> renderer)
const EVENT_CHANNELS: MainToRendererChannel[] = [
  'gateway:state',
  'gateway:event',
  'task:changed',
  'task:deleted',
  'service:badge-update',
  'service:notification',
  'service:state-change',
  'shell:focus-service',
  'shell:toggle-rail',
  'shell:close-active-tab',
  'agent:status',
  'agent:message',
  'approval:requested',
  'approval:resolved',
  'shell:show-next-approval',
  'shell:restore-state',
  'browser:tab-updated',
  'browser:tab-removed',
  'browser:tabs-list',
];

const electronAPI = {
  // ── Low-level generic API ─────────────────────────────────────────────────

  invoke<C extends RendererToMainChannel>(
    channel: C,
    ...args: RendererToMainHandlers[C]
  ): Promise<unknown> {
    if (!INVOKE_CHANNELS.includes(channel)) {
      return Promise.reject(new Error(`Channel not allowed: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args);
  },

  on<C extends MainToRendererChannel>(
    channel: C,
    callback: (event: Electron.IpcRendererEvent, data: MainToRendererEvents[C]) => void,
  ): Unsubscribe {
    if (!EVENT_CHANNELS.includes(channel)) {
      console.warn(`[preload] Blocked listener on disallowed channel: ${channel}`);
      return () => {};
    }
    ipcRenderer.on(channel, callback);
    return () => ipcRenderer.removeListener(channel, callback);
  },

  removeListener<C extends MainToRendererChannel>(
    channel: C,
    callback: (event: Electron.IpcRendererEvent, data: MainToRendererEvents[C]) => void,
  ): void {
    ipcRenderer.removeListener(channel, callback);
  },

  // ── Shell utilities ───────────────────────────────────────────────────────

  openExternal(url: string): void {
    void ipcRenderer.invoke('shell:open-external', url);
  },

  // ── Gateway ───────────────────────────────────────────────────────────────

  gatewayRpc(method: string, params?: unknown): Promise<unknown> {
    return ipcRenderer.invoke('gateway:rpc', method, params);
  },

  gatewayAgentRpc(agentId: string, method: string, params?: unknown): Promise<unknown> {
    return ipcRenderer.invoke('gateway:agent-rpc', agentId, method, params);
  },

  onGatewayEvent(callback: (evt: unknown) => void): Unsubscribe {
    const handler = (_e: Electron.IpcRendererEvent, evt: unknown) => callback(evt);
    ipcRenderer.on('gateway:event', handler);
    return () => ipcRenderer.removeListener('gateway:event', handler);
  },

  onGatewayState(callback: (state: GatewayConnectionState) => void): Unsubscribe {
    const handler = (_e: Electron.IpcRendererEvent, state: GatewayConnectionState) => callback(state);
    ipcRenderer.on('gateway:state', handler);
    return () => ipcRenderer.removeListener('gateway:state', handler);
  },

  // ── Services ──────────────────────────────────────────────────────────────

  serviceList(): Promise<unknown> {
    return ipcRenderer.invoke('service:list');
  },

  serviceAdd(config: ServiceConfig): Promise<unknown> {
    return ipcRenderer.invoke('service:add', config);
  },

  serviceRemove(id: string): Promise<unknown> {
    return ipcRenderer.invoke('service:remove', id);
  },

  serviceReload(id: string): Promise<unknown> {
    return ipcRenderer.invoke('service:reload', id);
  },

  serviceHibernate(id: string): Promise<unknown> {
    return ipcRenderer.invoke('service:hibernate', id);
  },

  onServiceStateChange(callback: (data: MainToRendererEvents['service:state-change']) => void): Unsubscribe {
    const handler = (_e: Electron.IpcRendererEvent, data: MainToRendererEvents['service:state-change']) => callback(data);
    ipcRenderer.on('service:state-change', handler);
    return () => ipcRenderer.removeListener('service:state-change', handler);
  },

  // ── Tasks ─────────────────────────────────────────────────────────────────

  taskList(): Promise<unknown> {
    return ipcRenderer.invoke('task:list');
  },

  taskGet(id: string): Promise<unknown> {
    return ipcRenderer.invoke('task:get', id);
  },

  taskMutate(id: string, patch: TaskPatch): Promise<unknown> {
    return ipcRenderer.invoke('task:mutate', id, patch);
  },

  taskQuickDecision(id: string, decision: QuickDecision): Promise<unknown> {
    return ipcRenderer.invoke('task:quick-decision', id, decision);
  },

  onTaskChanged(callback: (data: MainToRendererEvents['task:changed']) => void): Unsubscribe {
    const handler = (_e: Electron.IpcRendererEvent, data: MainToRendererEvents['task:changed']) => callback(data);
    ipcRenderer.on('task:changed', handler);
    return () => ipcRenderer.removeListener('task:changed', handler);
  },

  // ── Shell ─────────────────────────────────────────────────────────────────

  shellGetConfig(): Promise<unknown> {
    return ipcRenderer.invoke('shell:get-config');
  },

  shellSetConfig(config: Partial<ShellConfig>): Promise<unknown> {
    return ipcRenderer.invoke('shell:set-config', config);
  },

  shellQuit(): Promise<void> {
    return ipcRenderer.invoke('shell:quit');
  },

  onToggleRail(callback: () => void): Unsubscribe {
    const handler = () => callback();
    ipcRenderer.on('shell:toggle-rail', handler);
    return () => ipcRenderer.removeListener('shell:toggle-rail', handler);
  },

  // ── Approvals (Phase 4) ──────────────────────────────────────────────────

  approvalList(): Promise<unknown> {
    return ipcRenderer.invoke('approval:list');
  },

  approvalDecide(actionId: string, decision: 'approved' | 'denied', alwaysAllow?: boolean): Promise<unknown> {
    return ipcRenderer.invoke('approval:decide', actionId, decision, alwaysAllow);
  },

  approvalRules(): Promise<unknown> {
    return ipcRenderer.invoke('approval:rules');
  },

  approvalRevokeRule(ruleId: string): Promise<unknown> {
    return ipcRenderer.invoke('approval:revoke-rule', ruleId);
  },

  approvalAuditLog(limit?: number): Promise<unknown> {
    return ipcRenderer.invoke('approval:audit-log', limit);
  },

  onApprovalRequested(callback: (data: MainToRendererEvents['approval:requested']) => void): Unsubscribe {
    const handler = (_e: Electron.IpcRendererEvent, data: MainToRendererEvents['approval:requested']) => callback(data);
    ipcRenderer.on('approval:requested', handler);
    return () => ipcRenderer.removeListener('approval:requested', handler);
  },

  onApprovalResolved(callback: (data: MainToRendererEvents['approval:resolved']) => void): Unsubscribe {
    const handler = (_e: Electron.IpcRendererEvent, data: MainToRendererEvents['approval:resolved']) => callback(data);
    ipcRenderer.on('approval:resolved', handler);
    return () => ipcRenderer.removeListener('approval:resolved', handler);
  },

  // ── Notifications ─────────────────────────────────────────────────────────

  onNotification(callback: (data: MainToRendererEvents['service:notification']) => void): Unsubscribe {
    const handler = (_e: Electron.IpcRendererEvent, data: MainToRendererEvents['service:notification']) => callback(data);
    ipcRenderer.on('service:notification', handler);
    return () => ipcRenderer.removeListener('service:notification', handler);
  },

  // ── Browser / CDP ─────────────────────────────────────────────────────────

  browserNavigate(url: string, tabId?: string): Promise<unknown> {
    return ipcRenderer.invoke('browser:navigate', url, tabId);
  },

  browserClick(selector: string, tabId?: string): Promise<unknown> {
    return ipcRenderer.invoke('browser:click', selector, tabId);
  },

  browserFill(selector: string, value: string, tabId?: string): Promise<unknown> {
    return ipcRenderer.invoke('browser:fill', selector, value, tabId);
  },

  browserScreenshot(tabId?: string, fullPage?: boolean): Promise<unknown> {
    return ipcRenderer.invoke('browser:screenshot', tabId, fullPage);
  },

  browserRead(tabId?: string, selector?: string): Promise<unknown> {
    return ipcRenderer.invoke('browser:read', tabId, selector);
  },

  browserScroll(selector: string | undefined, deltaY: number, tabId?: string): Promise<unknown> {
    return ipcRenderer.invoke('browser:scroll', selector, deltaY, tabId);
  },

  browserWait(ms: number, tabId?: string): Promise<unknown> {
    return ipcRenderer.invoke('browser:wait', ms, tabId);
  },

  browserEvaluate(expression: string, tabId?: string): Promise<unknown> {
    return ipcRenderer.invoke('browser:evaluate', expression, tabId);
  },

  browserNetworkEnable(tabId?: string): Promise<unknown> {
    return ipcRenderer.invoke('browser:network-enable', tabId);
  },

  browserGetDocument(tabId?: string): Promise<unknown> {
    return ipcRenderer.invoke('browser:get-document', tabId);
  },

  browserAddTab(name: string, url: string, agentId?: string, autoPin?: boolean): Promise<unknown> {
    return ipcRenderer.invoke('browser:add-tab', name, url, agentId, autoPin);
  },

  browserCloseTab(tabId: string): Promise<unknown> {
    return ipcRenderer.invoke('browser:close-tab', tabId);
  },

  browserPinTab(tabId: string): Promise<unknown> {
    return ipcRenderer.invoke('browser:pin-tab', tabId);
  },

  browserUnpinTab(tabId: string): Promise<unknown> {
    return ipcRenderer.invoke('browser:unpin-tab', tabId);
  },

  browserListTabs(): Promise<unknown> {
    return ipcRenderer.invoke('browser:list-tabs');
  },

  onBrowserTabUpdated(callback: (tab: MainToRendererEvents['browser:tab-updated']) => void): Unsubscribe {
    const handler = (_e: Electron.IpcRendererEvent, tab: MainToRendererEvents['browser:tab-updated']) => callback(tab);
    ipcRenderer.on('browser:tab-updated', handler);
    return () => ipcRenderer.removeListener('browser:tab-updated', handler);
  },

  onBrowserTabRemoved(callback: (data: MainToRendererEvents['browser:tab-removed']) => void): Unsubscribe {
    const handler = (_e: Electron.IpcRendererEvent, data: MainToRendererEvents['browser:tab-removed']) => callback(data);
    ipcRenderer.on('browser:tab-removed', handler);
    return () => ipcRenderer.removeListener('browser:tab-removed', handler);
  },

  onBrowserTabsList(callback: (tabs: MainToRendererEvents['browser:tabs-list']) => void): Unsubscribe {
    const handler = (_e: Electron.IpcRendererEvent, tabs: MainToRendererEvents['browser:tabs-list']) => callback(tabs);
    ipcRenderer.on('browser:tabs-list', handler);
    return () => ipcRenderer.removeListener('browser:tabs-list', handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
