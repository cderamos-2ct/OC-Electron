# Filesystem Structure Policy

## Purpose

This repo is the canonical home for the unified OpenClaw system running from
`/Volumes/Storage/OpenClaw`.

The structure must keep four concerns distinct:

1. product code
2. orchestration / system policy
3. durable documentation
4. runtime state and generated artifacts

If those concerns mix, the repo becomes impossible to reason about and agents
start editing the wrong surface.

## Current canonical roots

- `dashboard/`
  Live dashboard application and PWA shell.
- `apps/runtime/`
  Canonical home of the Python runtime app (`apps/runtime/server.py`,
  `apps/runtime/heartbeat.py`, `apps/runtime/runtime_directives.py`, and
  runtime-specific dependencies).
- `.antigravity/`
  Canonical orchestration state, agent registry, tasks, and operating rules.
- `docs/`
  Durable docs, plans, context, specs, and operations notes.
- `scripts/`
  Shared operational and verification scripts.
- `packages/openclaw-orchestrator/`
  Orchestrator package/plugin code.
- `domains/finance/`
  Canonical finance domain workspace.

## Required directory roles

### `dashboard/`

Only dashboard UI/server code belongs here:

- `app/`
- `components/`
- `contexts/`
- `hooks/`
- `lib/`
- `public/`
- `server.cjs`
- package manifests / TS config

Do not put durable docs, runtime memory, or imported legacy projects here.

`dashboard/` is a sanctioned top-level app root. Treat it as permanent unless a
future migration is justified by a real operational need, not aesthetics.

### `.antigravity/`

This is the system-of-record for orchestration.

Track here:

- agent definitions
- tracked agent profile source files
- task items
- orchestration rules
- routing policy

Do not treat generated views or live runtime mirrors as canonical.

### `docs/`

This is the canonical durable documentation tree.

Track here:

- context
- operations
- engineering policy
- specs
- plans
- registries
- learning artifacts

Do not keep imported legacy apps or local scratch projects under `docs/`.

### `scripts/`

Track reusable scripts only:

- verification
- reconciliation
- migration helpers
- operator helpers

Do not store credentials, logs, temp output, or one-off exports here.

### `packages/openclaw-orchestrator/`

Treat this as a package subtree.

Only package code and manifests belong here.

### `domains/finance/`

Treat this as a formal domain workspace.

Track here:

- finance-specific docs and notes
- finance utilities and templates
- domain-scoped workflow instructions

Ignore mutable finance runtime state and generated outputs:

- `finance.db*`
- `Documents/`
- `Inbox/`
- `Logs/`
- `Processed/`
- `Review/`
- `Exports/`

### Root

The root should eventually contain only:

- high-level repo policy / identity files
- top-level manifests
- top-level apps/packages/docs/system directories
- intentionally promoted domain workspaces

The runtime app now lives under `apps/runtime/`, and the finance workspace now
lives under `domains/finance/`. Keep those boundaries intact.

## Forbidden structure patterns

- active code duplicated across two repos
- runtime state committed as source
- imported legacy projects mixed into canonical docs
- symlinked external repos under `docs/` presented as first-class repo content
- app code and operator memory in the same subtree

## Immediate cleanup rules

- Keep `dashboard/` as the live dashboard root until a deliberate path migration.
- Keep `apps/runtime/` as the only canonical Python runtime app root.
- Keep `packages/openclaw-orchestrator/` as the only canonical orchestrator package root.
- Keep `domains/finance/` as the only canonical finance domain root.
- Keep `.antigravity/tasks/items/*.md` as the only canonical task ledger.
- Keep agent profile source files tracked:
  - `SOUL.md`
  - `MEMORY.md`
  - `HEARTBEAT.md`
  - `DIRECTIVES.md`
- Ignore mailbox/artifact churn:
  - `INBOX.jsonl`
  - `OUTBOX.jsonl`
  - `artifacts/`

## Current structure checkpoint

Current layout after the runtime/package/domain moves:

```text
/Volumes/Storage/OpenClaw
├── apps/
│   └── runtime/
├── dashboard/
├── domains/
│   └── finance/
├── packages/
│   └── openclaw-orchestrator/
├── scripts/
├── docs/
├── .antigravity/
└── AGENTS.md / repo policies / top-level manifests
```

Do not move `.antigravity/` piecemeal. If `dashboard/` ever changes later,
service paths, imports, and launchd entries must migrate together.
