// OpenClaw Gateway WebSocket Client
// Standalone package extracted from apps/openclaw-shell/src/main/gateway-client.ts
// Device auth is pluggable via DeviceAuthProvider interface for PWA/Electron compatibility

import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import type {
  EventFrame,
  ResponseFrame,
  HelloOk,
  GatewayConnectionState,
  GatewayEventName,
  GatewayEventMap,
  RPCMethodMap,
  RPCParams,
  RPCResult,
} from '@openclaw/core/gateway';

export type {
  GatewayConnectionState,
  GatewayEventName,
  GatewayEventMap,
  RPCMethodMap,
  RPCParams,
  RPCResult,
  EventFrame,
  ResponseFrame,
  HelloOk,
} from '@openclaw/core/gateway';

// ─── Pluggable Device Auth Interface ────────────────────────────────────────

/**
 * Device identity returned by the auth provider.
 * Ed25519-based for the Electron shell; can be stubbed for PWA auth.
 */
export type DeviceIdentity = {
  deviceId: string;
  publicKey: string;
  privateKey: string;
};

/**
 * Pluggable interface for device authentication.
 * Implement this to support different auth strategies (Electron vs PWA vs test).
 */
export type DeviceAuthProvider = {
  /** Load or create the persistent device identity. */
  loadOrCreateDeviceIdentity(): Promise<DeviceIdentity>;
  /** Sign a payload string with the device private key. Returns base64 signature. */
  signDevicePayload(privateKey: string, payload: string): Promise<string>;
  /** Load a stored device auth token for the given deviceId+role, or null. */
  loadDeviceAuthToken(params: { deviceId: string; role: string }): { token: string } | null;
  /** Persist a new device auth token. */
  storeDeviceAuthToken(params: {
    deviceId: string;
    role: string;
    token: string;
    scopes: string[];
  }): void;
  /** Remove a stored device auth token. */
  clearDeviceAuthToken(params: { deviceId: string; role: string }): void;
  /** Return platform info for the connect frame. */
  getPlatformInfo(): { platform: string; userAgent: string };
};

// ─── Internal Types ──────────────────────────────────────────────────────────

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
  timer?: ReturnType<typeof setTimeout>;
};

type EventListener<E extends GatewayEventName = GatewayEventName> = (
  payload: GatewayEventMap[E]
) => void;

// ─── Public Options ──────────────────────────────────────────────────────────

