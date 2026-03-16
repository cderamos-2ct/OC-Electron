// Mobile Gateway Client — browser-native WebSocket, no Node.js deps
// Connects to Aegilume gateway using the resolved URL from gateway-url.ts.
// When disconnected, RPC calls that opt-in to queuing are stored in the
// offline queue and replayed automatically on reconnect.

import type {
  GatewayConnectionState,
  EventFrame,
  ResponseFrame,
  HelloOk,
  GatewayEventName,
  GatewayEventMap,
  RPCMethodMap,
  RPCParams,
  RPCResult,
} from '../../shared/types';

import { getMobileGatewayUrl } from './gateway-url';
import { enqueueAction, flushQueue } from './offline-queue';

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
  timer?: ReturnType<typeof setTimeout>;
};

type EventCallback = (payload: unknown) => void;

export type MobileGatewayOptions = {
  /** Override the gateway WebSocket URL (default: resolved from gateway-url.ts) */
  url?: string;
  token?: string;
  clientName?: string;
  onStateChange?: (state: GatewayConnectionState) => void;
  onEvent?: (evt: EventFrame) => void;
  onQueueFlushed?: (count: number) => void;
};

const RPC_TIMEOUT_MS = 30_000;
const CLIENT_ID = 'openclaw-mobile';
const CLIENT_MODE = 'webchat';
const CONNECT_SCOPES = ['operator.admin', 'operator.approvals', 'operator.pairing'];

