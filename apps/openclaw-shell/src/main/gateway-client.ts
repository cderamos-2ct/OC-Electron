// OpenClaw Gateway Client — Shell adapter
// Re-exports GatewayClient from @openclaw/gateway-client with the Electron
// shell's Ed25519 device auth provider wired in.

export {
  GatewayClient,
  GatewayRequestError,
} from '@openclaw/gateway-client';

export type {
  GatewayClientOptions,
  DeviceAuthProvider,
  DeviceIdentity,
  GatewayConnectionState,
  GatewayEventName,
  GatewayEventMap,
  RPCMethodMap,
  RPCParams,
  RPCResult,
  EventFrame,
  ResponseFrame,
  HelloOk,
} from '@openclaw/gateway-client';

import { clearDeviceAuthToken, loadDeviceAuthToken, storeDeviceAuthToken } from './device-auth.js';
import { loadOrCreateDeviceIdentity, signDevicePayload, getPlatformInfo } from './device-identity.js';
import type { DeviceAuthProvider } from '@openclaw/gateway-client';

/**
 * The Electron shell device auth provider.
 * Uses Ed25519 keys stored on disk via device-identity.ts / device-auth.ts.
 */
export const shellDeviceAuthProvider: DeviceAuthProvider = {
  loadOrCreateDeviceIdentity,
  signDevicePayload,
  loadDeviceAuthToken,
  storeDeviceAuthToken,
  clearDeviceAuthToken,
  getPlatformInfo,
};
