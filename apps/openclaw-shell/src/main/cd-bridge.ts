// CD Action Bridge — executes approved actions in embedded webviews via CDP
// Uses CDPClient (Chrome DevTools Protocol) instead of executeJavaScript()

import { BrowserWindow, webContents } from 'electron';
import { randomUUID } from 'node:crypto';
import { ApprovalStore } from './approval-store.js';
import { appendAuditEntry } from './audit-log.js';
import { ServiceManager } from './services/service-manager.js';
import { AgentServiceBindingRegistry } from './agent-binding-registry.js';
import type { GatewayClient } from './gateway-client.js';
import { CDPClient } from '@openclaw/core';
import type {
  CDAction,
  CDActionResult,
  ApprovalDecision,
  AuditLogEntry,
  PendingApproval,
  ApprovalResult,
  AutoApproveRule,
} from '../shared/types.js';

export class CDBridge {
  private approvalStore: ApprovalStore;
  private serviceManager: ServiceManager;
  private bindingRegistry: AgentServiceBindingRegistry;
  private gateway: GatewayClient;
  private mainWindow: BrowserWindow | null = null;

  // Map from webContents id → attached CDPClient (so we reuse per webContents)
  private cdpClients = new Map<number, CDPClient>();

  constructor(
    gateway: GatewayClient,
    serviceManager: ServiceManager,
    bindingRegistry: AgentServiceBindingRegistry,
  ) {
    this.approvalStore = new ApprovalStore();
    this.serviceManager = serviceManager;
    this.bindingRegistry = bindingRegistry;
    this.gateway = gateway;
  }

  setMainWindow(win: BrowserWindow | null): void {
    this.mainWindow = win;
  }

  // ─── Action Request Flow ──────────────────────────────────────────

  /**
   * Process an incoming CD action request.
   * Returns immediately for auto-approved/silent actions.
   * Queues for approval otherwise and notifies the renderer.
   */
  async handleActionRequest(action: CDAction): Promise<void> {
    // Validate agent binding
    if (!this.bindingRegistry.canAct(action.agentId, action.serviceId)) {
      this.logAudit(action, 'denied', undefined, {
        success: false,
        error: `Agent "${action.agentId}" cannot act on service "${action.serviceId}"`,
        durationMs: 0,
      });
      this.sendActionResult(action.id, {
        actionId: action.id,
        success: false,
        error: `Agent "${action.agentId}" is not authorized to act on "${action.serviceId}"`,
        durationMs: 0,
      });
      return;
    }

    // Check auto-approve
    const { autoApprove, rule } = this.approvalStore.shouldAutoApprove(action);

    if (autoApprove) {
      const decision: ApprovalDecision = rule ? 'auto-approved' : 'auto-approved';
      const result = await this.executeAction(action);
      this.logAudit(action, decision, rule?.id, {
        success: result.success,
        error: result.error,
        durationMs: result.durationMs,
      });
      this.sendActionResult(action.id, result);
      this.notifyRenderer('approval:resolved', {
        actionId: action.id,
        decision,
        decidedAt: new Date().toISOString(),
        autoApproveRuleId: rule?.id,
        actionResult: result,
      });
      return;
    }

    // Queue for manual approval
    const pending = this.approvalStore.enqueue(action);
    this.notifyRenderer('approval:requested', pending);
  }

  /**
   * User decides on a pending approval from the UI.
   */
  async decide(
    actionId: string,
    decision: 'approved' | 'denied',
    alwaysAllow = false,
  ): Promise<ApprovalResult & { actionResult?: CDActionResult }> {
    const pending = this.approvalStore.resolve(actionId, decision);
    if (!pending) {
      throw new Error(`No pending approval found for action: ${actionId}`);
    }

    const action = pending.action;
    let actionResult: CDActionResult | undefined;
    let ruleId: string | undefined;

    if (decision === 'approved') {
      // Create auto-approve rule if "Always Allow" was selected
      if (alwaysAllow) {
        const rule = this.approvalStore.addRule(action.agentId, action.serviceId, action.type);
        ruleId = rule.id;
      }

      actionResult = await this.executeAction(action);
      this.sendActionResult(action.id, actionResult);
    } else {
      // Denied — notify gateway
      this.sendActionResult(action.id, {
        actionId: action.id,
        success: false,
        error: 'Action denied by user',
        durationMs: 0,
      });
    }

    this.logAudit(action, decision, ruleId, actionResult ? {
      success: actionResult.success,
      error: actionResult.error,
      durationMs: actionResult.durationMs,
    } : undefined);

    const result: ApprovalResult & { actionResult?: CDActionResult } = {
      actionId,
      decision,
      decidedAt: new Date().toISOString(),
      autoApproveRuleId: ruleId,
      actionResult,
    };

    this.notifyRenderer('approval:resolved', result);
    return result;
  }

