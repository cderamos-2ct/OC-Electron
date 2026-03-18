import { autoUpdater, type UpdateInfo, type ProgressInfo } from 'electron-updater';
import { BrowserWindow } from 'electron';
import { logger } from './logging/logger.js';

export interface UpdateStatus {
  state: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'ready' | 'error';
  info?: UpdateInfo;
  progress?: ProgressInfo;
  error?: string;
}

let mainWindow: BrowserWindow | null = null;
let currentStatus: UpdateStatus = { state: 'idle' };

function broadcast(status: UpdateStatus): void {
  currentStatus = status;
  mainWindow?.webContents.send('updater:status', status);
}

export function initUpdater(win: BrowserWindow): void {
  mainWindow = win;

  // Configuration
  autoUpdater.autoDownload = true; // Silent background download
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = logger;

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    logger.info('Update available:', info.version);
    broadcast({ state: 'available', info });
  });

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    broadcast({ state: 'not-available', info });
  });

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    broadcast({ state: 'downloading', progress });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    logger.info('Update downloaded:', info.version);
    broadcast({ state: 'ready', info });
  });

  autoUpdater.on('error', (err: Error) => {
    logger.error('Auto-updater error:', err);
    broadcast({ state: 'error', error: err.message });
  });

  // Check for updates after a short delay (don't block startup)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err: unknown) => {
      logger.warn('Update check failed:', err);
    });
  }, 10_000);
}

export function checkForUpdates(): void {
  broadcast({ state: 'checking' });
  autoUpdater.checkForUpdates().catch((err: unknown) => {
    logger.warn('Manual update check failed:', err);
    broadcast({ state: 'error', error: err instanceof Error ? err.message : String(err) });
  });
}

export function installUpdate(): void {
  // Never force restart — quit and install when user confirms
  autoUpdater.quitAndInstall(false, true);
}

export function getUpdateStatus(): UpdateStatus {
  return currentStatus;
}
