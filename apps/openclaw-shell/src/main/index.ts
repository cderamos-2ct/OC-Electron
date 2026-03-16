import { app, BrowserWindow, shell } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { createTray } from './tray.js';
import { registerHotkeys, unregisterHotkeys } from './hotkeys.js';
import { registerIpcHandlers } from './ipc-handlers.js';
import { GatewayProcessManager } from './gateway-process.js';
import { GatewayClient, shellDeviceAuthProvider } from './gateway-client.js';
import { ServiceManager } from './services/service-manager.js';
import { TaskEngine } from './task-engine.js';
import { WorkerManager } from './api-workers/worker-manager.js';
import { GwsGmailWorker } from './api-workers/gws-gmail-worker.js';
import { GwsCalendarWorker } from './api-workers/gws-calendar-worker.js';
import { GitHubWorker } from './api-workers/github-worker.js';
import { CDBridge } from './cd-bridge.js';
import { AgentServiceBindingRegistry } from './agent-binding-registry.js';
import { setNotificationWindow, showNativeNotification, classifyEventPriority } from './notifications.js';
import { applyWindowState, trackWindowState } from './window-state.js';
import { GATEWAY_URL } from '../shared/constants.js';
import type { CDAction, EventFrame } from '../shared/types.js';
import { BwAdapter } from './vault/bw-adapter.js';
import { VaultAdapter } from './vault/vault-adapter.js';
import { VaultBridge } from './vault/vault-bridge.js';
import { VaultCredentialProvider, LegacyFileCredentialProvider } from './api-workers/credential-provider.js';
import { registerVaultIpcHandlers } from './vault/vault-ipc.js';

// NOTE: All instances are created inside app.whenReady() or at worst after
// app.requestSingleInstanceLock(). Do NOT call Electron window/screen/tray
// APIs at module scope — they require the app to be ready first.
const gatewayManager = new GatewayProcessManager();
const serviceManager = new ServiceManager();
const taskEngine = new TaskEngine();
const workerManager = new WorkerManager();
workerManager.register(new GwsGmailWorker());
workerManager.register(new GwsCalendarWorker());
workerManager.register(new GitHubWorker());

let mainWindow: BrowserWindow | null = null;
let gatewayClient: GatewayClient | null = null;
let cdBridge: CDBridge | null = null;
let vaultBridge: VaultBridge | null = null;
let isQuiting = false;

function createWindow(): BrowserWindow {
  const preloadPath = join(__dirname, '../preload/preload.js');
  // When packaged, __dirname is out/main/ so ../preload and ../renderer are correct.

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: true,
    },
  });

  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  win.once('ready-to-show', () => {
    win.show();
  });

  win.on('close', (event) => {
    // On macOS, closing the window hides it rather than quitting
    if (process.platform === 'darwin' && !isQuiting) {
      event.preventDefault();
      win.hide();
    }
  });

  // Open external links in the system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  return win;
}

// ── Single Instance Lock ────────────────────────────────────────────────────

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // ── App Lifecycle ───────────────────────────────────────────────────────

  app.whenReady().then(async () => {
    mainWindow = createWindow();

    // Phase 5: Apply saved window state (position, size, maximized)
    applyWindowState(mainWindow);
    trackWindowState(mainWindow);

    // Phase 5: Wire native notification system
    setNotificationWindow(mainWindow);

    // Instantiate gateway client with forwarding callbacks that reference mainWindow
    gatewayClient = new GatewayClient({
      url: GATEWAY_URL,
      deviceAuth: shellDeviceAuthProvider,
      onStateChange: (state) => {
        mainWindow?.webContents.send('gateway:state', state);
      },
      onEvent: (evt) => {
        mainWindow?.webContents.send('gateway:event', evt);

        // Phase 5: Fire native OS notifications for important events
        const frame = evt as EventFrame;
        if (frame?.event) {
          const priority = classifyEventPriority(frame.event, frame.payload);
          if (priority !== 'info') {
            const payload = frame.payload as Record<string, unknown> | undefined;
            showNativeNotification({
              title: String(payload?.title ?? frame.event),
              body: String(payload?.body ?? payload?.description ?? payload?.message ?? ''),
              priority,
              serviceId: payload?.serviceId as string | undefined,
              actionId: payload?.actionId as string | undefined,
            });
          }
        }
      },
    });

    // Instantiate CD Action Bridge (Phase 4)
    const bindingRegistry = AgentServiceBindingRegistry.fromConfig();
    cdBridge = new CDBridge(gatewayClient, serviceManager, bindingRegistry);
    cdBridge.setMainWindow(mainWindow);

    // Listen for CD action requests from the gateway
    gatewayClient.on('cd.action.request', (payload) => {
      const { action } = payload as { action: CDAction };
      if (action) {
        void cdBridge!.handleActionRequest(action);
      }
    });

    // ── Vault Integration ─────────────────────────────────────────────
    try {
      const bwAdapter = new BwAdapter();
      const vaultAdapter = new VaultAdapter(bwAdapter);
      vaultBridge = new VaultBridge(vaultAdapter);
      vaultBridge.setMainWindow(mainWindow);

      // Set up credential provider — vault-backed with legacy fallback
      const vaultCredentialProvider = new VaultCredentialProvider(vaultBridge);
      workerManager.setCredentialProvider(vaultCredentialProvider);

      // Register vault IPC handlers
      registerVaultIpcHandlers(vaultBridge);

      // Initialize vault in background (don't block app startup)
      void vaultAdapter.initialize().then(() => {
        console.log('[App] Vault adapter initialized.');
      }).catch((err) => {
        console.warn('[App] Vault initialization failed, using legacy credentials:', err);
        // Fall back to legacy file-based credentials
        const legacyProvider = new LegacyFileCredentialProvider();
        workerManager.setCredentialProvider(legacyProvider);
      });
    } catch (err) {
      console.warn('[App] Vault setup failed, using legacy credentials:', err);
      const legacyProvider = new LegacyFileCredentialProvider();
      workerManager.setCredentialProvider(legacyProvider);
    }

    createTray(mainWindow);
    registerHotkeys(mainWindow);
    registerIpcHandlers(gatewayClient, serviceManager, taskEngine, workerManager, cdBridge);

    // Start API workers (graceful — workers handle missing credentials internally)
    try {
      workerManager.startAll();
    } catch (err) {
      console.error('[App] Failed to start API workers:', err);
    }

    // Broadcast external task file changes to all renderer windows
    taskEngine.on('task:changed', (data) => {
      for (const wc of BrowserWindow.getAllWindows().map((w) => w.webContents)) {
        wc.send('task:changed', data);
      }
    });

    // Start gateway process (probe-first: connect if running, spawn if not)
    await gatewayManager.start();

    // Connect the WS client after the process is confirmed up
    gatewayClient.connect();
  });

  app.on('window-all-closed', () => {
    // On macOS, don't quit when all windows are closed — hide to tray
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    // Guard: activate can fire before whenReady() resolves on macOS launch
    if (!app.isReady()) return;

    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      mainWindow = createWindow();
    }
  });

  app.on('before-quit', () => {
    // Mark quitting so the window close handler lets it through
    isQuiting = true;

    // Gracefully disconnect WS client — do NOT kill the gateway process
    gatewayClient?.disconnect();
    gatewayManager.stop();

    // Stop API workers
    workerManager.stopAll();

    // Stop vault bridge
    if (vaultBridge) {
      void vaultBridge.stop();
    }

    // Dispose task engine (stop file watcher)
    taskEngine.dispose();

    unregisterHotkeys();
  });
}