  // ─── Action Execution ─────────────────────────────────────────────

  private async executeAction(action: CDAction): Promise<CDActionResult> {
    const start = Date.now();

    try {
      const wc = this.findWebContentsForService(action.serviceId);
      if (!wc) {
        return {
          actionId: action.id,
          success: false,
          error: `Service "${action.serviceId}" is not loaded or not found`,
          durationMs: Date.now() - start,
        };
      }

      const cdp = this.getCDPClient(wc);
      const data = await this.runAction(cdp, action);

      return {
        actionId: action.id,
        success: true,
        data,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        actionId: action.id,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      };
    }
  }

  private async runAction(cdp: CDPClient, action: CDAction): Promise<unknown> {
    switch (action.type) {
      case 'click': {
        const clicked = await cdp.click(action.target.selector ?? '');
        return { clicked };
      }

      case 'fill': {
        const filled = await cdp.fill(
          action.target.selector ?? '',
          action.target.value ?? '',
        );
        return { filled };
      }

      case 'select': {
        // CDP doesn't have a native select — use evaluate to set value
        const selector = action.target.selector ?? '';
        const value = action.target.value ?? '';
        const result = await cdp.evaluate(
          `(function() {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el) return { selected: false, error: 'Element not found' };
            el.value = ${JSON.stringify(value)};
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return { selected: true, value: el.value };
          })()`,
        );
        return result.value;
      }

      case 'navigate': {
        await cdp.navigate(action.target.url ?? '');
        return { navigated: true, url: action.target.url };
      }

      case 'read': {
        const selector = action.target.selector ?? null;
        if (selector) {
          const result = await cdp.evaluate(
            `(function() {
              const el = document.querySelector(${JSON.stringify(selector)});
              if (!el) return { read: false, error: 'Element not found' };
              return {
                read: true,
                tagName: el.tagName,
                text: el.textContent?.slice(0, 5000),
                value: el.value,
                href: el.href,
              };
            })()`,
          );
          return result.value;
        }
        const result = await cdp.evaluate(
          `({ read: true, url: window.location.href, title: document.title, text: document.body.innerText.slice(0, 5000) })`,
        );
        return result.value;
      }

      case 'scroll': {
        const scrolled = await cdp.scroll(action.target.selector ?? null);
        return { scrolled };
      }

      default:
        return { error: `Unknown action type: ${(action as CDAction).type}` };
    }
  }

  // ─── CDP Client Management ────────────────────────────────────────

  private getCDPClient(wc: Electron.WebContents): CDPClient {
    const existing = this.cdpClients.get(wc.id);
    if (existing) return existing;

    const dbg = wc.debugger;
    const client = new CDPClient({
      attach: (v: string) => dbg.attach(v),
      detach: () => dbg.detach(),
      sendCommand: (method: string, params: Record<string, unknown>) =>
        dbg.sendCommand(method, params),
      isAttached: () => dbg.isAttached(),
    });

    client.attach();

    // Clean up when the webContents is destroyed
    wc.once('destroyed', () => {
      this.cdpClients.delete(wc.id);
    });

    this.cdpClients.set(wc.id, client);
    return client;
  }

  private findWebContentsForService(serviceId: string): Electron.WebContents | null {
    const allContents = webContents.getAllWebContents();

    for (const wc of allContents) {
      if (wc.getType() === 'webview') {
        // Match by partition which contains the service ID
        const partition = (wc as Electron.WebContents & { session?: Electron.Session }).session
          ?.storagePath;
        if (partition?.includes(`service-${serviceId}`)) {
          return wc;
        }

        // Fallback: match by URL patterns from default services
        const url = wc.getURL();
        const service = this.serviceManager.getService(serviceId);
        if (service && url.includes(new URL(service.url).hostname)) {
          return wc;
        }
      }
    }

    return null;
  }

  // ─── Gateway Communication ────────────────────────────────────────

  private sendActionResult(actionId: string, result: CDActionResult): void {
    if (!this.gateway.isConnected) return;
    try {
      void this.gateway.request('cd.action.result', { actionId, result });
    } catch {
      // Gateway may not support this method yet — that's OK
    }
  }

  // ─── Renderer Communication ───────────────────────────────────────

  private notifyRenderer(channel: string, data: unknown): void {
    this.mainWindow?.webContents.send(channel, data);
  }

  // ─── Audit Logging ────────────────────────────────────────────────

