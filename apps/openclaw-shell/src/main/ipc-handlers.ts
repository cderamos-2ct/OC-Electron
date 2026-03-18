import { ipcMain, shell, BrowserWindow } from 'electron';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { auditLogger } from './logging/logger.js';
import type { ShellConfig, ServiceConfig, TaskPatch, QuickDecision } from '../shared/types.js';
import { DEFAULT_SHELL_CONFIG } from '../shared/types.js';
import { SHELL_CONFIG_DIR_NAME, SHELL_CONFIG_FILE_NAME } from '../shared/constants.js';

const SHELL_CONFIG_DIR = join(homedir(), SHELL_CONFIG_DIR_NAME);
const SHELL_CONFIG_FILE = join(SHELL_CONFIG_DIR, SHELL_CONFIG_FILE_NAME);
import { AgentServiceBindingRegistry } from './agent-binding-registry.js';
import { ServiceManager } from './services/service-manager.js';
import type { GatewayClient } from './gateway-client.js';
import type { TaskEngine } from './task-engine.js';
import type { CDBridge } from './cd-bridge.js';
import type { WorkerManager } from './api-workers/worker-manager.js';
import type { GwsGmailWorker } from './api-workers/gws-gmail-worker.js';
import type { GitHubWorker } from './api-workers/github-worker.js';
import type { CalendarEventCreate } from '../shared/types.js';
import type { GwsCalendarWorker } from './api-workers/gws-calendar-worker.js';
import { readAuditLog } from './audit-log.js';
import { wrapWithRateLimit, rateLimiter } from './security/ipc-rate-limiter.js';
import { setTelemetryConsent, getTelemetryConfig } from './telemetry/crash-reporter.js';

function readShellConfig(): ShellConfig {
  if (!existsSync(SHELL_CONFIG_FILE)) {
    return DEFAULT_SHELL_CONFIG;
  }
  try {
    const raw = readFileSync(SHELL_CONFIG_FILE, 'utf-8');
    return { ...DEFAULT_SHELL_CONFIG, ...(JSON.parse(raw) as Partial<ShellConfig>) };
  } catch {
    return DEFAULT_SHELL_CONFIG;
  }
}