export type GatewayClientOptions = {
  url: string;
  token?: string;
  password?: string;
  clientName?: string;
  clientVersion?: string;
  instanceId?: string;
  autoConnect?: boolean;
  rpcTimeoutMs?: number;
  /** Pluggable device auth provider. Required for Ed25519 device identity flow. */
  deviceAuth?: DeviceAuthProvider;
  onStateChange?: (state: GatewayConnectionState) => void;
  onHello?: (hello: HelloOk) => void;
  onEvent?: (evt: EventFrame) => void;
  onError?: (error: Error) => void;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const CONNECT_FAILED_CODE = 4008;
const CLIENT_ID = 'openclaw-shell';
const CLIENT_MODE = 'shell';
const CONNECT_SCOPES = ['operator.admin', 'operator.approvals', 'operator.pairing'];

// ─── Error ───────────────────────────────────────────────────────────────────

export class GatewayRequestError extends Error {
  readonly gatewayCode: string;
  readonly details?: unknown;

  constructor(error: { code: string; message: string; details?: unknown }) {
    super(error.message);
    this.name = 'GatewayRequestError';
    this.gatewayCode = error.code;
    this.details = error.details;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildDeviceAuthPayload(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;
  nonce: string;
}): string {
  return [
    'v2',
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(','),
    String(params.signedAtMs),
    params.token ?? '',
    params.nonce,
  ].join('|');
}

// ─── GatewayClient ───────────────────────────────────────────────────────────

export class GatewayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private listeners = new Map<string, Set<EventListener>>();
  private closed = false;
  private lastSeq: number | null = null;
  private connectNonce: string | null = null;
  private connectSent = false;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = 1500;
  private pendingConnectError: GatewayRequestError | null = null;
  private tokenOnlyFallbackAttempted = false;
  private opts: Required<Pick<GatewayClientOptions, 'url' | 'rpcTimeoutMs'>> &
    GatewayClientOptions;

  state: GatewayConnectionState = 'disconnected';
  hello: HelloOk | null = null;
  error: Error | null = null;

  constructor(options: GatewayClientOptions) {
    this.opts = {
      rpcTimeoutMs: 30_000,
      ...options,
    };
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  connect() {
    this.closed = false;
    this.error = null;
    this.tokenOnlyFallbackAttempted = false;
    this.setState('connecting');
    this.doConnect();
  }

  disconnect() {
    this.closed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    this.pendingConnectError = null;
    this.tokenOnlyFallbackAttempted = false;
    this.ws?.close();
    this.ws = null;
    this.flushPending(new Error('gateway client stopped'));
    this.setState('disconnected');
  }

  get isConnected() {
    return this.state === 'connected';
  }

  // ─── RPC ────────────────────────────────────────────────────────────────

  async rpc<M extends keyof RPCMethodMap>(
    method: M,
    ...args: RPCParams<M> extends void ? [] : [RPCParams<M>]
  ): Promise<RPCResult<M>> {
    const params = args[0];
    return this.request(method, params) as Promise<RPCResult<M>>;
  }

  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('gateway not connected'));
    }
    const id = randomUUID();
    const frame = { type: 'req', id, method, params };
    const paramsTimeout =
      params && typeof params === 'object' && 'timeoutMs' in params
        ? (params as { timeoutMs?: number }).timeoutMs
        : undefined;
    const timeoutMs = paramsTimeout ? paramsTimeout + 5_000 : this.opts.rpcTimeoutMs;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RPC timeout: ${method} (${timeoutMs}ms)`));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
        timer,
      });
      this.ws!.send(JSON.stringify(frame));
    });
  }

  // ─── Event Subscription ─────────────────────────────────────────────────

  on<E extends GatewayEventName>(
    event: E,
    callback: (payload: GatewayEventMap[E]) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(callback as EventListener);

    return () => {
      set.delete(callback as EventListener);
      if (set.size === 0) this.listeners.delete(event);
    };
  }

  // ─── Internal ───────────────────────────────────────────────────────────

  private setState(s: GatewayConnectionState) {
    if (this.state === s) return;
    this.state = s;
    this.opts.onStateChange?.(s);
  }

  private doConnect() {
    if (this.closed) return;

    try {
      this.ws = new WebSocket(this.opts.url);
    } catch (err) {
      this.error = err instanceof Error ? err : new Error(String(err));
      this.setState('error');
      this.scheduleReconnect();
      return;
    }

    this.ws.on('open', () => {
      this.setState('authenticating');
      this.queueConnect();
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(String(data));
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      const connectError = this.pendingConnectError;
      this.pendingConnectError = null;
      this.ws = null;
      this.flushPending(new Error(`gateway closed (${code}): ${reason.toString()}`));
      if (connectError) {
        this.error = connectError;
      }
      if (!this.closed) {
        this.setState('disconnected');
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', () => {
      // Close handler will fire
    });
  }

  private scheduleReconnect() {
    if (this.closed) return;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 1.7, 15_000);
    this.reconnectTimer = setTimeout(() => {
      this.setState('connecting');
      this.doConnect();
    }, delay);
  }

  private flushPending(err: Error) {
    for (const [, p] of this.pending) {
      if (p.timer) clearTimeout(p.timer);
      p.reject(err);
    }
    this.pending.clear();
  }

  private queueConnect() {
    this.connectNonce = null;
    this.connectSent = false;
    this.tokenOnlyFallbackAttempted = false;
    if (this.connectTimer) clearTimeout(this.connectTimer);
    this.connectTimer = setTimeout(() => {
      void this.sendConnect();
    }, 750);
  }

  private async sendConnect(options: { forceTokenOnly?: boolean } = {}) {
    if (this.connectSent) return;
    this.connectSent = true;
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    const role = 'operator';
    const deviceAuth = this.opts.deviceAuth;

    // If no device auth provider, fall back to token/password only
    if (!deviceAuth || options.forceTokenOnly) {
      const auth =
        this.opts.token || this.opts.password
          ? { token: this.opts.token, password: this.opts.password }
          : undefined;

      const platformInfo = deviceAuth?.getPlatformInfo() ?? {
        platform: process.platform,
        userAgent: `openclaw-gateway-client/0.1.0`,
      };

      const params = {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: this.opts.clientName ?? CLIENT_ID,
          version: this.opts.clientVersion ?? '1.0.0',
          platform: platformInfo.platform,
          mode: CLIENT_MODE,
          instanceId: this.opts.instanceId,
        },
        role,
        scopes: CONNECT_SCOPES,
        device: undefined,
        caps: [],
        auth,
        locale: 'en',
        userAgent: platformInfo.userAgent,
      };

      this.request<HelloOk>('connect', params)
        .then((hello) => {
          this.hello = hello;
          this.backoffMs = 800;
          this.setState('connected');
          this.opts.onHello?.(hello);
        })
        .catch((err) => {
          this.pendingConnectError =
            err instanceof GatewayRequestError
              ? err
              : new GatewayRequestError({
                  code: 'UNAVAILABLE',
                  message: err instanceof Error ? err.message : String(err),
                });
          this.error = err instanceof Error ? err : new Error(String(err));
          this.setState('error');
          this.opts.onError?.(this.error);
          this.ws?.close(CONNECT_FAILED_CODE, 'connect failed');
        });
      return;
    }

    // Full Ed25519 device auth flow
    const deviceIdentity = await deviceAuth.loadOrCreateDeviceIdentity();
    const storedToken = deviceAuth.loadDeviceAuthToken({
      deviceId: deviceIdentity.deviceId,
      role,
    })?.token;
    const hasStoredDeviceToken = Boolean(storedToken);
    const authToken = storedToken ?? this.opts.token;
    const canFallbackToShared = Boolean(storedToken && this.opts.token);

    const auth =
      authToken || this.opts.password
        ? { token: authToken, password: this.opts.password }
        : undefined;

    const signedAtMs = Date.now();
    const nonce = this.connectNonce ?? '';
    const payload = buildDeviceAuthPayload({
      deviceId: deviceIdentity.deviceId,
      clientId: this.opts.clientName ?? CLIENT_ID,
      clientMode: CLIENT_MODE,
      role,
      scopes: CONNECT_SCOPES,
      signedAtMs,
      token: authToken ?? null,
      nonce,
    });
    const signature = await deviceAuth.signDevicePayload(deviceIdentity.privateKey, payload);
    const device = {
      id: deviceIdentity.deviceId,
      publicKey: deviceIdentity.publicKey,
      signature,
      signedAt: signedAtMs,
      nonce,
    };

    const platformInfo = deviceAuth.getPlatformInfo();

    const params = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: this.opts.clientName ?? CLIENT_ID,
        version: this.opts.clientVersion ?? '1.0.0',
        platform: platformInfo.platform,
        mode: CLIENT_MODE,
        instanceId: this.opts.instanceId,
      },
      role,
      scopes: CONNECT_SCOPES,
      device,
      caps: [],
      auth,
      locale: 'en',
      userAgent: platformInfo.userAgent,
    };

    this.request<HelloOk>('connect', params)
      .then((hello) => {
        if (hello?.auth?.deviceToken) {
          deviceAuth.storeDeviceAuthToken({
            deviceId: deviceIdentity.deviceId,
            role: hello.auth.role ?? role,
            token: hello.auth.deviceToken,
            scopes: hello.auth.scopes ?? [],
          });
        }
        this.hello = hello;
        this.backoffMs = 800;
        this.setState('connected');
        this.opts.onHello?.(hello);
      })
      .catch((err) => {
        const canRetryWithoutDevice =
          !options.forceTokenOnly &&
          !this.tokenOnlyFallbackAttempted &&
          Boolean(this.opts.token) &&
          !hasStoredDeviceToken;

        if (canRetryWithoutDevice) {
          this.tokenOnlyFallbackAttempted = true;
          this.connectSent = false;
          this.error = null;
          this.pendingConnectError = null;
          void this.sendConnect({ forceTokenOnly: true });
          return;
        }

        if (canFallbackToShared) {
          deviceAuth.clearDeviceAuthToken({ deviceId: deviceIdentity.deviceId, role });
        }
        this.pendingConnectError =
          err instanceof GatewayRequestError
            ? err
            : new GatewayRequestError({
                code: 'UNAVAILABLE',
                message: err instanceof Error ? err.message : String(err),
              });
        this.error = err instanceof Error ? err : new Error(String(err));
        this.setState('error');
        this.opts.onError?.(this.error);
        this.ws?.close(CONNECT_FAILED_CODE, 'connect failed');
      });
  }

  private handleMessage(raw: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const frame = parsed as { type?: string };

    if (frame.type === 'event') {
      const evt = parsed as EventFrame;

      // Handle connect challenge
      if (evt.event === 'connect.challenge') {
        const payload = evt.payload as { nonce?: string } | undefined;
        if (payload?.nonce) {
          this.connectNonce = payload.nonce;
          void this.sendConnect();
        }
        return;
      }

      // Sequence gap detection
      const seq = typeof evt.seq === 'number' ? evt.seq : null;
      if (seq !== null && this.lastSeq !== null && seq > this.lastSeq + 1) {
        console.warn(
          `[openclaw-gateway-client] event sequence gap: expected ${this.lastSeq + 1}, got ${seq}`
        );
      }
      if (seq !== null) this.lastSeq = seq;

      // Notify global handler
      this.opts.onEvent?.(evt);

      // Notify typed listeners
      const listeners = this.listeners.get(evt.event);
      if (listeners) {
        for (const cb of listeners) {
          try {
            cb(evt.payload as never);
          } catch (err) {
            console.error('[openclaw-gateway-client] event listener error:', err);
          }
        }
      }
      return;
    }

    if (frame.type === 'res') {
      const res = parsed as ResponseFrame;
      const pending = this.pending.get(res.id);
      if (!pending) return;
      this.pending.delete(res.id);
      if (pending.timer) clearTimeout(pending.timer);
      if (res.ok) {
        pending.resolve(res.payload);
      } else {
        pending.reject(
          new GatewayRequestError({
            code: res.error?.code ?? 'UNAVAILABLE',
            message: res.error?.message ?? 'request failed',
            details: res.error?.details,
          })
        );
      }
    }
  }
}
