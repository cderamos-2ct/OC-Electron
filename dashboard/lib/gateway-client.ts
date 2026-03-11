// OpenClaw Gateway WebSocket Client
// Ported from openclaw/ui/src/ui/gateway.ts to plain TypeScript (no Lit dependency)

import { clearDeviceAuthToken, loadDeviceAuthToken, storeDeviceAuthToken } from "./device-auth";
import { loadOrCreateDeviceIdentity, signDevicePayload } from "./device-identity";
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
} from "./types";

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
  timer?: ReturnType<typeof setTimeout>;
};

type EventListener<E extends GatewayEventName = GatewayEventName> = (
  payload: GatewayEventMap[E]
) => void;

export type GatewayClientOptions = {
  url: string;
  token?: string;
  password?: string;
  clientName?: string;
  clientVersion?: string;
  instanceId?: string;
  autoConnect?: boolean;
  rpcTimeoutMs?: number;
  onStateChange?: (state: GatewayConnectionState) => void;
  onHello?: (hello: HelloOk) => void;
  onEvent?: (evt: EventFrame) => void;
  onError?: (error: Error) => void;
};

const CONNECT_FAILED_CODE = 4008;
const CLIENT_ID = "openclaw-control-ui";
const CLIENT_MODE = "webchat";
const CONNECT_SCOPES = ["operator.admin", "operator.approvals", "operator.pairing"];

class GatewayRequestError extends Error {
  readonly gatewayCode: string;
  readonly details?: unknown;

  constructor(error: { code: string; message: string; details?: unknown }) {
    super(error.message);
    this.name = "GatewayRequestError";
    this.gatewayCode = error.code;
    this.details = error.details;
  }
}

