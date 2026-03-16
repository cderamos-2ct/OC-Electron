// Global test setup for openclaw-shell main process tests
import { vi } from 'vitest';

// Mock Electron — not available in Node test environment
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => `/mock/electron/${name}`),
    getVersion: vi.fn(() => '35.0.0'),
    on: vi.fn(),
    whenReady: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn(),
    isPackaged: false,
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    webContents: {
      send: vi.fn(),
      openDevTools: vi.fn(),
    },
    on: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    close: vi.fn(),
    isDestroyed: vi.fn(() => false),
  })),
  shell: {
    openExternal: vi.fn(),
  },
  nativeTheme: {
    themeSource: 'system',
    shouldUseDarkColors: false,
    on: vi.fn(),
  },
  screen: {
    getPrimaryDisplay: vi.fn(() => ({
      workAreaSize: { width: 1920, height: 1080 },
    })),
  },
  session: {
    fromPartition: vi.fn(() => ({
      setPermissionRequestHandler: vi.fn(),
      webRequest: { onHeadersReceived: vi.fn() },
    })),
  },
  protocol: {
    registerFileProtocol: vi.fn(),
    registerSchemesAsPrivileged: vi.fn(),
    handle: vi.fn(),
  },
  contextBridge: {
    exposeInMainWorld: vi.fn(),
  },
}));

// Mock @electron/remote
vi.mock('@electron/remote', () => ({
  initialize: vi.fn(),
  enable: vi.fn(),
}));

// Mock pg Pool
vi.mock('pg', () => {
  const mockClient = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
  };
  const MockPool = vi.fn().mockImplementation(() => ({
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    connect: vi.fn().mockResolvedValue(mockClient),
    end: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  }));
  return { Pool: MockPool, default: { Pool: MockPool } };
});
