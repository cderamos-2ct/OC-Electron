import { app, BrowserWindow } from 'electron';
import { logger } from './logging/logger.js';
import type { DeepLinkAction, ViewId } from '../shared/types.js';

// ─── Allowlist ─────────────────────────────────────────────────────────────

const VALID_VIEWS: ViewId[] = [
  'home',
  'tasks',
  'draft-review',
  'agents',
  'comms',
  'calendar',
  'github',
  'browser',
  'vault',
];

// ─── State ─────────────────────────────────────────────────────────────────

let pendingDeepLink: string | null = null;

// ─── Protocol Registration ─────────────────────────────────────────────────

export function registerDeepLinkProtocol(): void {
  if (process.defaultApp) {
    // Dev mode: need to pass the app path as the first argv
    app.setAsDefaultProtocolClient('aegilume', process.execPath, [process.argv[1]]);
  } else {
    app.setAsDefaultProtocolClient('aegilume');
  }
}

// ─── Parsing ───────────────────────────────────────────────────────────────

/**
 * Parse an aegilume:// URL into a typed DeepLinkAction.
 * Only allowlisted actions are returned — everything else is rejected and logged.
 *
 * Supported patterns:
 *   aegilume://view/{viewId}
 *   aegilume://task/{taskId}
 *   aegilume://vault/unlock
 */
export function parseDeepLink(url: string): DeepLinkAction | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    logger.warn('Deep link rejected — invalid URL:', url);
    return null;
  }

  if (parsed.protocol !== 'aegilume:') {
    logger.warn('Deep link rejected — wrong protocol:', url);
    return null;
  }

  // URL host = first path segment when using custom schemes
  // aegilume://view/home → host="view", pathname="/home"
  // aegilume://task/abc123 → host="task", pathname="/abc123"
  // aegilume://vault/unlock → host="vault", pathname="/unlock"
  const host = parsed.hostname;
  const pathParts = parsed.pathname.split('/').filter(Boolean);

  switch (host) {
    case 'view': {
      const viewId = pathParts[0] as ViewId | undefined;
      if (!viewId || !VALID_VIEWS.includes(viewId)) {
        logger.warn(`Deep link rejected — unknown viewId "${viewId}":`, url);
        return null;
      }
      return { type: 'navigate-view', viewId };
    }

    case 'task': {
      const taskId = pathParts[0];
      if (!taskId || !/^[\w-]+$/.test(taskId)) {
        logger.warn(`Deep link rejected — invalid taskId "${taskId}":`, url);
        return null;
      }
      return { type: 'open-task', taskId };
    }

    case 'vault': {
      const action = pathParts[0];
      if (action !== 'unlock') {
        logger.warn(`Deep link rejected — unknown vault action "${action}":`, url);
        return null;
      }
      return { type: 'vault-unlock' };
    }

    default:
      logger.warn(`Deep link rejected — unknown host "${host}":`, url);
      return null;
  }
}

// ─── Handling ──────────────────────────────────────────────────────────────

export function handleDeepLink(url: string, mainWindow: BrowserWindow | null): void {
  const action = parseDeepLink(url);
  if (!action) return;

  if (!mainWindow) {
    logger.info('Deep link queued (window not ready):', url);
    pendingDeepLink = url;
    return;
  }

  logger.info('Dispatching deep link:', action);
  mainWindow.webContents.send('deeplink:navigate', action);

  // Bring window to front
  if (!mainWindow.isVisible()) mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

export function processPendingDeepLink(mainWindow: BrowserWindow): void {
  if (!pendingDeepLink) return;

  const url = pendingDeepLink;
  pendingDeepLink = null;
  logger.info('Processing pending deep link:', url);
  handleDeepLink(url, mainWindow);
}
