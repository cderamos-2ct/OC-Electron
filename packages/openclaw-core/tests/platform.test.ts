import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectPlatform,
  getPlatformCapabilities,
  resolveGatewayUrl,
  getPlatformContext,
  resetPlatformContext,
  GATEWAY_ENDPOINTS,
} from '../src/platform.js';

describe('detectPlatform', () => {
  it('returns browser when no special globals are set', () => {
    const platform = detectPlatform();
    // In a Node/vitest environment: no window, no electron
    expect(['browser', 'electron-main']).toContain(platform);
  });
});

describe('getPlatformCapabilities', () => {
  it('electron-main has localFilesystem and nativeWindows', () => {
    const caps = getPlatformCapabilities('electron-main');
    expect(caps.localFilesystem).toBe(true);
    expect(caps.nativeWindows).toBe(true);
    expect(caps.touchFirst).toBe(false);
    expect(caps.backgroundSync).toBe(false);
  });

  it('electron-renderer has nativeWindows but no localFilesystem', () => {
    const caps = getPlatformCapabilities('electron-renderer');
    expect(caps.nativeWindows).toBe(true);
    expect(caps.localFilesystem).toBe(false);
    expect(caps.indexedDB).toBe(true);
  });

  it('mobile-pwa has touchFirst', () => {
    const caps = getPlatformCapabilities('mobile-pwa');
    expect(caps.touchFirst).toBe(true);
    expect(caps.nativeWindows).toBe(false);
    expect(caps.localFilesystem).toBe(false);
  });

  it('browser has no nativeWindows or localFilesystem', () => {
    const caps = getPlatformCapabilities('browser');
    expect(caps.nativeWindows).toBe(false);
    expect(caps.localFilesystem).toBe(false);
    expect(caps.backgroundSync).toBe(false);
  });
});

describe('resolveGatewayUrl', () => {
  it('returns overrideUrl when provided', () => {
    const url = resolveGatewayUrl('browser', { overrideUrl: 'ws://custom:9999' });
    expect(url).toBe('ws://custom:9999');
  });

  it('returns the correct endpoint for forceEndpoint', () => {
    const url = resolveGatewayUrl('browser', { forceEndpoint: 'tunnel' });
    expect(url).toBe(GATEWAY_ENDPOINTS.tunnel);
  });

  it('returns local gateway for electron-main by default', () => {
    const url = resolveGatewayUrl('electron-main');
    expect(url).toBe(GATEWAY_ENDPOINTS.local);
  });

  it('returns local gateway for electron-renderer by default', () => {
    const url = resolveGatewayUrl('electron-renderer');
    expect(url).toBe(GATEWAY_ENDPOINTS.local);
  });

  it('returns tunnel for mobile-pwa by default', () => {
    const url = resolveGatewayUrl('mobile-pwa');
    expect(url).toBe(GATEWAY_ENDPOINTS.tunnel);
  });

  it('returns tunnel when preferTunnel is set', () => {
    const url = resolveGatewayUrl('electron-main', { preferTunnel: true });
    expect(url).toBe(GATEWAY_ENDPOINTS.tunnel);
  });

  it('uses OPENCLAW_GATEWAY_URL env var when set', () => {
    process.env.OPENCLAW_GATEWAY_URL = 'ws://env-override:1234';
    const url = resolveGatewayUrl('electron-main');
    expect(url).toBe('ws://env-override:1234');
    delete process.env.OPENCLAW_GATEWAY_URL;
  });
});

describe('getPlatformContext', () => {
  beforeEach(() => {
    resetPlatformContext();
  });

  it('returns a context with env, caps, and gatewayUrl', () => {
    const ctx = getPlatformContext({ overrideUrl: 'ws://test:1234' });
    expect(ctx).toHaveProperty('env');
    expect(ctx).toHaveProperty('caps');
    expect(ctx.gatewayUrl).toBe('ws://test:1234');
  });

  it('caches the context on subsequent calls', () => {
    const ctx1 = getPlatformContext({ overrideUrl: 'ws://first:1111' });
    const ctx2 = getPlatformContext({ overrideUrl: 'ws://second:2222' });
    expect(ctx1).toBe(ctx2); // same reference — cached
  });

  it('resetPlatformContext clears the cache', () => {
    const ctx1 = getPlatformContext({ overrideUrl: 'ws://first:1111' });
    resetPlatformContext();
    const ctx2 = getPlatformContext({ overrideUrl: 'ws://second:2222' });
    expect(ctx1).not.toBe(ctx2);
    expect(ctx2.gatewayUrl).toBe('ws://second:2222');
  });
});

describe('GATEWAY_ENDPOINTS', () => {
  it('has local, tunnel, appUrl, and mobileUrl', () => {
    expect(GATEWAY_ENDPOINTS.local).toMatch(/^ws:\/\//);
    expect(GATEWAY_ENDPOINTS.tunnel).toMatch(/^wss:\/\//);
    expect(GATEWAY_ENDPOINTS.appUrl).toMatch(/^https:\/\//);
    expect(GATEWAY_ENDPOINTS.mobileUrl).toMatch(/^https:\/\//);
  });
});