  private logAudit(
    action: CDAction,
    decision: ApprovalDecision,
    autoApproveRuleId?: string,
    result?: { success: boolean; error?: string; durationMs: number },
  ): void {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      actionId: action.id,
      agentId: action.agentId,
      serviceId: action.serviceId,
      actionType: action.type,
      target: action.target,
      description: action.description,
      riskTier: action.riskTier,
      decision,
      autoApproveRuleId,
      result,
    };
    appendAuditEntry(entry);
  }

  // ─── Public Accessors ─────────────────────────────────────────────

  listPendingApprovals(): PendingApproval[] {
    return this.approvalStore.listPending();
  }

  getApprovalRules(): AutoApproveRule[] {
    return this.approvalStore.getRules();
  }

  revokeApprovalRule(ruleId: string): boolean {
    return this.approvalStore.revokeRule(ruleId);
  }

  /**
   * Execute a raw browser action via CDP on the active/focused webContents,
   * or a specific tabId (treated as webContents id).
   * Used by browser:* IPC handlers — no approval gate, no audit log.
   */
  async executeBrowserRawAction(
    type: string,
    params: Record<string, unknown>,
    tabId?: number,
  ): Promise<{ success: boolean; data?: unknown; screenshotBase64?: string; error?: string; durationMs: number }> {
    const start = Date.now();
    try {
      const wc = tabId != null
        ? this.findWebContentsByTabId(tabId)
        : this.findActiveWebContents();

      if (!wc) {
        return { success: false, error: 'No active browser tab found', durationMs: Date.now() - start };
      }

      const cdp = this.getCDPClient(wc);

      switch (type) {
        case 'navigate': {
          await cdp.navigate(params.url as string);
          return { success: true, data: { navigated: true, url: params.url }, durationMs: Date.now() - start };
        }
        case 'click': {
          const clicked = await cdp.click(params.selector as string);
          return { success: true, data: { clicked }, durationMs: Date.now() - start };
        }
        case 'fill': {
          const filled = await cdp.fill(params.selector as string, params.value as string);
          return { success: true, data: { filled }, durationMs: Date.now() - start };
        }
        case 'screenshot': {
          const shot = await cdp.screenshot();
          return { success: true, screenshotBase64: shot.data, durationMs: Date.now() - start };
        }
        case 'read': {
          const selector = params.selector as string | undefined;
          if (selector) {
            const result = await cdp.evaluate(
              `(function() {
                const el = document.querySelector(${JSON.stringify(selector)});
                if (!el) return { read: false, error: 'Element not found' };
                return { read: true, tagName: el.tagName, text: el.textContent?.slice(0, 5000), value: el.value, href: el.href };
              })()`,
            );
            return { success: true, data: result.value, durationMs: Date.now() - start };
          }
          const result = await cdp.evaluate(
            `({ read: true, url: window.location.href, title: document.title, text: document.body.innerText.slice(0, 5000) })`,
          );
          return { success: true, data: result.value, durationMs: Date.now() - start };
        }
        case 'scroll': {
          const scrolled = await cdp.scroll(
            (params.selector as string | undefined) ?? null,
            (params.deltaY as number | undefined) ?? 300,
          );
          return { success: true, data: { scrolled }, durationMs: Date.now() - start };
        }
        case 'wait': {
          await new Promise((resolve) => setTimeout(resolve, params.ms as number));
          return { success: true, data: { waited: true }, durationMs: Date.now() - start };
        }
        case 'evaluate': {
          const result = await cdp.evaluate(params.expression as string);
          return { success: true, data: result, durationMs: Date.now() - start };
        }
        case 'network-enable': {
          await cdp.enableNetworkInterception();
          return { success: true, data: { enabled: true }, durationMs: Date.now() - start };
        }
        case 'get-document': {
          const doc = await cdp.getDocument(2);
          return { success: true, data: doc, durationMs: Date.now() - start };
        }
        default:
          return { success: false, error: `Unknown browser action type: ${type}`, durationMs: Date.now() - start };
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      };
    }
  }

  private findWebContentsByTabId(tabId: number): Electron.WebContents | null {
    const allContents = webContents.getAllWebContents();
    return allContents.find((wc) => wc.id === tabId) ?? null;
  }

  private findActiveWebContents(): Electron.WebContents | null {
    const allContents = webContents.getAllWebContents();
    // Prefer focused webview; fall back to first webview found
    const focused = allContents.find((wc) => wc.getType() === 'webview' && wc.isFocused());
    if (focused) return focused;
    return allContents.find((wc) => wc.getType() === 'webview') ?? null;
  }

  /**
   * Detach all active CDP sessions (e.g. on app quit).
   */
  detachAll(): void {
    for (const client of this.cdpClients.values()) {
      client.detach();
    }
    this.cdpClients.clear();
  }
}
