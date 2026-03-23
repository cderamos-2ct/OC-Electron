import { mkdtempSync, existsSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanupStalePidFile, removePidFile, writePidFile } from '../process-pid.js';

const log = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

describe('process-pid helpers', () => {
  let sandboxDir = '';

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    if (sandboxDir) {
      rmSync(sandboxDir, { recursive: true, force: true });
      sandboxDir = '';
    }
  });

  it('writes PID files and creates the parent runtime directory', () => {
    sandboxDir = mkdtempSync(join(tmpdir(), 'process-pid-'));
    const pidFile = join(sandboxDir, 'runtime', 'dashboard.pid');

    writePidFile(pidFile, 4242, log);

    expect(existsSync(pidFile)).toBe(true);
    expect(readFileSync(pidFile, 'utf-8')).toBe('4242');
  });

  it('kills the recorded stale PID and removes the PID file', async () => {
    sandboxDir = mkdtempSync(join(tmpdir(), 'process-pid-'));
    const pidFile = join(sandboxDir, 'runtime', 'dashboard.pid');
    writePidFile(pidFile, 5151, log);

    const livePids = new Set([5151]);
    const killSpy = vi.spyOn(process, 'kill').mockImplementation((((pid: number, signal?: NodeJS.Signals | 0) => {
      if (signal === 0 || signal === undefined) {
        if (livePids.has(pid)) return true;
        throw new Error('ESRCH');
      }
      livePids.delete(pid);
      return true;
    }) as unknown) as typeof process.kill);

    await cleanupStalePidFile(pidFile, 'dashboard', log);

    expect(killSpy).toHaveBeenCalledWith(5151, 'SIGTERM');
    expect(existsSync(pidFile)).toBe(false);
  });

  it('removes PID files idempotently', () => {
    sandboxDir = mkdtempSync(join(tmpdir(), 'process-pid-'));
    const pidFile = join(sandboxDir, 'runtime', 'code-server.pid');
    writePidFile(pidFile, 6161, log);

    removePidFile(pidFile, 'code-server', log);
    removePidFile(pidFile, 'code-server', log);

    expect(existsSync(pidFile)).toBe(false);
  });
});