function buildDeviceAuthPayload(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;
  nonce: string;
}) {
  return [
    "v2",
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(","),
    String(params.signedAtMs),
    params.token ?? "",
    params.nonce,
  ].join("|");
}

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
  private backoffMs = 800;
  private pendingConnectError: GatewayRequestError | null = null;
  private tokenOnlyFallbackAttempted = false;
  private opts: Required<
    Pick<GatewayClientOptions, "url" | "rpcTimeoutMs">
  > &
    GatewayClientOptions;

  state: GatewayConnectionState = "disconnected";
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
    this.setState("connecting");
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
    this.flushPending(new Error("gateway client stopped"));
    this.setState("disconnected");
  }

  get isConnected() {
    return this.state === "connected";
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
      return Promise.reject(new Error("gateway not connected"));
    }
    const id = crypto.randomUUID();
    const frame = { type: "req", id, method, params };

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RPC timeout: ${method} (${this.opts.rpcTimeoutMs}ms)`));
      }, this.opts.rpcTimeoutMs);

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
      this.setState("error");
      this.scheduleReconnect();
      return;
    }

    this.ws.addEventListener("open", () => {
      this.setState("authenticating");
      this.queueConnect();
    });

    this.ws.addEventListener("message", (ev) => {
      this.handleMessage(String(ev.data ?? ""));
    });

    this.ws.addEventListener("close", (ev) => {
      const connectError = this.pendingConnectError;
      this.pendingConnectError = null;
      this.ws = null;
      this.flushPending(
        new Error(`gateway closed (${ev.code}): ${ev.reason ?? ""}`)
      );
      if (connectError) {
        this.error = connectError;
      }
      if (!this.closed) {
        this.setState("disconnected");
        this.scheduleReconnect();
      }
    });

    this.ws.addEventListener("error", () => {
      // Close handler will fire
    });
  }

  private scheduleReconnect() {
    if (this.closed) return;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 1.7, 15_000);
    this.reconnectTimer = setTimeout(() => {
      this.setState("connecting");
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
    // Wait briefly for challenge nonce, then send connect anyway
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

    const role = "operator";
    const isSecureContext =
      typeof window !== "undefined" &&
      window.isSecureContext &&
      typeof crypto !== "undefined" &&
      !!crypto.subtle;

    let authToken = this.opts.token;
    let canFallbackToShared = false;
    let hasStoredDeviceToken = false;
    let deviceIdentity: Awaited<ReturnType<typeof loadOrCreateDeviceIdentity>> | null = null;

    if (isSecureContext) {
      deviceIdentity = await loadOrCreateDeviceIdentity();
      const storedToken = loadDeviceAuthToken({
        deviceId: deviceIdentity.deviceId,
        role,
      })?.token;
      hasStoredDeviceToken = Boolean(storedToken);
      authToken = storedToken ?? this.opts.token;
      canFallbackToShared = Boolean(storedToken && this.opts.token);
    }

    const auth =
      authToken || this.opts.password
        ? { token: authToken, password: this.opts.password }
        : undefined;

    let device:
      | {
          id: string;
          publicKey: string;
          signature: string;
          signedAt: number;
          nonce: string;
        }
      | undefined;

    if (isSecureContext && deviceIdentity && !options.forceTokenOnly) {
      const signedAtMs = Date.now();
      const nonce = this.connectNonce ?? "";
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
      const signature = await signDevicePayload(deviceIdentity.privateKey, payload);
      device = {
        id: deviceIdentity.deviceId,
        publicKey: deviceIdentity.publicKey,
        signature,
        signedAt: signedAtMs,
        nonce,
      };
    }

    const params = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: this.opts.clientName ?? CLIENT_ID,
        version: this.opts.clientVersion ?? "1.0.0",
        platform: typeof navigator !== "undefined" ? navigator.platform : "web",
        mode: CLIENT_MODE,
        instanceId: this.opts.instanceId,
      },
      role,
      scopes: CONNECT_SCOPES,
      device,
      caps: [],
      auth,
      locale: typeof navigator !== "undefined" ? navigator.language : "en",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    };

    this.request<HelloOk>("connect", params)
      .then((hello) => {
        if (hello?.auth?.deviceToken && deviceIdentity) {
          storeDeviceAuthToken({
            deviceId: deviceIdentity.deviceId,
            role: hello.auth.role ?? role,
            token: hello.auth.deviceToken,
            scopes: hello.auth.scopes ?? [],
          });
        }
        this.hello = hello;
        this.backoffMs = 800;
        this.setState("connected");
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

        if (canFallbackToShared && deviceIdentity) {
          clearDeviceAuthToken({ deviceId: deviceIdentity.deviceId, role });
        }
        this.pendingConnectError =
          err instanceof GatewayRequestError
            ? err
            : new GatewayRequestError({
                code: "UNAVAILABLE",
                message: err instanceof Error ? err.message : String(err),
              });
        this.error = err instanceof Error ? err : new Error(String(err));
        this.setState("error");
        this.opts.onError?.(this.error);
        this.ws?.close(CONNECT_FAILED_CODE, "connect failed");
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

    if (frame.type === "event") {
      const evt = parsed as EventFrame;

      // Handle connect challenge
      if (evt.event === "connect.challenge") {
        const payload = evt.payload as { nonce?: string } | undefined;
        if (payload?.nonce) {
          this.connectNonce = payload.nonce;
          void this.sendConnect();
        }
        return;
      }

      // Sequence gap detection
      const seq = typeof evt.seq === "number" ? evt.seq : null;
      if (seq !== null && this.lastSeq !== null && seq > this.lastSeq + 1) {
        console.warn(
          `[openclaw] event sequence gap: expected ${this.lastSeq + 1}, got ${seq}`
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
            console.error("[openclaw] event listener error:", err);
          }
        }
      }
      return;
    }

    if (frame.type === "res") {
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
            code: res.error?.code ?? "UNAVAILABLE",
            message: res.error?.message ?? "request failed",
            details: res.error?.details,
          })
        );
      }
    }
  }
}
