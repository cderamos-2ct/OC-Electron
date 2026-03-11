export type DeviceAuthEntry = {
  token: string;
  role: string;
  scopes: string[];
  updatedAtMs: number;
};

export type DeviceAuthStore = {
  version: 1;
  deviceId: string;
  tokens: Record<string, DeviceAuthEntry>;
};

type StoreAdapter = {
  readStore: () => DeviceAuthStore | null;
  writeStore: (store: DeviceAuthStore) => void;
};

function normalizeRole(role: string) {
  return role.trim();
}

function normalizeScopes(scopes: string[] | undefined): string[] {
  if (!Array.isArray(scopes)) {
    return [];
  }
  const out = new Set<string>();
  for (const scope of scopes) {
    const trimmed = scope.trim();
    if (trimmed) {
      out.add(trimmed);
    }
  }
  return [...out].sort();
}

export function loadDeviceAuthTokenFromStore(params: {
  adapter: StoreAdapter;
  deviceId: string;
  role: string;
}): DeviceAuthEntry | null {
  const store = params.adapter.readStore();
  if (!store || store.version !== 1 || store.deviceId !== params.deviceId) {
    return null;
  }
  return store.tokens[normalizeRole(params.role)] ?? null;
}

export function storeDeviceAuthTokenInStore(params: {
  adapter: StoreAdapter;
  deviceId: string;
  role: string;
  token: string;
  scopes?: string[];
}): DeviceAuthEntry {
  const role = normalizeRole(params.role);
  const next: DeviceAuthEntry = {
    token: params.token,
    role,
    scopes: normalizeScopes(params.scopes),
    updatedAtMs: Date.now(),
  };
  const store = params.adapter.readStore();
  const nextStore: DeviceAuthStore =
    store && store.version === 1 && store.deviceId === params.deviceId
      ? { ...store, tokens: { ...store.tokens, [role]: next } }
      : { version: 1, deviceId: params.deviceId, tokens: { [role]: next } };
  params.adapter.writeStore(nextStore);
  return next;
}

export function clearDeviceAuthTokenFromStore(params: {
  adapter: StoreAdapter;
  deviceId: string;
  role: string;
}) {
  const store = params.adapter.readStore();
  if (!store || store.version !== 1 || store.deviceId !== params.deviceId) {
    return;
  }
  const role = normalizeRole(params.role);
  if (!(role in store.tokens)) {
    return;
  }
  const tokens = { ...store.tokens };
  delete tokens[role];
  params.adapter.writeStore({ ...store, tokens });
}
