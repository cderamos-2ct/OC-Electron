import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CODE_SERVER_PID_FILE,
  DASHBOARD_PID_FILE,
} from '../../shared/constants.js';

const {
  cleanupStalePidFileMock,
  existsSyncMock,
  execFileAsyncMock,
  getCodeServerDirMock,
  getDataDirMock,
  getPostgresDataDirMock,
  isPidRunningMock,
  readFileSyncMock,
  removePidFileMock,
  resolvePgVectorLibMock,
  resolvePostgresBinMock,
  resolveResourcePathMock,
  spawnMock,
  writePidFileMock,
} = vi.hoisted(() => ({
  cleanupStalePidFileMock: vi.fn(),
  existsSyncMock: vi.fn(),
  execFileAsyncMock: vi.fn(),
  getCodeServerDirMock: vi.fn(),
  getDataDirMock: vi.fn(),
  getPostgresDataDirMock: vi.fn(),
  isPidRunningMock: vi.fn(),
  readFileSyncMock: vi.fn(),
  removePidFileMock: vi.fn(),
  resolvePgVectorLibMock: vi.fn(),
  resolvePostgresBinMock: vi.fn(),
  resolveResourcePathMock: vi.fn(),
  spawnMock: vi.fn(),
  writePidFileMock: vi.fn(),
}));

vi.mock('child_process', () => ({
  spawn: spawnMock,
  execFile: vi.fn(),
}));

vi.mock('util', async () => {
  const actual = await vi.importActual<typeof import('util')>('util');
  return {
    ...actual,
    promisify: vi.fn(() => execFileAsyncMock),
  };
});

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: existsSyncMock,
    readFileSync: readFileSyncMock,
  };
});

vi.mock('./platform.js', () => ({
  getCodeServerDir: getCodeServerDirMock,
  getDataDir: getDataDirMock,
  getPostgresDataDir: getPostgresDataDirMock,
  resolvePgVectorLib: resolvePgVectorLibMock,
  resolvePostgresBin: resolvePostgresBinMock,
  resolveResourcePath: resolveResourcePathMock,
}));

vi.mock('../logging/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('../process-pid.js', () => ({
  cleanupStalePidFile: cleanupStalePidFileMock,
  isPidRunning: isPidRunningMock,
  removePidFile: removePidFileMock,
  writePidFile: writePidFileMock,
}));

import { CodeServerProvisioner } from './codeserver-provisioner.js';
import { DashboardProvisioner } from './dashboard-provisioner.js';
import { PostgresProvisioner } from './postgres-provisioner.js';

function makeChild(pid: number): EventEmitter & {
  pid: number;
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
} {
  const child = new EventEmitter() as EventEmitter & {
    pid: number;
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
  };
  child.pid = pid;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  return child;
}

describe('managed service PID handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isPidRunningMock.mockReturnValue(false);
    existsSyncMock.mockReturnValue(true);
    resolveResourcePathMock.mockImplementation((...segments: string[]) => `/mock/${segments.join('/')}`);
    getCodeServerDirMock.mockReturnValue('/mock/code-server');
    getDataDirMock.mockReturnValue('/mock/data');
    getPostgresDataDirMock.mockReturnValue('/mock/data/postgres/data');
    resolvePgVectorLibMock.mockReturnValue('/mock/postgres/lib/vector.so');
    resolvePostgresBinMock.mockImplementation((binary: string) => `/mock/postgres/bin/${binary}`);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  });

  it('cleans stale dashboard PIDs, writes the new PID file, and removes it on exit', async () => {
    const child = makeChild(4101);
    spawnMock.mockReturnValue(child);

    const provisioner = new DashboardProvisioner();
    await provisioner.start();

    expect(cleanupStalePidFileMock).toHaveBeenCalledWith(DASHBOARD_PID_FILE, 'dashboard', expect.any(Object));
    expect(writePidFileMock).toHaveBeenCalledWith(DASHBOARD_PID_FILE, 4101, expect.any(Object));

    child.emit('exit', 0, null);

    expect(removePidFileMock).toHaveBeenCalledWith(DASHBOARD_PID_FILE, 'dashboard', expect.any(Object));
  });

  it('cleans stale code-server PIDs, writes the new PID file, and removes it on exit', async () => {
    const child = makeChild(5202);
    spawnMock.mockReturnValue(child);

    const provisioner = new CodeServerProvisioner();
    await provisioner.start();

    expect(cleanupStalePidFileMock).toHaveBeenCalledWith(CODE_SERVER_PID_FILE, 'code-server', expect.any(Object));
    expect(writePidFileMock).toHaveBeenCalledWith(CODE_SERVER_PID_FILE, 5202, expect.any(Object));

    child.emit('exit', 0, null);

    expect(removePidFileMock).toHaveBeenCalledWith(CODE_SERVER_PID_FILE, 'code-server', expect.any(Object));
  });

  it('does not adopt an already-running dashboard without a managed PID file', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    const provisioner = new DashboardProvisioner();
    await provisioner.start();

    expect(writePidFileMock).not.toHaveBeenCalled();
  });

  it('does not adopt an already-running code-server without a managed PID file', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    const provisioner = new CodeServerProvisioner();
    await provisioner.start();

    expect(writePidFileMock).not.toHaveBeenCalled();
  });

  it('cleans stale Postgres postmaster PID files and records the active postmaster PID', async () => {
    execFileAsyncMock
      .mockRejectedValueOnce(new Error('not running'))
      .mockResolvedValueOnce({ stdout: '', stderr: '' });
    readFileSyncMock.mockReturnValue('6303\n/Volumes/Storage/OpenClaw\n');

    const provisioner = new PostgresProvisioner('/mock/data/postgres/data', 5432);
    await provisioner.start();

    expect(cleanupStalePidFileMock).toHaveBeenCalledWith(
      '/mock/data/postgres/data/postmaster.pid',
      'PostgreSQL',
      expect.any(Object),
    );
    expect(writePidFileMock).not.toHaveBeenCalledWith(expect.stringContaining('postgres.pid'), expect.anything(), expect.anything());
  });
});
