import type {
  MainToRendererEvents,
  RendererToMainHandlers,
  GatewayConnectionState,
  ServiceConfig,
  TaskPatch,
  QuickDecision,
  ShellConfig,
  PendingApproval,
  ApprovalResult,
  CDActionResult,
  AutoApproveRule,
  AuditLogEntry,
  SetupConfig,
  DeepLinkAction,
} from '../../shared/types';
import type { ElectronAPI } from '../../main/preload';

// ─── Window API Declaration ───────────────────────────────────────────────────

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

type Unsubscribe = () => void;

// ─── Low-level generic wrappers ───────────────────────────────────────────────

export async function invoke<K extends keyof RendererToMainHandlers>(
  channel: K,
  ...args: RendererToMainHandlers[K]
): Promise<unknown> {
  return window.electronAPI.invoke(channel, ...args);
}

export function on<K extends keyof MainToRendererEvents>(
  channel: K,
  callback: (data: MainToRendererEvents[K]) => void,
): Unsubscribe {
  const wrapped = (_event: Electron.IpcRendererEvent, data: MainToRendererEvents[K]) => callback(data);
  return window.electronAPI.on(channel, wrapped);
}

/**
 * @deprecated Use the unsubscribe function returned by on() instead.
 */
export function off(): never {
  throw new Error('off() is not supported. Use the unsubscribe function returned by on() instead.');
}

// ─── Shell utilities ──────────────────────────────────────────────────────────

export function openExternal(url: string): void {
  window.electronAPI.openExternal(url);
}

// ─── Gateway ──────────────────────────────────────────────────────────────────

export function gatewayRpc(method: string, params?: unknown): Promise<unknown> {
  return window.electronAPI.gatewayRpc(method, params);
}

export function gatewayAgentRpc(agentId: string, method: string, params?: unknown): Promise<unknown> {
  return window.electronAPI.gatewayAgentRpc(agentId, method, params);
}

export function onGatewayEvent(callback: (evt: unknown) => void): Unsubscribe {
  return window.electronAPI.onGatewayEvent(callback);
}

export function onGatewayState(callback: (state: GatewayConnectionState) => void): Unsubscribe {
  return window.electronAPI.onGatewayState(callback);
}

// ─── Services ─────────────────────────────────────────────────────────────────

export function serviceList(): Promise<unknown> {
  return window.electronAPI.serviceList();
}

export function serviceAdd(config: ServiceConfig): Promise<unknown> {
  return window.electronAPI.serviceAdd(config);
}

export function serviceRemove(id: string): Promise<unknown> {
  return window.electronAPI.serviceRemove(id);
}

export function serviceReload(id: string): Promise<unknown> {
  return window.electronAPI.serviceReload(id);
}

export function serviceHibernate(id: string): Promise<unknown> {
  return window.electronAPI.serviceHibernate(id);
}

export function onServiceStateChange(
  callback: (data: MainToRendererEvents['service:state-change']) => void,
): Unsubscribe {
  return window.electronAPI.onServiceStateChange(callback);
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export function taskList(): Promise<unknown> {
  return window.electronAPI.taskList();
}

export function taskGet(id: string): Promise<unknown> {
  return window.electronAPI.taskGet(id);
}

export function taskMutate(id: string, patch: TaskPatch): Promise<unknown> {
  return window.electronAPI.taskMutate(id, patch);
}

export function taskQuickDecision(id: string, decision: QuickDecision): Promise<unknown> {
  return window.electronAPI.taskQuickDecision(id, decision);
}

export function onTaskChanged(
  callback: (data: MainToRendererEvents['task:changed']) => void,
): Unsubscribe {
  return window.electronAPI.onTaskChanged(callback);
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export function shellGetConfig(): Promise<unknown> {
  return window.electronAPI.shellGetConfig();
}

export function shellSetConfig(config: Partial<ShellConfig>): Promise<unknown> {
  return window.electronAPI.shellSetConfig(config);
}

export function shellQuit(): Promise<void> {
  return window.electronAPI.shellQuit();
}

export function onToggleRail(callback: () => void): Unsubscribe {
  return window.electronAPI.onToggleRail(callback);
}

// ─── Approvals (Phase 4) ──────────────────────────────────────────────────────

export function approvalList(): Promise<PendingApproval[]> {
  return window.electronAPI.approvalList() as Promise<PendingApproval[]>;
}

export function approvalDecide(
  actionId: string,
  decision: 'approved' | 'denied',
  alwaysAllow?: boolean,
): Promise<ApprovalResult & { actionResult?: CDActionResult }> {
  return window.electronAPI.approvalDecide(actionId, decision, alwaysAllow) as Promise<ApprovalResult & { actionResult?: CDActionResult }>;
}

export function approvalRules(): Promise<AutoApproveRule[]> {
  return window.electronAPI.approvalRules() as Promise<AutoApproveRule[]>;
}

export function approvalRevokeRule(ruleId: string): Promise<{ ok: boolean }> {
  return window.electronAPI.approvalRevokeRule(ruleId) as Promise<{ ok: boolean }>;
}

export function approvalAuditLog(limit?: number): Promise<AuditLogEntry[]> {
  return window.electronAPI.approvalAuditLog(limit) as Promise<AuditLogEntry[]>;
}

export function onApprovalRequested(
  callback: (data: PendingApproval) => void,
): Unsubscribe {
  return window.electronAPI.onApprovalRequested(callback);
}

export function onApprovalResolved(
  callback: (data: ApprovalResult & { actionResult?: CDActionResult }) => void,
): Unsubscribe {
  return window.electronAPI.onApprovalResolved(callback);
}

// ─── Notifications ────────────────────────────────────────────────────────────

export function onNotification(
  callback: (data: MainToRendererEvents['service:notification']) => void,
): Unsubscribe {
  return window.electronAPI.onNotification(callback);
}

// ─── Setup ───────────────────────────────────────────────────────────────────

export function setupCheck(): Promise<{ setupComplete: boolean; config: unknown }> {
  return window.electronAPI.setupCheck() as Promise<{ setupComplete: boolean; config: unknown }>;
}

export function setupComplete(config: SetupConfig): Promise<{ ok: boolean }> {
  return window.electronAPI.setupComplete(config) as Promise<{ ok: boolean }>;
}

// ─── Deep Linking ──────────────────────────────────────────────────────────────
export function onDeepLink(callback: (action: DeepLinkAction) => void): Unsubscribe {
  return on('deeplink:navigate', callback);
}