function writeShellConfig(config: ShellConfig): void {
  if (!existsSync(SHELL_CONFIG_DIR)) {
    mkdirSync(SHELL_CONFIG_DIR, { recursive: true });
  }
  writeFileSync(SHELL_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export function registerIpcHandlers(gateway: GatewayClient, serviceManager: ServiceManager, taskEngine: TaskEngine, workerManager?: WorkerManager, cdBridge?: CDBridge): void {
  // Security: Audit log for sensitive operations
  const AUDITED_CHANNELS = ['api.gmail.send-draft', 'api.gmail.delete', 'api.gmail.batch-modify', 'api.github.merge', 'api.github.review', 'approval:decide'];

  function auditLog(channel: string, args: unknown[]): void {
    auditLogger.info('ipc-audit', { channel, args: JSON.stringify(args).slice(0, 500) });
  }

  void AUDITED_CHANNELS; // referenced for documentation; individual calls below

  // Bootstrap phase: elevate rate limits during first-run setup
  const isBootstrap = !existsSync(join(SHELL_CONFIG_DIR, 'setup.json'));
  if (isBootstrap) rateLimiter.setBootstrapMode(true);

  /** Rate-limited ipcMain.handle wrapper. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handle(channel: string, listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any): void {
    ipcMain.handle(channel, wrapWithRateLimit(channel, listener));
  }

  const bindingRegistry = AgentServiceBindingRegistry.fromConfig();

  // ── Gateway ──────────────────────────────────────────────────────────────
  handle('gateway:rpc', async (_event, method: string, params?: unknown) => {
    if (!gateway.isConnected) {
      return { error: 'not connected' };
    }
    try {
      return await gateway.request(method, params);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  handle('gateway:agent-rpc', async (_event, agentId: string, method: string, params?: unknown) => {
    if (!gateway.isConnected) {
      return { error: 'not connected' };
    }
    try {
      return await gateway.request(method, { ...((params as object) ?? {}), agentId });
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ── Tasks ─────────────────────────────────────────────────────────────────
  handle('task:list', async () => {
    return taskEngine.listTasks();
  });

  handle('task:get', async (_event, taskId: string) => {
    return taskEngine.getTask(taskId);
  });

  handle('task:mutate', async (_event, taskId: string, patch: TaskPatch) => {
    return taskEngine.mutateTask(taskId, patch);
  });

  handle('task:quick-decision', async (_event, taskId: string, decision: QuickDecision) => {
    return taskEngine.quickDecision(taskId, decision);
  });

  handle('task:batch-approve', async (_event, taskIds: string[]) => {
    return taskEngine.batchApprove(taskIds);
  });

  // ── Services ──────────────────────────────────────────────────────────────
  handle('service:list', async () => {
    return serviceManager.listServices();
  });

  handle('service:add', async (_event, config: ServiceConfig) => {
    return serviceManager.loadService(config);
  });

  handle('service:remove', async (_event, serviceId: string) => {
    return serviceManager.destroyService(serviceId);
  });

  handle('service:reload', async (_event, serviceId: string) => {
    const status = serviceManager.getService(serviceId);
    if (!status) return { error: `Service not found: ${serviceId}` };
    // Renderer handles actual webview reload; main just tracks state
    serviceManager.setServiceState(serviceId, 'loading');
    return { ok: true };
  });

  handle('service:hibernate', async (_event, serviceId: string) => {
    return serviceManager.hibernateService(serviceId);
  });

  // ── Shell Config ──────────────────────────────────────────────────────────
  handle('shell:get-config', async () => {
    return readShellConfig();
  });

  handle('shell:set-config', async (_event, patch: Partial<ShellConfig>) => {
    const current = readShellConfig();
    const updated: ShellConfig = { ...current, ...patch };
    writeShellConfig(updated);
    return updated;
  });

  handle('shell:quit', async () => {
    const { app } = await import('electron');
    app.quit();
  });

  handle('shell:open-external', async (_event, url: string) => {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Blocked non-HTTP URL: ${url}`);
    }
    await shell.openExternal(url);
  });

  handle('shell:export-debug-bundle', async () => {
    const { app, dialog } = await import('electron');
    const { createWriteStream, existsSync: fsExists } = await import('fs');
    const { join: pathJoin } = await import('path');
    const os = await import('os');

    const logDir = pathJoin(app.getPath('userData'), 'logs');
    const logFile = pathJoin(logDir, 'openclaw.log');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const bundleName = `openclaw-debug-${timestamp}.txt`;

    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Save Debug Bundle',
      defaultPath: pathJoin(os.homedir(), 'Desktop', bundleName),
      filters: [{ name: 'Text Files', extensions: ['txt'] }],
    });

    if (canceled || !filePath) return { ok: false, reason: 'canceled' };

    try {
      const lines: string[] = [
        `=== OpenClaw Debug Bundle ===`,
        `Generated: ${new Date().toISOString()}`,
        `Platform: ${process.platform} ${os.release()}`,
        `Electron: ${process.versions.electron}`,
        `Node: ${process.versions.node}`,
        `App version: ${app.getVersion()}`,
        ``,
        `=== Log File ===`,
      ];

      if (fsExists(logFile)) {
        const { readFileSync } = await import('fs');
        lines.push(readFileSync(logFile, 'utf-8'));
      } else {
        lines.push('(no log file found)');
      }

      const { writeFileSync } = await import('fs');
      writeFileSync(filePath, lines.join('\n'), 'utf-8');
      return { ok: true, filePath };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    }
  });

  // ── Approvals (Phase 4: CD Action Bridge) ───────────────────────
  handle('approval:list', async () => {
    if (!cdBridge) return [];
    return cdBridge.listPendingApprovals();
  });

  handle('approval:decide', async (_event, actionId: string, decision: 'approved' | 'denied', alwaysAllow?: boolean) => {
    auditLog('approval:decide', [actionId, decision]);
    if (!cdBridge) return { error: 'CD Bridge not available' };
    try {
      return await cdBridge.decide(actionId, decision, alwaysAllow);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  handle('approval:rules', async () => {
    if (!cdBridge) return [];
    return cdBridge.getApprovalRules();
  });

  handle('approval:revoke-rule', async (_event, ruleId: string) => {
    if (!cdBridge) return { error: 'CD Bridge not available' };
    const revoked = cdBridge.revokeApprovalRule(ruleId);
    return { ok: revoked };
  });

  handle('approval:audit-log', async (_event, limit?: number) => {
    return readAuditLog(limit);
  });

  // ── Agent Bindings ────────────────────────────────────────────────────────
  handle('agent:bindings', async () => {
    return bindingRegistry.getConfig();
  });

  // ── API Worker Status ─────────────────────────────────────────────────────
  handle('api.workers.status', async () => {
    if (!workerManager) return [];
    return workerManager.getAllStatuses();
  });

  // ── Gmail API ─────────────────────────────────────────────────────────────
  function getGmailWorker(agentId: string): GwsGmailWorker | { error: string } {
    if (!bindingRegistry.hasAPIAccess(agentId, 'gmail')) {
      return { error: `Agent "${agentId}" does not have gmail API access` };
    }
    if (!workerManager) return { error: 'WorkerManager not available' };
    const worker = workerManager.getWorker('gmail') as GwsGmailWorker | undefined;
    if (!worker) return { error: 'Gmail worker not registered' };
    return worker;
  }

  handle('api.gmail.list', async (_event, agentId: string, query?: string, maxResults?: number) => {
    const worker = getGmailWorker(agentId);
    if ('error' in worker) return worker;
    try {
      return await worker.listMessages(query, maxResults);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  handle('api.gmail.get', async (_event, agentId: string, messageId: string) => {
    const worker = getGmailWorker(agentId);
    if ('error' in worker) return worker;
    try {
      return await worker.getMessage(messageId);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  handle('api.gmail.archive', async (_event, agentId: string, messageId: string) => {
    const worker = getGmailWorker(agentId);
    if ('error' in worker) return worker;
    try {
      await worker.archiveMessage(messageId);
      return { ok: true };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  handle('api.gmail.label', async (_event, agentId: string, messageId: string, addLabels: string[], removeLabels?: string[]) => {
    const worker = getGmailWorker(agentId);
    if ('error' in worker) return worker;
    try {
      await worker.labelMessage(messageId, addLabels, removeLabels);
      return { ok: true };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  handle('api.gmail.draft', async (_event, agentId: string, to: string, subject: string, body: string) => {
    const worker = getGmailWorker(agentId);
    if ('error' in worker) return worker;
    try {
      return await worker.createDraft(to, subject, body);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  handle('api.gmail.send-draft', async (_event, agentId: string, draftId: string) => {
    auditLog('api.gmail.send-draft', [agentId, draftId]);
    const worker = getGmailWorker(agentId);
    if ('error' in worker) return worker;
    try {
      await worker.sendDraft(draftId);
      return { ok: true };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  handle('api.gmail.delete', async (_event, agentId: string, messageId: string) => {
    auditLog('api.gmail.delete', [agentId, messageId]);
    const worker = getGmailWorker(agentId);
    if ('error' in worker) return worker;
    try {
      await worker.deleteMessage(messageId);
      return { ok: true };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  handle('api.gmail.batch-modify', async (_event, agentId: string, messageIds: string[], addLabels: string[], removeLabels: string[]) => {
    auditLog('api.gmail.batch-modify', [agentId, messageIds]);
    const worker = getGmailWorker(agentId);
    if ('error' in worker) return worker;
    try {
      await worker.batchModify(messageIds, addLabels, removeLabels);
      return { ok: true };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ── GitHub API ────────────────────────────────────────────────────────────
  function getGitHubWorker(agentId: string): GitHubWorker | { error: string } {
    if (!bindingRegistry.hasAPIAccess(agentId, 'github')) {
      return { error: `Agent "${agentId}" does not have github API access` };
    }
    if (!workerManager) return { error: 'WorkerManager not available' };
    const worker = workerManager.getWorker('github') as GitHubWorker | undefined;
    if (!worker) return { error: 'GitHub worker not registered' };
    return worker;
  }

  handle('api.github.notifications', async (_event, agentId: string, all?: boolean) => {
    const worker = getGitHubWorker(agentId);
    if ('error' in worker) return worker;
    try {
      return await worker.listNotifications(all);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  handle('api.github.notification-read', async (_event, agentId: string, threadId: string) => {
    const worker = getGitHubWorker(agentId);
    if ('error' in worker) return worker;
    try {
      await worker.markNotificationRead(threadId);
      return { ok: true };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  handle('api.github.prs', async (_event, agentId: string, owner: string, repo: string, state?: string) => {
    const worker = getGitHubWorker(agentId);
    if ('error' in worker) return worker;
    try {
      return await worker.listPRs(owner, repo, state);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  handle('api.github.pr', async (_event, agentId: string, owner: string, repo: string, number: number) => {
    const worker = getGitHubWorker(agentId);
    if ('error' in worker) return worker;
    try {
      return await worker.getPR(owner, repo, number);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  handle('api.github.review', async (_event, agentId: string, owner: string, repo: string, number: number, body: string, event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT') => {
    auditLog('api.github.review', [agentId, owner, repo, number, event]);
    const worker = getGitHubWorker(agentId);
    if ('error' in worker) return worker;
    try {
      await worker.reviewPR(owner, repo, number, body, event);
      return { ok: true };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  handle('api.github.merge', async (_event, agentId: string, owner: string, repo: string, number: number, mergeMethod?: 'merge' | 'squash' | 'rebase') => {
    auditLog('api.github.merge', [agentId, owner, repo, number]);
    const worker = getGitHubWorker(agentId);
    if ('error' in worker) return worker;
    try {
      await worker.mergePR(owner, repo, number, mergeMethod);
      return { ok: true };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  handle('api.github.issues', async (_event, agentId: string, owner: string, repo: string, state?: string) => {
    const worker = getGitHubWorker(agentId);
    if ('error' in worker) return worker;
    try {
      return await worker.listIssues(owner, repo, state);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  handle('api.github.comment', async (_event, agentId: string, owner: string, repo: string, number: number, body: string) => {
    const worker = getGitHubWorker(agentId);
    if ('error' in worker) return worker;
    try {
      await worker.commentOnIssue(owner, repo, number, body);
      return { ok: true };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ── Calendar API ──────────────────────────────────────────────────────────
  function getCalendarWorker(agentId: string): GwsCalendarWorker | { error: string } {
    if (!bindingRegistry.hasAPIAccess(agentId, 'calendar')) {
      return { error: `Agent "${agentId}" does not have calendar API access` };
    }
    if (!workerManager) return { error: 'WorkerManager not available' };
    const worker = workerManager.getWorker('calendar') as GwsCalendarWorker | undefined;
    if (!worker) return { error: 'Calendar worker not registered' };
    return worker;
  }

  handle('api.calendar.list', async (_event, agentId: string, timeMin: string, timeMax: string, calendarId?: string) => {
    const worker = getCalendarWorker(agentId);
    if ('error' in worker) return worker;
    try {
      return await worker.listEvents(timeMin, timeMax, calendarId);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  handle('api.calendar.get', async (_event, agentId: string, eventId: string, calendarId?: string) => {
    const worker = getCalendarWorker(agentId);
    if ('error' in worker) return worker;
    try {
      return await worker.getEvent(eventId, calendarId);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  handle('api.calendar.create', async (_event, agentId: string, event: CalendarEventCreate, calendarId?: string) => {
    const worker = getCalendarWorker(agentId);
    if ('error' in worker) return worker;
    try {
      return await worker.createEvent(event, calendarId);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  handle('api.calendar.update', async (_event, agentId: string, eventId: string, event: Partial<CalendarEventCreate>, calendarId?: string) => {
    const worker = getCalendarWorker(agentId);
    if ('error' in worker) return worker;
    try {
      return await worker.updateEvent(eventId, event, calendarId);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  handle('api.calendar.accept', async (_event, agentId: string, eventId: string, calendarId?: string) => {
    const worker = getCalendarWorker(agentId);
    if ('error' in worker) return worker;
    try {
      return await worker.acceptEvent(eventId, calendarId);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  handle('api.calendar.decline', async (_event, agentId: string, eventId: string, calendarId?: string) => {
    const worker = getCalendarWorker(agentId);
    if ('error' in worker) return worker;
    try {
      return await worker.declineEvent(eventId, calendarId);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  handle('api.calendar.free-time', async (_event, agentId: string, timeMin: string, timeMax: string, attendees?: string[]) => {
    const worker = getCalendarWorker(agentId);
    if ('error' in worker) return worker;
    try {
      return await worker.findFreeTime(timeMin, timeMax, attendees);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ── Browser / CDP Actions ─────────────────────────────────────────────────

  // In-memory tab registry (tabId → BrowserTab)
  const browserTabs = new Map<string, import('../shared/types.js').BrowserTab>();

  function getMainWebContents(): Electron.WebContents | undefined {
    return BrowserWindow.getAllWindows()[0]?.webContents;
  }

  function notifyTabUpdated(tab: import('../shared/types.js').BrowserTab): void {
    getMainWebContents()?.send('browser:tab-updated', tab);
  }

  function notifyTabRemoved(tabId: string): void {
    getMainWebContents()?.send('browser:tab-removed', { tabId });
  }

  // Helper: resolve webContents id from tabId string
  // tabId is a UUID used as the logical tab identifier; we store wcId in the tab's metadata
  function resolveWebContentsId(tabId?: string): number | undefined {
    if (!tabId) return undefined;
    const tab = browserTabs.get(tabId);
    return (tab as (import('../shared/types.js').BrowserTab & { wcId?: number }) | undefined)?.wcId;
  }

  handle('browser:navigate', async (_event, url: string, tabId?: string) => {
    if (!cdBridge) return { error: 'CDP bridge not available' };
    const wcId = resolveWebContentsId(tabId);
    const result = await cdBridge.executeBrowserRawAction('navigate', { url }, wcId);
    if (result.success && tabId && browserTabs.has(tabId)) {
      const tab = browserTabs.get(tabId)!;
      tab.url = url;
      tab.state = 'loading';
      tab.updatedAt = new Date().toISOString();
      notifyTabUpdated(tab);
    }
    return result;
  });

  handle('browser:click', async (_event, selector: string, tabId?: string) => {
    if (!cdBridge) return { error: 'CDP bridge not available' };
    return cdBridge.executeBrowserRawAction('click', { selector }, resolveWebContentsId(tabId));
  });

  handle('browser:fill', async (_event, selector: string, value: string, tabId?: string) => {
    if (!cdBridge) return { error: 'CDP bridge not available' };
    return cdBridge.executeBrowserRawAction('fill', { selector, value }, resolveWebContentsId(tabId));
  });

  handle('browser:screenshot', async (_event, tabId?: string, fullPage?: boolean) => {
    if (!cdBridge) return { error: 'CDP bridge not available' };
    return cdBridge.executeBrowserRawAction('screenshot', { fullPage: fullPage ?? false }, resolveWebContentsId(tabId));
  });

  handle('browser:read', async (_event, tabId?: string, selector?: string) => {
    if (!cdBridge) return { error: 'CDP bridge not available' };
    return cdBridge.executeBrowserRawAction('read', { selector }, resolveWebContentsId(tabId));
  });

  handle('browser:scroll', async (_event, selector: string | undefined, deltaY: number, tabId?: string) => {
    if (!cdBridge) return { error: 'CDP bridge not available' };
    return cdBridge.executeBrowserRawAction('scroll', { selector, deltaY }, resolveWebContentsId(tabId));
  });

  handle('browser:wait', async (_event, ms: number, tabId?: string) => {
    if (!cdBridge) return { error: 'CDP bridge not available' };
    return cdBridge.executeBrowserRawAction('wait', { ms }, resolveWebContentsId(tabId));
  });

  handle('browser:evaluate', async (_event, expression: string, tabId?: string) => {
    if (!cdBridge) return { error: 'CDP bridge not available' };
    return cdBridge.executeBrowserRawAction('evaluate', { expression }, resolveWebContentsId(tabId));
  });

  handle('browser:network-enable', async (_event, tabId?: string) => {
    if (!cdBridge) return { error: 'CDP bridge not available' };
    return cdBridge.executeBrowserRawAction('network-enable', {}, resolveWebContentsId(tabId));
  });

  handle('browser:get-document', async (_event, tabId?: string) => {
    if (!cdBridge) return { error: 'CDP bridge not available' };
    return cdBridge.executeBrowserRawAction('get-document', {}, resolveWebContentsId(tabId));
  });

  handle('browser:add-tab', async (_event, name: string, url: string, agentId?: string, autoPin?: boolean) => {
    const { randomUUID } = await import('node:crypto');
    const tabId = randomUUID();
    const now = new Date().toISOString();
    const tab: import('../shared/types.js').BrowserTab = {
      id: tabId,
      url,
      title: name,
      state: 'blank',
      isPinned: autoPin ?? false,
      agentId,
      createdAt: now,
      updatedAt: now,
    };
    browserTabs.set(tabId, tab);
    notifyTabUpdated(tab);
    return tab;
  });

  handle('browser:close-tab', async (_event, tabId: string) => {
    const existed = browserTabs.delete(tabId);
    if (existed) notifyTabRemoved(tabId);
    return { ok: existed };
  });

  handle('browser:pin-tab', async (_event, tabId: string) => {
    const tab = browserTabs.get(tabId);
    if (!tab) return { error: `Tab not found: ${tabId}` };
    tab.isPinned = true;
    tab.updatedAt = new Date().toISOString();
    notifyTabUpdated(tab);
    return tab;
  });

  handle('browser:unpin-tab', async (_event, tabId: string) => {
    const tab = browserTabs.get(tabId);
    if (!tab) return { error: `Tab not found: ${tabId}` };
    tab.isPinned = false;
    tab.updatedAt = new Date().toISOString();
    notifyTabUpdated(tab);
    return tab;
  });

  handle('browser:list-tabs', async () => {
    return Array.from(browserTabs.values());
  });

  // ── Setup Wizard ──────────────────────────────────────────────────────────
  const SETUP_FILE = join(SHELL_CONFIG_DIR, 'setup.json');

  handle('setup:check', async () => {
    try {
      if (existsSync(SETUP_FILE)) {
        const raw = readFileSync(SETUP_FILE, 'utf-8');
        const config = JSON.parse(raw);
        return { setupComplete: true, config };
      }
    } catch { /* ignore */ }
    return { setupComplete: false, config: null };
  });

  handle('setup:complete', async (_event, config: unknown) => {
    if (!existsSync(SHELL_CONFIG_DIR)) {
      mkdirSync(SHELL_CONFIG_DIR, { recursive: true });
    }
    writeFileSync(SETUP_FILE, JSON.stringify(config, null, 2), 'utf-8');
    return { ok: true };
  });

  // ── Telemetry ─────────────────────────────────────────────────────────────
  handle('telemetry:set-consent', async (_event, enabled: boolean) => {
    setTelemetryConsent(enabled);
    return { ok: true };
  });

  handle('telemetry:get-config', async () => {
    return getTelemetryConfig();
  });

}
