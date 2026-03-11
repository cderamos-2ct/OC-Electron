# AntiGravity Docs

Reference materials, archived versions, and research artifacts.

## Folder Structure

```
docs/
├── README.md                    ← You are here
│
├── archive/                     ← Rescued v2/v3 builds (previously in ~/Trash)
│   ├── server_v3.py             ← v3 FastAPI backend (884 lines) — reference for missing features
│   ├── index_v3.html            ← v3 PWA frontend (910 lines) — reference for missing UI
│   ├── server_v2.py             ← v2 backend iteration
│   ├── index_v2.html            ← v2 frontend iteration
│   └── RECOVERY_CONTEXT.md     ← Handoff notes from the v3 build session
│
├── research/                    ← Investigation artifacts
│   └── antigravity-teams-research.jsx  ← Microsoft Teams LevelDB integration research (39KB)
│
├── antigravity-agent/           ← Old standalone agent (pre-command-center era)
│   ├── bot.py                   ← Original bot logic
│   ├── heartbeat.py             ← Legacy heartbeat monitor
│   ├── dashboard_server.py      ← v1 dashboard server
│   ├── dashboard_index.html     ← v1 dashboard UI
│   ├── data/memory.db           ← Old memory SQLite DB
│   ├── memory/relationships.md  ← Structured relationship data (imported to main DB)
│   └── scripts/                 ← Setup/install/uninstall scripts
│
├── AI-wingman/                  ← Original project (Telegram-based AI wingman)
│   └── gmail-automation/        ← Gmail automation toolkit (original)
│
└── antigravity → ../            ← Symlink to current project root (for cross-reference)
```

## Current Production Files

The **live production code** lives at `/Volumes/Storage/antigravity/`:
- `server.py` — Main FastAPI backend (port 8420)
- `static/index.html` — React PWA frontend
- `data/antigravity.db` — Primary SQLite database
- `requirements.txt` — Python dependencies

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
