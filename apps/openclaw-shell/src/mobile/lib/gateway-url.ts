// ─── Gateway URL Resolution for the Mobile PWA ──────────────────────────────
//
// Single source of truth for which WebSocket/HTTP URLs the mobile app uses.
//
// Resolution priority (highest wins):
//   1. localStorage override  — set by Settings screen or deep-link param
//   2. ?gateway=<url> query param — handy for dev / testing
//   3. VITE_GATEWAY_URL build-time env var
//   4. Auto-detect: non-localhost hostname → tunnel; localhost → local

import { detectPlatform, GATEWAY_ENDPOINTS, resolveGatewayUrl as coreResolveGatewayUrl } from '@openclaw/core/platform';

// Re-export the canonical detectPlatform so callers that imported from here keep working
export { detectPlatform, GATEWAY_ENDPOINTS };

function resolveGatewayUrl(platform: ReturnType<typeof detectPlatform>): string {
  return coreResolveGatewayUrl(platform);
}

// ─── Storage key ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'openclaw:gateway-url';

// ─── Environment helpers ─────────────────────────────────────────────────────

/** True when running on localhost (dev server or Electron renderer) */
function isLocalhost(): boolean {
  if (typeof window === 'undefined') return true;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

/** Vite build-time env var — set VITE_GATEWAY_URL=wss://... in .env */
function getViteEnvUrl(): string | null {
  // Vite replaces import.meta.env.VITE_* at build time
  const url =
    typeof import.meta !== 'undefined'
      ? (import.meta as unknown as { env?: { VITE_GATEWAY_URL?: string } }).env?.VITE_GATEWAY_URL
      : undefined;
  return url || null;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns the gateway WebSocket URL the mobile app should connect to.
 *
 * Resolution order:
 *   1. localStorage override (persisted user setting)
 *   2. ?gateway= URL query param (ephemeral, for testing)
 *   3. VITE_GATEWAY_URL build-time env var
 *   4. Platform-based default (local for localhost, tunnel for deployed PWA)
 */
export function getMobileGatewayUrl(): string {
  // 1. Persisted user override
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  } catch {
    // localStorage may be unavailable in some contexts
  }

  // 2. Query-param override (e.g. ?gateway=ws://192.168.1.5:18789)
  if (typeof window !== 'undefined') {
    const param = new URLSearchParams(window.location.search).get('gateway');
    if (param) return param;
  }

  // 3. Vite build-time env var
  const viteUrl = getViteEnvUrl();
  if (viteUrl) return viteUrl;

  // 4. Platform default
  const env = detectPlatform();
  return resolveGatewayUrl(env);
}

/**
 * Returns the dashboard HTTP URL appropriate for the current environment.
 * Use VITE_DASHBOARD_URL to override at build time.
 */
export function getDashboardUrl(): string {
  const viteUrl =
    typeof import.meta !== 'undefined'
      ? (import.meta as unknown as { env?: { VITE_DASHBOARD_URL?: string } }).env?.VITE_DASHBOARD_URL
      : undefined;
  if (viteUrl) return viteUrl;
  return isLocalhost() ? 'http://localhost:3000' : 'https://app.aegilume.io';
}

/**
 * Returns the mobile PWA origin URL appropriate for the current environment.
 */
export function getMobileUrl(): string {
  return isLocalhost() ? 'http://localhost:3002' : 'https://mobile.aegilume.io';
}

/**
 * Persists a custom gateway URL so it survives page reloads.
 * Pass `null` to clear and revert to the auto-detected default.
 */
export function setGatewayUrlOverride(url: string | null): void {
  try {
    if (url === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, url);
    }
  } catch {
    // Silently ignore — override is best-effort
  }
}

/**
 * Returns true if the current gateway URL is the Cloudflare tunnel endpoint.
 * Useful to show a "remote" indicator in the UI.
 */
export function isUsingTunnel(): boolean {
  const url = getMobileGatewayUrl();
  return url === GATEWAY_ENDPOINTS.tunnel || url.includes('aegilume.io');
}

/**
 * Returns a human-readable label for the current gateway endpoint.
 */
export function getGatewayLabel(): string {
  const url = getMobileGatewayUrl();
  if (url === GATEWAY_ENDPOINTS.local) return 'Local (127.0.0.1)';
  if (url === GATEWAY_ENDPOINTS.tunnel) return 'Remote (aegilume.io)';
  return url;
}

// Note: GATEWAY_ENDPOINTS and detectPlatform are re-exported at the top of this file.
