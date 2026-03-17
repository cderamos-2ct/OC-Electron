// ─── Paths ───────────────────────────────────────────────────────
// Path constants are resolved at runtime. In dev, env vars override.
// In production, the main process sets OPENCLAW_ROOT / OPENCLAW_DATA_DIR
// env vars during app.whenReady() before these are consumed.
// Renderer code should NEVER import path constants — use IPC instead.
//
// Fallbacks use platform-standard locations:
//   macOS:   ~/.aegilume/data
//   Linux:   ~/.aegilume/data
//   Windows: %USERPROFILE%/.aegilume/data

const HOME = typeof process !== 'undefined'
  ? (process.env.HOME ?? process.env.USERPROFILE ?? '')
  : '';

export const OPENCLAW_ROOT = process.env.OPENCLAW_ROOT ?? (HOME ? `${HOME}/.aegilume` : '');
export const OPENCLAW_DATA_DIR = process.env.OPENCLAW_DATA_DIR ?? (HOME ? `${HOME}/.aegilume/data` : '');
export const TASKS_DIR = `${OPENCLAW_DATA_DIR}/tasks/items`;
export const AGENTS_DIR = `${OPENCLAW_DATA_DIR}/agents`;
export const RUNTIME_DIR = `${OPENCLAW_DATA_DIR}/runtime`;
export const GATEWAY_PID_FILE = `${RUNTIME_DIR}/gateway.pid`;

// ─── Shell Config ────────────────────────────────────────────────

export const SHELL_CONFIG_DIR_NAME = '.openclaw-shell';
export const SHELL_CONFIG_FILE_NAME = 'config.json';
export const AGENT_BINDINGS_FILE_NAME = 'agent-bindings.json';
export const TRUST_HISTORY_FILE_NAME = 'trust-history.json';
export const DEVICE_IDENTITY_FILE_NAME = 'device-identity.json';
export const SHELL_PERMISSIONS_FILE_NAME = 'shell-permissions.json';
export const AUDIT_LOG_FILE = 'cd-actions.jsonl';
export const VAULT_POLICIES_FILE_NAME = 'vault-policies.json';
export const VAULT_AUDIT_LOG_FILE = 'vault-audit.jsonl';
export const VAULT_MASTER_ENC_FILE = 'vault-master.enc';
export const VAULT_SERVER_URL = 'http://127.0.0.1:8222';
export const VAULT_DEFAULT_LEASE_TTL = 3600; // 1 hour in seconds
export const VAULT_SYNC_INTERVAL_MS = 60_000; // 1 minute

// ─── Gateway ─────────────────────────────────────────────────────

export const GATEWAY_URL = 'ws://127.0.0.1:18789';
export const GATEWAY_PORT = 18789;
export const GATEWAY_HEALTH_INTERVAL_MS = 30_000;
export const GATEWAY_RECONNECT_INTERVAL_MS = 2_000;
export const GATEWAY_PROBE_TIMEOUT_MS = 2_000;

// ─── Services ────────────────────────────────────────────────────

export const HIBERNATION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export const DEFAULT_SERVICES = [
  {
    id: 'openclaw-dashboard',
    name: 'Dashboard',
    url: 'http://localhost:3000',
    partition: 'persist:service-openclaw-dashboard',
    pinned: true,
    order: 0,
    agentId: 'cd',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    url: 'https://mail.google.com',
    partition: 'persist:service-gmail',
    pinned: true,
    order: 1,
    agentId: 'karoline',
  },
  {
    id: 'google-calendar',
    name: 'Calendar',
    url: 'https://calendar.google.com',
    partition: 'persist:service-google-calendar',
    pinned: true,
    order: 2,
    agentId: 'calendar',
  },
  {
    id: 'google-chat',
    name: 'Google Chat',
    url: 'https://chat.google.com',
    partition: 'persist:service-google-chat',
    pinned: true,
    order: 3,
    agentId: 'karoline',
  },
  {
    id: 'teams',
    name: 'Teams',
    url: 'https://teams.microsoft.com',
    partition: 'persist:service-teams',
    pinned: true,
    order: 4,
    agentId: 'karoline',
  },
  {
    id: 'slack',
    name: 'Slack',
    url: 'https://app.slack.com',
    partition: 'persist:service-slack',
    pinned: true,
    order: 5,
    agentId: 'karoline',
  },
  {
    id: 'trello',
    name: 'Trello',
    url: 'https://trello.com',
    partition: 'persist:service-trello',
    pinned: false,
    order: 6,
    agentId: 'build',
  },
  {
    id: 'github',
    name: 'GitHub',
    url: 'https://github.com',
    partition: 'persist:service-github',
    pinned: true,
    order: 7,
    agentId: 'build',
  },
  {
    id: 'fireflies',
    name: 'Fireflies',
    url: 'https://app.fireflies.ai',
    partition: 'persist:service-fireflies',
    pinned: false,
    order: 8,
    agentId: 'notes',
  },
] as const;

// ─── UI ──────────────────────────────────────────────────────────

export const RAIL_MIN_WIDTH = 280;
export const RAIL_MAX_WIDTH = 600;
export const RAIL_DEFAULT_WIDTH = 340;
export const TAB_SWITCH_HOTKEY_PREFIX = 'CommandOrControl+';
export const TOGGLE_RAIL_HOTKEY = 'CommandOrControl+Shift+C';
export const SHOW_SHELL_HOTKEY = 'CommandOrControl+Shift+O';
export const NEXT_NOTIFICATION_HOTKEY = 'CommandOrControl+Shift+N';

// ─── Self-Write Tracking ─────────────────────────────────────────

export const SELF_WRITE_TTL_MS = 300;
