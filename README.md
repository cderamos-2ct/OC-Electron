# Aegilume Shell

AI-agent-controlled multi-tab browser and command center. 16 autonomous agents orchestrated through an Electron desktop shell and Next.js dashboard, managing communications, scheduling, finance, research, and day-to-day workflows.

## Monorepo Structure

```
OpenClaw/
├── apps/
│   ├── openclaw-shell/     Electron 35 + React 19 desktop shell (primary app)
│   └── runtime/            FastAPI backend — heartbeat, directives, agent coordination
├── packages/
│   ├── openclaw-core/      Platform abstraction, gateway URL resolution, shared types
│   ├── openclaw-db/        Postgres 16 + pgvector schema, migrations, connection pool
│   ├── openclaw-ai-router/ Multi-provider AI router (Anthropic / OpenAI / Google)
│   ├── openclaw-gateway-client/  WebSocket gateway client
│   ├── openclaw-ui/        Shared React component library
│   ├── openclaw-orchestrator/  Agent orchestration hooks and session overlay
│   ├── fireflies-tools/    Fireflies meeting integration
│   └── gmail-tools/        Gmail tooling
├── agents/
│   ├── configs/            Per-agent JSON configs (model, provider, capabilities)
│   └── profiles/           Per-agent DIRECTIVES, MEMORY, SOUL files
├── dashboard/              Next.js PWA — kanban board, agent roster, chat rail
├── docs/                   Engineering policies, specs, research
└── scripts/                Automation and verification scripts
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 10+
- Postgres 16+ with the `pgvector` and `pgcrypto` extensions enabled

### Install

```bash
pnpm install
```

### Development

```bash
# Electron desktop shell
pnpm dev:shell

# Next.js dashboard
pnpm dev:dashboard

# Mobile PWA (port 3002)
cd apps/openclaw-shell && pnpm dev:mobile
```

### Build

```bash
# Build all packages and apps
pnpm build

# Build Electron shell only (produces DMG on macOS)
cd apps/openclaw-shell && pnpm build
```

### Tests

```bash
# Run all tests across the monorepo
pnpm test

# Run tests in a specific package
cd apps/openclaw-shell && pnpm test
```

### Type Check

```bash
pnpm typecheck
```

## Architecture

### Electron Shell (`apps/openclaw-shell`)

Built with Electron 35, React 19, Vite (via electron-vite), Zustand 5, and Tailwind CSS 4.

- **Main process** — Node.js, full filesystem/network access, IPC hub
- **Renderer process** — React 19 SPA, communicates with main via contextBridge IPC
- **Preload** — exposes `window.electronAPI` to the renderer
- **Mobile PWA** — separate Vite build (`vite.config.mobile.ts`) for iOS/Android

### Packages

| Package | Purpose |
|---------|---------|
| `openclaw-core` | Platform detection (`detectPlatform`), gateway URL resolution (`resolveGatewayUrl`), shared TypeScript types |
| `openclaw-db` | Postgres 16 connection pool (`getPool`), transaction helper (`withTransaction`), migration runner |
| `openclaw-ai-router` | Routes chat requests to Anthropic / OpenAI / Google; handles rate-limit fallback |
| `openclaw-gateway-client` | WebSocket client for the local gateway (port 18789) or Cloudflare tunnel |
| `openclaw-ui` | Shared React components consumed by both shell and dashboard |
| `openclaw-orchestrator` | Session bootstrap overlay, agent hook handlers |

### AI Agents (16 total)

Three provider lanes:

| Provider | Models | Agents |
|----------|--------|--------|
| Anthropic | claude-sonnet-4.6, claude-opus-4.6 | CD (orchestrator), Themis (verifier), Hypatia (research), Socrates, Boswell, Vesta |
| OpenAI | gpt-5, gpt-5-mini, o3 | Vulcan (build), Iris, Hermes, Ada (notes) |
| Google | gemini-2.5-pro, gemini-2.5-flash | Kronos (calendar), Marcus (finance), Argus (ops), Karoline (comms), Data, Documents |

Routing is handled by `packages/openclaw-ai-router`. Each agent config lives in `agents/configs/<slug>.json` and specifies `defaultModel`, `fallbackModel`, `modelProvider`, `reasoningLevel`, and subagent depth.

### Gateway

The local gateway runs on `ws://127.0.0.1:18789`. When remote or on mobile the shell tunnels via Cloudflare to `wss://gateway.openclaw.io`. URL resolution is handled by `resolveGatewayUrl` in `openclaw-core`.

### Database

Postgres 16 with pgvector for semantic embeddings. Schema managed via numbered SQL migrations in `packages/openclaw-db/src/migrations/`. See `packages/openclaw-db/SCHEMA.md` for full table reference.

## Environment Setup

Create a `.env` file in the repo root (or in `apps/openclaw-shell/` for shell-only dev):

```env
# Database
DATABASE_URL=postgresql://openclaw:password@localhost:5432/openclaw
DB_HOST=localhost
DB_PORT=5432
DB_NAME=openclaw
DB_USER=openclaw
DB_PASSWORD=your_password
DB_SSL=false

# Vault
VAULT_MASTER_KEY=your_vault_master_key

# AI Providers
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...

# Gateway
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789   # optional override

# Google Workspace
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# GitHub
GITHUB_TOKEN=ghp_...
```

## License

Private — all rights reserved.
