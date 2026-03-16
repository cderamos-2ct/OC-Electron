// ─── Platform Abstraction Layer ──────────────────────────────────────────────
//
// Detects the current runtime environment and provides a unified interface for
// platform-specific capabilities. Consumed by both the Electron shell and the
// mobile PWA - no Node.js globals assumed when running in the browser.

// ─── Environment Detection ───────────────────────────────────────────────────

export type PlatformEnv =
  | 'electron-main'      // Node.js main process (has full fs/net access)
  | 'electron-renderer'  // Chromium renderer with contextBridge preload
  | 'mobile-pwa'         // Standalone PWA on iOS/Android
  | 'browser';           // Ordinary browser tab (dev / dashboard)

/**
 * Detect the current runtime environment.
 *
 * Detection order:
 * 1. `process.versions.electron` present AND `window` undefined → `electron-main`
 * 2. `window.electronAPI` exposed by the contextBridge preload → `electron-renderer`
 * 3. `navigator.standalone === true` OR `(display-mode: standalone)` media query → `mobile-pwa`
 * 4. Fallback → `browser`
 *
 * The result is stable for the lifetime of the process. Cache it via
 * `getPlatformContext()` rather than calling this on every render.
 *
 * @returns The detected {@link PlatformEnv}.
 */
export function detectPlatform(): PlatformEnv {
  // Node.js main process
  if (typeof process !== 'undefined' && process.versions?.electron) {
    // In the renderer process window is defined; in main it is not
    if (typeof window === 'undefined') return 'electron-main';
  }

  // Electron renderer - contextBridge exposes window.electronAPI
  if (
    typeof window !== 'undefined' &&
    typeof (window as unknown as ElectronWindow).electronAPI !== 'undefined'
  ) {
    return 'electron-renderer';
  }

  // Mobile standalone PWA
  if (
    typeof window !== 'undefined' &&
    (
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia?.('(display-mode: standalone)').matches
    )
  ) {
    return 'mobile-pwa';
  }

  return 'browser';
}

// ─── Capability Flags ────────────────────────────────────────────────────────

export interface PlatformCapabilities {
  /** Can open native OS windows / menus */
  nativeWindows: boolean;
  /** Can read/write the local filesystem directly */
  localFilesystem: boolean;
  /** Has access to native push notification APIs */
  pushNotifications: boolean;
  /** Can use the system clipboard API */
  clipboard: boolean;
  /** Is running in a touch-first context (phone / tablet) */
  touchFirst: boolean;
  /** Supports background sync via Service Worker */
  backgroundSync: boolean;
  /** Can persist data in IndexedDB */
  indexedDB: boolean;
}

export function getPlatformCapabilities(env: PlatformEnv): PlatformCapabilities {
  switch (env) {
    case 'electron-main':
      return {
        nativeWindows: true,
        localFilesystem: true,
        pushNotifications: false,
        clipboard: true,
        touchFirst: false,
        backgroundSync: false,
        indexedDB: false,
      };
    case 'electron-renderer':
      return {
        nativeWindows: true,
        localFilesystem: false, // must go through IPC
        pushNotifications: false,
        clipboard: true,
        touchFirst: false,
        backgroundSync: false,
        indexedDB: true,
      };
    case 'mobile-pwa':
      return {
        nativeWindows: false,
        localFilesystem: false,
        pushNotifications: typeof PushManager !== 'undefined',
        clipboard: typeof navigator !== 'undefined' && 'clipboard' in navigator,
        touchFirst: true,
        backgroundSync: typeof ServiceWorkerRegistration !== 'undefined' &&
          'sync' in ServiceWorkerRegistration.prototype,
        indexedDB: typeof indexedDB !== 'undefined',
      };
    case 'browser':
      return {
        nativeWindows: false,
        localFilesystem: false,
        pushNotifications: typeof PushManager !== 'undefined',
        clipboard: typeof navigator !== 'undefined' && 'clipboard' in navigator,
        touchFirst: typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches,
        backgroundSync: false,
        indexedDB: typeof indexedDB !== 'undefined',
      };
  }
}

// ─── Gateway URL Resolution ───────────────────────────────────────────────────

/** Well-known OpenClaw network endpoints */
export const GATEWAY_ENDPOINTS = {
  /** Local gateway (direct LAN / loopback) */
  local: 'ws://127.0.0.1:18789',
  /** Cloudflare-tunnelled gateway for remote / mobile access */
  tunnel: 'wss://gateway.openclaw.io',
  /** Web app served via tunnel */
  appUrl: 'https://app.openclaw.io',
  /** Mobile PWA served via tunnel */
  mobileUrl: 'https://mobile.openclaw.io',
} as const;

