import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GATEWAY_PID_FILE } from '../shared/constants.js';

const {
  cleanupStalePidFileMock,
  existsSyncMock,
  removePidFileMock,
} = vi.hoisted(() => ({
  cleanupStalePidFileMock: vi.fn(),
  existsSyncMock: vi.fn(),
  removePidFileMock: vi.fn(),
}));

vi.mock('child_process', () => ({
  spawn: vi.fn(() => {
    const child = {
      pid: 8181,
      kill: vi.fn(),
      unref: vi.fn(),
      removeAllListeners: vi.fn(),
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
    };
    return child;
  }),
  execSync: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
  },
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: existsSyncMock,
  };
});

vi.mock('ws', () => ({ default: vi.fn() }));

vi.mock('./logging/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('./process-pid.js', () => ({
  cleanupStalePidFile: cleanupStalePidFileMock,
  isPidRunning: vi.fn(() => false),
  removePidFile: removePidFileMock,
  writePidFile: vi.fn(),
}));

import { GatewayProcessManager } from './gateway-process.js';

describe('GatewayProcessManager PID management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existsSyncMock.mockReturnValue(true);
  });

  it('cleans stale gateway PID state before probing for an existing gateway', async () => {
    const manager = new GatewayProcessManager();
    vi.spyOn(manager, 'probe').mockResolvedValue(true);
    const startPromise = manager.start();

    await startPromise;

    expect(cleanupStalePidFileMock).toHaveBeenCalledWith(
      GATEWAY_PID_FILE,
      'gateway',
      expect.any(Object),
    );

    manager.stop();
  });

  it('does not remove the gateway PID file when only attaching to an existing gateway', async () => {
    const manager = new GatewayProcessManager();
    vi.spyOn(manager, 'probe').mockResolvedValue(true);

    await manager.start();
    manager.stop();

    expect(removePidFileMock).not.toHaveBeenCalled();
  });
});
