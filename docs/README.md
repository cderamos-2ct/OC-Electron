# OpenClaw Docs

Reference materials, durable project docs, and research artifacts.

## Folder Structure

```text
docs/
├── README.md                    ← You are here
├── DOCS_INDEX.md                ← Canonical docs index
├── engineering/                 ← Repo policy, structure, and SSOT docs
├── operations/                  ← Operator runbooks and environment inventories
├── registry/                    ← Project registry and project cards
├── research/                    ← Investigation artifacts
├── dashboard/                   ← Dashboard specs and implementation notes
├── integrations/                ← External system integration plans
├── learning/                    ← Learning-system docs and backlogs
├── phases/                      ← Phase plans and roadmap docs
├── plans/                       ← Active planning docs
├── specs/                       ← Product and integration specs
├── context/                     ← Stable relationship/use-case context
├── ui-ux/                       ← UX workflow notes
├── understanding/               ← Domain understanding docs
└── allhands_prep/               ← All-hands prep materials
```

Historical/imported material now lives under `/Volumes/Storage/OpenClaw/legacy/`
instead of `docs/`, including:

- `legacy/imported/archive/`
- `legacy/imported/antigravity-agent/`
- `legacy/imported/AI-wingman/`
- `legacy/links/`

## Current Production Paths

The live OpenClaw code lives at `/Volumes/Storage/OpenClaw/`:
- `apps/runtime/server.py` — Main FastAPI backend (port 8420)
- `apps/runtime/heartbeat.py` — Heartbeat monitor
- `apps/runtime/runtime_directives.py` — Runtime directive surface
- `apps/runtime/requirements.txt` — Python dependencies
- `dashboard/` — Dashboard frontend/PWA shell
- `packages/openclaw-orchestrator/` — Repo-local orchestration plugin package
- `domains/finance/` — Finance domain workspace

## V3 Features Merged Into Production

| Feature | Status |
|---|---|
| RAG document upload + FTS5 search | ✅ Merged |
| Knowledge/Memory viewer with CRUD | ✅ Merged |
| Morning Brief auto-show | ✅ Merged |
| Tool execute endpoint | ✅ Merged |
| AddToolModal in ToolsPanel | ✅ Merged |
| Real Claude CLI heartbeat ping | ✅ Merged |
| Teams LevelDB integration | ⏳ Research only (see research/) |