export type GatewayEndpoint = keyof typeof GATEWAY_ENDPOINTS;

export interface GatewayUrlOptions {
  /** Override the resolved URL entirely */
  overrideUrl?: string;
  /** Force a specific endpoint regardless of environment */
  forceEndpoint?: GatewayEndpoint;
  /** Whether to prefer the tunnel even when local is available (e.g. remote work) */
  preferTunnel?: boolean;
}

/**
 * Resolve the gateway WebSocket URL for the current platform.
 *
 * Resolution order (first match wins):
 * 1. `options.overrideUrl` - explicit override, useful in tests
 * 2. `options.forceEndpoint` - pins to a named {@link GATEWAY_ENDPOINTS} key
 * 3. `process.env.OPENCLAW_GATEWAY_URL` - Node.js env var (Electron main, scripts)
 * 4. `window.OPENCLAW_GATEWAY_URL` - build-time / runtime injection via Vite define
 * 5. `options.preferTunnel` - forces the Cloudflare tunnel regardless of env
 * 6. Platform heuristic:
 *    - `electron-main` / `electron-renderer` → local socket (`ws://127.0.0.1:18789`)
 *    - `mobile-pwa` → Cloudflare tunnel (`wss://gateway.openclaw.io`)
 *    - `browser` on `localhost` → local socket; otherwise → tunnel
 *
 * @param env - The detected {@link PlatformEnv} from `detectPlatform()`.
 * @param options - Optional overrides and preference flags.
 * @returns A WebSocket URL string (ws:// or wss://).
 */
export function resolveGatewayUrl(
  env: PlatformEnv,
  options: GatewayUrlOptions = {}
): string {
  if (options.overrideUrl) return options.overrideUrl;

  if (options.forceEndpoint) {
    return GATEWAY_ENDPOINTS[options.forceEndpoint];
  }

  // Node.js env var (Electron main, scripts)
  if (typeof process !== 'undefined' && process.env?.OPENCLAW_GATEWAY_URL) {
    return process.env.OPENCLAW_GATEWAY_URL;
  }

  // Build-time / runtime injection via global (Vite define / index.html script)
  const win = typeof window !== 'undefined' ? (window as GatewayWindow) : null;
  if (win?.OPENCLAW_GATEWAY_URL) return win.OPENCLAW_GATEWAY_URL;

  if (options.preferTunnel) return GATEWAY_ENDPOINTS.tunnel;

  switch (env) {
    case 'electron-main':
    case 'electron-renderer':
      // Desktop always starts with the local socket; can fall back to tunnel
      return GATEWAY_ENDPOINTS.local;
    case 'mobile-pwa':
      // Mobile connects remotely via Cloudflare tunnel
      return GATEWAY_ENDPOINTS.tunnel;
    case 'browser':
      // Dev server on the same machine: try local; hosted: use tunnel
      return typeof window !== 'undefined' && window.location?.hostname === 'localhost'
        ? GATEWAY_ENDPOINTS.local
        : GATEWAY_ENDPOINTS.tunnel;
  }
}

// ─── Singleton Platform Context ──────────────────────────────────────────────

export interface PlatformContext {
  env: PlatformEnv;
  caps: PlatformCapabilities;
  gatewayUrl: string;
}

let _ctx: PlatformContext | null = null;

/**
 * Returns (and caches) the platform context for the current runtime.
 * Pass options only on the first call - subsequent calls return the cached value.
 */
export function getPlatformContext(options: GatewayUrlOptions = {}): PlatformContext {
  if (_ctx) return _ctx;
  const env = detectPlatform();
  _ctx = {
    env,
    caps: getPlatformCapabilities(env),
    gatewayUrl: resolveGatewayUrl(env, options),
  };
  return _ctx;
}

/** Resets the cached context - useful in tests */
export function resetPlatformContext(): void {
  _ctx = null;
}

// ─── Type Augmentations ──────────────────────────────────────────────────────

/** Shape of the contextBridge API exposed by the Electron preload script */
export interface ElectronAPI {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  on: (channel: string, listener: (...args: unknown[]) => void) => () => void;
  off: (channel: string, listener: (...args: unknown[]) => void) => void;
  platform: 'darwin' | 'win32' | 'linux';
}

interface ElectronWindow {
  electronAPI?: ElectronAPI;
}

interface GatewayWindow {
  OPENCLAW_GATEWAY_URL?: string;
}