export class MobileGatewayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private listeners = new Map<string, Set<EventCallback>>();
  private closed = false;
  private connectSent = false;
  private connectNonce: string | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = 1500;

  state: GatewayConnectionState = 'disconnected';
  hello: HelloOk | null = null;
  error: Error | null = null;

  private opts: MobileGatewayOptions;

  constructor(options: MobileGatewayOptions = {}) {
    this.opts = options;
  }

  get url(): string {
    return this.opts.url ?? getMobileGatewayUrl();
  }

  get isConnected(): boolean {
    return this.state === 'connected';
  }

  /** True when not connected — callers should enqueue instead of calling request() */
  get isOffline(): boolean {
    return this.state !== 'connected';
  }

  connect(): void {
    this.closed = false;
    this.error = null;
    this.setState('connecting');
    this.doConnect();
  }

  disconnect(): void {
    this.closed = true;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.connectTimer) { clearTimeout(this.connectTimer); this.connectTimer = null; }
    this.ws?.close();
    this.ws = null;
    this.flushPending(new Error('gateway client stopped'));
    this.setState('disconnected');
  }

  async rpc<M extends keyof RPCMethodMap>(
    method: M,
    ...args: RPCParams<M> extends void ? [] : [RPCParams<M>]
  ): Promise<RPCResult<M>> {
    return this.request(method, args[0]) as Promise<RPCResult<M>>;
  }

  /**
   * Send an RPC request.
   * When offline, rejects immediately — callers should use requestOrQueue() instead.
   */
  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('gateway not connected'));
    }
    const id = crypto.randomUUID();
    const frame = { type: 'req', id, method, params };

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, RPC_TIMEOUT_MS);

      this.pending.set(id, { resolve: (v) => resolve(v as T), reject, timer });
      this.ws!.send(JSON.stringify(frame));
    });
  }

  /**
   * Send an RPC request, or enqueue it for later replay if offline.
   * Returns the RPC result when online, or null when the action was queued.
   */
  async requestOrQueue<T = unknown>(method: string, params?: unknown): Promise<T | null> {
    if (this.isConnected) {
      return this.request<T>(method, params);
    }
    enqueueAction(method, params);
    return null;
  }

  on<E extends GatewayEventName>(
    event: E,
    callback: (payload: GatewayEventMap[E]) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(callback as EventCallback);
    return () => {
      set.delete(callback as EventCallback);
      if (set.size === 0) this.listeners.delete(event);
    };
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  private setState(s: GatewayConnectionState): void {
    if (this.state === s) return;
    this.state = s;
    this.opts.onStateChange?.(s);

    // When we become connected, replay any queued offline actions
    if (s === 'connected') {
      void this.replayQueue();
    }
  }

  private async replayQueue(): Promise<void> {
    try {
      const results = await flushQueue((method, params) =>
        this.request(method, params)
      );
      const succeeded = results.filter((r) => r.status === 'ok').length;
      if (succeeded > 0) {
        this.opts.onQueueFlushed?.(succeeded);
      }
    } catch {
      // Best-effort — offline queue replay should never crash the client
    }
  }

  private doConnect(): void {
    if (this.closed) return;
    try {
      this.ws = new WebSocket(this.url);
    } catch (err) {
      this.error = err instanceof Error ? err : new Error(String(err));
      this.setState('error');
      this.scheduleReconnect();
      return;
    }

    this.ws.addEventListener('open', () => {
      this.setState('authenticating');
      this.connectNonce = null;
      this.connectSent = false;
      // Wait briefly for challenge nonce, then connect anyway
      this.connectTimer = setTimeout(() => void this.sendConnect(), 750);
    });

    this.ws.addEventListener('message', (ev) => {
      this.handleMessage(String(ev.data ?? ''));
    });

    this.ws.addEventListener('close', (ev) => {
      this.ws = null;
      this.flushPending(new Error(`gateway closed (${ev.code})`));
      if (!this.closed) {
        this.setState('disconnected');
        this.scheduleReconnect();
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 1.7, 15_000);
    this.reconnectTimer = setTimeout(() => {
      this.setState('connecting');
      this.doConnect();
    }, delay);
  }

  private flushPending(err: Error): void {
    for (const [, p] of this.pending) {
      if (p.timer) clearTimeout(p.timer);
      p.reject(err);
    }
    this.pending.clear();
  }

  private async sendConnect(): Promise<void> {
    if (this.connectSent) return;
    this.connectSent = true;
    if (this.connectTimer) { clearTimeout(this.connectTimer); this.connectTimer = null; }

    const auth = this.opts.token ? { token: this.opts.token } : undefined;
    const params = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: this.opts.clientName ?? CLIENT_ID,
        version: '1.0.0',
        platform: navigator.platform,
        mode: CLIENT_MODE,
      },
      role: 'operator',
      scopes: CONNECT_SCOPES,
      auth,
      // Include the challenge nonce when the gateway sent one, so the server
      // can verify the handshake without a separate round-trip.
      nonce: this.connectNonce ?? undefined,
      locale: navigator.language,
      userAgent: navigator.userAgent,
    };

    try {
      const hello = await this.request<HelloOk>('connect', params);
      this.hello = hello;
      this.backoffMs = 800;
      this.setState('connected');
    } catch (err) {
      this.error = err instanceof Error ? err : new Error(String(err));
      this.setState('error');
      this.ws?.close();
    }
  }

  private handleMessage(raw: string): void {
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return; }

    const frame = parsed as { type?: string };

    if (frame.type === 'event') {
      const evt = parsed as EventFrame;

      if (evt.event === 'connect.challenge') {
        const payload = evt.payload as { nonce?: string } | undefined;
        if (payload?.nonce) {
          this.connectNonce = payload.nonce;
          void this.sendConnect();
        }
        return;
      }

      this.opts.onEvent?.(evt);

      const listeners = this.listeners.get(evt.event);
      if (listeners) {
        for (const cb of listeners) {
          try { cb(evt.payload); } catch (err) {
            console.error('[mobile-gateway] listener error:', err);
          }
        }
      }
      return;
    }

    if (frame.type === 'res') {
      const res = parsed as ResponseFrame;
      const p = this.pending.get(res.id);
      if (!p) return;
      this.pending.delete(res.id);
      if (p.timer) clearTimeout(p.timer);
      if (res.ok) {
        p.resolve(res.payload);
      } else {
        p.reject(new Error(res.error?.message ?? 'request failed'));
      }
    }
  }
}
