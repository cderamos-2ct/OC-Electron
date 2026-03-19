import { app, BrowserWindow, shell, session } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { logger } from './logging/logger.js';
import { initTelemetry } from './telemetry/crash-reporter.js';

// ── Telemetry: init VERY early, before any other subsystem ───────────────────
{
  let consent = false;
  try {
    const { readFileSync: _readSetup, existsSync: _existsSetup } = await import('node:fs');
    const { join: _joinSetup } = await import('node:path');
    const { homedir: _homedirSetup } = await import('node:os');
    const { SHELL_CONFIG_DIR_NAME } = await import('../shared/constants.js');
    const setupFile = _joinSetup(_homedirSetup(), SHELL_CONFIG_DIR_NAME, 'setup.json');
    if (_existsSetup(setupFile)) {
      const raw = _readSetup(setupFile, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      consent = parsed['telemetryConsent'] === true;
    }
  } catch {
    // setup.json absent or unreadable — default to no consent
  }
  initTelemetry({
    dsn: 'https://placeholder@o0.ingest.sentry.io/0',
    appVersion: app.getVersion(),
    environment: app.isPackaged ? 'production' : 'development',
    consent,
  });
}

import { createTray } from './tray.js';
import { registerHotkeys, unregisterHotkeys } from './hotkeys.js';
import { registerIpcHandlers } from './ipc-handlers.js';
import { GatewayProcessManager } from './gateway-process.js';
import { GatewayClient, shellDeviceAuthProvider } from './gateway-client.js';
import { ProvisioningManager } from './provisioning/provisioning-manager.js';
import { PathProvisioner } from './provisioning/path-provisioner.js';
import { PostgresProvisioner } from './provisioning/postgres-provisioner.js';
import { GatewayProvisioner } from './provisioning/gateway-provisioner.js';
import { GwsProvisioner } from './provisioning/gws-provisioner.js';
import { CredentialProvisioner } from './provisioning/credential-provisioner.js';
import { DashboardProvisioner } from './provisioning/dashboard-provisioner.js';
import { CodeServerProvisioner } from './provisioning/codeserver-provisioner.js';
import { PermissionProvisioner } from './provisioning/permission-provisioner.js';
import { ProcessSupervisor } from './provisioning/process-supervisor.js';
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
import type { CDAction, EventFrame, GatewayConnectionState } from '../shared/types.js';
import { initMasterKey } from './vault/vault-master-key.js';
import { PostgresVaultAdapter } from './vault/postgres-vault-adapter.js';
import { VaultBridge } from './vault/vault-bridge.js';
import { VaultCredentialProvider, SecureCredentialProvider, LegacyFileCredentialProvider } from './api-workers/credential-provider.js';
import { registerVaultIpcHandlers } from './vault/vault-ipc.js';
import { assertEnvironment } from './config/env.js';
import { runCredentialMigration } from './config/credentials-migration.js';
import { registerDeepLinkProtocol, handleDeepLink, processPendingDeepLink } from './deep-link.js';
import { initUpdater } from './updater.js';

// NOTE: All instances are created inside app.whenReady() or at worst after
// app.requestSingleInstanceLock(). Do NOT call Electron window/screen/tray
// APIs at module scope — they require the app to be ready first.
const gatewayManager = new GatewayProcessManager();
const serviceManager = new ServiceManager();
const taskEngine = new TaskEngine();
const provisioningManager = new ProvisioningManager();
const processSupervisor = new ProcessSupervisor();
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

registerDeepLinkProtocol();

// macOS: handle aegilume:// URLs when app is already running
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url, mainWindow);
});

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    // Windows/Linux: deep link arrives as a command-line argument
    const url = argv.find((arg) => arg.startsWith('aegilume://'));
    if (url) {
      handleDeepLink(url, mainWindow);
    }
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // ── App Lifecycle ───────────────────────────────────────────────────────

  app.whenReady().then(async () => {
    // ── Startup: Env validation + credential migration ───────────────────────
    try {
      assertEnvironment();
    } catch (err) {
      logger.error('Startup env validation failed:', err);
    }
    void runCredentialMigration().then((result) => {
      if (result.migrated) {
        logger.info(`Credential migration complete: ${result.keysWritten.join(', ')}`);
      } else if (result.error) {
        logger.warn('Credential migration error:', result.error);
      }
    });

    // ── Provisioning: create shared provisioner instances ──────────────────
    const pathProv = new PathProvisioner();
    const pgProv = new PostgresProvisioner();
    const gwProv = new GatewayProvisioner();
    const gwsProv = new GwsProvisioner();
    const credProv = new CredentialProvisioner();
    const permProv = new PermissionProvisioner();
    const dsProv = new DashboardProvisioner();
    const csProv = new CodeServerProvisioner();

    // Register with provisioning manager (all services in dependency order)
    provisioningManager.register(pathProv);
    provisioningManager.register(pgProv);
    provisioningManager.register(gwProv);
    provisioningManager.register(gwsProv);
    provisioningManager.register(credProv);
    provisioningManager.register(permProv);
    provisioningManager.register(dsProv);
    provisioningManager.register(csProv);

    // Register daemon services with supervisor (same instances — shared process handles)
    processSupervisor.register(pgProv);
    processSupervisor.register(gwProv);
    processSupervisor.register(dsProv);
    processSupervisor.register(csProv);

    mainWindow = createWindow();
    provisioningManager.setMainWindow(mainWindow);
    processPendingDeepLink(mainWindow);

    // Provision and start services — run provisioning if not yet complete
    try {
      if (!provisioningManager.isComplete()) {
        logger.info('Provisioning not complete — running provisioners...');
        await provisioningManager.runAll();
      }
      await processSupervisor.startAll();
      logger.info('All provisioned services started via ProcessSupervisor.');
    } catch (err) {
      logger.error('Failed to provision/start services:', err);
    }

    // Security: Set Content Security Policy
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            [
              "default-src 'self'",
              "script-src 'self'",
              "style-src 'self' 'unsafe-inline'",  // needed for inline styles
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' ws://127.0.0.1:18789 http://127.0.0.1:8222",  // gateway + vault
              "frame-src 'self' https:",  // webview content
            ].join('; ')
          ],
        },
      });
    });

    // Security: Restrict permission requests
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      const allowed = ['clipboard-read', 'clipboard-sanitized-write', 'notifications'];
      callback(allowed.includes(permission));
    });

    // Security: Restrict permission check
    session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
      const allowed = ['clipboard-read', 'clipboard-sanitized-write', 'notifications'];
      return allowed.includes(permission);
    });

    // Security: Prevent navigation to external URLs
    mainWindow.webContents.on('will-navigate', (event, url) => {
      const parsedUrl = new URL(url);
      if (parsedUrl.origin !== 'http://localhost:5173' && !url.startsWith('file://')) {
        event.preventDefault();
        logger.warn('Blocked navigation to:', url);
      }
    });

    // Phase 5: Apply saved window state (position, size, maximized)
    applyWindowState(mainWindow);
    trackWindowState(mainWindow);

    // Initialize auto-updater (checks for updates after 10s delay)
    initUpdater(mainWindow);

    // Phase 5: Wire native notification system
    setNotificationWindow(mainWindow);

    // Instantiate gateway client with forwarding callbacks that reference mainWindow
    gatewayClient = new GatewayClient({
      url: GATEWAY_URL,
      deviceAuth: shellDeviceAuthProvider,
      onStateChange: (state: GatewayConnectionState) => {
        mainWindow?.webContents.send('gateway:state', state);
      },
      onEvent: (evt: unknown) => {
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
    gatewayClient.on('cd.action.request', (payload: unknown) => {
      const { action } = payload as { action: CDAction };
      if (action) {
        void cdBridge!.handleActionRequest(action);
      }
    });

    // ── Vault Integration ─────────────────────────────────────────────
    try {
      initMasterKey();
      const vaultAdapter = new PostgresVaultAdapter();
      vaultBridge = new VaultBridge(vaultAdapter);
      vaultBridge.setMainWindow(mainWindow);

      // Set up credential provider — vault-backed with legacy fallback
      const vaultCredentialProvider = new VaultCredentialProvider(vaultBridge);
      workerManager.setCredentialProvider(vaultCredentialProvider);

      // Register vault IPC handlers
      registerVaultIpcHandlers(vaultBridge);

      // Initialize vault in background (don't block app startup)
      void vaultAdapter.initialize().then(() => {
        logger.info('Vault adapter initialized.');
      }).catch((err: unknown) => {
        logger.warn('Vault initialization failed, using secure local credentials:', err);
        // Prefer safeStorage-encrypted store; legacy plaintext is last resort
        const secureProvider = new SecureCredentialProvider();
        workerManager.setCredentialProvider(secureProvider);
      });
    } catch (err) {
      logger.warn('Vault setup failed, using secure local credentials:', err);
      const secureProvider = new SecureCredentialProvider();
      workerManager.setCredentialProvider(secureProvider);
    }

    createTray(mainWindow);
    registerHotkeys(mainWindow);
    registerIpcHandlers(gatewayClient, serviceManager, taskEngine, workerManager, cdBridge, provisioningManager);

    // Start API workers (graceful — workers handle missing credentials internally)
    try {
      workerManager.startAll();
    } catch (err) {
      logger.error('Failed to start API workers:', err);
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

    // Stop provisioned services in reverse dependency order via supervisor
    void processSupervisor.stopAll();

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
