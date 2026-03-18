// ─── Offline Action Queue ────────────────────────────────────────────────────
//
// Queues gateway RPC actions that were dispatched while the app was offline
// and replays them once connectivity is restored.
//
// The queue is persisted in localStorage so it survives page refreshes.
// Unlike the mobile version, this does NOT use Service Worker / Background Sync
// (not available in Electron). Flushing is triggered manually when the gateway
// reconnects.

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QueuedAction {
  id: string;
  method: string;
  params: unknown;
  queuedAt: number;
  /** Number of times replay has been attempted */
  attempts: number;
}

export type QueueFlushResult =
  | { id: string; status: 'ok' }
  | { id: string; status: 'error'; error: string };

export type GatewayRpcFn = (method: string, params?: unknown) => Promise<unknown>;

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'openclaw:offline-queue';
const MAX_ATTEMPTS = 5;
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours — discard stale actions

/**
 * Only idempotent, safe methods are allowed in the offline queue.
 * Destructive actions like 'approval:decide' must NEVER be queued — they
 * require real-time user intent and could cause unintended side effects if
 * replayed later.
 */
const IDEMPOTENT_METHODS = new Set([
  'chat.send',
  'gateway:rpc',
  'task:mutate',
  'task:quick-decision',
]);

// ─── Queue persistence ───────────────────────────────────────────────────────

function loadQueue(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Evict entries that are too old or have too many attempts
    const now = Date.now();
    return (parsed as QueuedAction[]).filter(
      (a) => a.attempts < MAX_ATTEMPTS && now - a.queuedAt < MAX_AGE_MS
    );
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedAction[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Quota exceeded or storage unavailable — drop silently
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Adds an RPC action to the offline queue for later replay.
 *
 * Only idempotent methods (IDEMPOTENT_METHODS allowlist) may be queued.
 * Returns null if the method is not allowed to be queued.
 *
 * Call this instead of gatewayRpc() when the gateway is not connected.
 */
export function enqueueAction(method: string, params?: unknown): QueuedAction | null {
  if (!IDEMPOTENT_METHODS.has(method)) {
    return null;
  }

  const queue = loadQueue();
  const action: QueuedAction = {
    id: crypto.randomUUID(),
    method,
    params,
    queuedAt: Date.now(),
    attempts: 0,
  };
  queue.push(action);
  saveQueue(queue);
  return action;
}

/**
 * Returns all actions currently in the queue (read-only snapshot).
 */
export function getPendingActions(): readonly QueuedAction[] {
  return loadQueue();
}

/**
 * Returns the number of actions waiting to be replayed.
 */
export function getPendingCount(): number {
  return loadQueue().length;
}

/**
 * Replays all queued actions against the gateway.
 *
 * Successful actions are removed from the queue; failed actions have their
 * `attempts` counter incremented and are kept for retry. Actions that exceed
 * MAX_ATTEMPTS are discarded.
 *
 * @param rpc  The gateway RPC function
 * @returns    Array of per-action results
 */
export async function flushQueue(rpc: GatewayRpcFn): Promise<QueueFlushResult[]> {
  const queue = loadQueue();
  if (queue.length === 0) return [];

  const results: QueueFlushResult[] = [];
  const remaining: QueuedAction[] = [];

  for (const action of queue) {
    try {
      await rpc(action.method, action.params as Record<string, unknown>);
      results.push({ id: action.id, status: 'ok' });
      // Successfully replayed — do not add back to queue
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({ id: action.id, status: 'error', error });

      const next = { ...action, attempts: action.attempts + 1 };
      if (next.attempts < MAX_ATTEMPTS) {
        remaining.push(next);
      }
      // Else: silently discard after MAX_ATTEMPTS
    }
  }

  saveQueue(remaining);
  return results;
}

/**
 * Removes a specific action from the queue (e.g. if the user cancels it).
 */
export function dequeueAction(id: string): void {
  const queue = loadQueue().filter((a) => a.id !== id);
  saveQueue(queue);
}

/**
 * Clears the entire queue without replaying. Use with caution.
 */
export function clearQueue(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
