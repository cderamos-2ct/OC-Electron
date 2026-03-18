// Renderer test setup — runs before every jsdom test
// Mocks window.electronAPI so React components that call IPC don't throw.
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock electron-log/renderer BEFORE any component imports it.
// The real module hangs in jsdom because it tries to use Electron IPC.
vi.mock('electron-log/renderer', () => {
  const noop = (..._args: unknown[]) => {};
  const logger = { error: noop, warn: noop, info: noop, debug: noop, log: noop, verbose: noop, silly: noop, hooks: [], transports: { console: { level: 'debug' }, file: { level: false } } };
  return { default: logger, __esModule: true };
});

// Stub every method on window.electronAPI with a no-op that resolves to undefined.
const noop = vi.fn().mockResolvedValue(undefined);
const noopSync = vi.fn().mockReturnValue(() => {});

Object.defineProperty(window, 'electronAPI', {
  writable: true,
  value: {
    // Generic IPC — returns [] by default so views don't crash on .length
    invoke: vi.fn().mockResolvedValue([]),
    on: noopSync,

    // Gateway
    gatewayRpc: noop,
    gatewayAgentRpc: noop,
    onGatewayEvent: noopSync,
    onGatewayState: noopSync,

    // Services
    serviceList: noop,
    serviceAdd: noop,
    serviceRemove: noop,
    serviceReload: noop,
    serviceHibernate: noop,
    onServiceStateChange: noopSync,

    // Tasks
    taskList: noop,
    taskGet: noop,
    taskMutate: noop,
    taskQuickDecision: noop,
    onTaskChanged: noopSync,

    // Shell
    shellGetConfig: noop,
    shellSetConfig: noop,
    shellQuit: noop,
    openExternal: vi.fn(),
    onToggleRail: noopSync,

    // Approvals
    approvalList: vi.fn().mockResolvedValue([]),
    approvalDecide: noop,
    approvalRules: vi.fn().mockResolvedValue([]),
    approvalRevokeRule: noop,
    approvalAuditLog: vi.fn().mockResolvedValue([]),
    onApprovalRequested: noopSync,
    onApprovalResolved: noopSync,

    // Notifications
    onNotification: noopSync,

    // Setup
    setupCheck: vi.fn().mockResolvedValue({ setupComplete: true, config: {} }),
    setupComplete: vi.fn().mockResolvedValue({ ok: true }),
  },
});

// Suppress CSS animation / requestAnimationFrame noise in jsdom
Object.defineProperty(window, 'requestAnimationFrame', {
  writable: true,
  value: (cb: FrameRequestCallback) => setTimeout(cb, 0),
});

// jsdom doesn't implement scrollIntoView — stub it to prevent errors in ChatThread etc.
if (typeof window.HTMLElement !== 'undefined') {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
}
