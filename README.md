# OpenClaw

Personal AI operations platform — 14 autonomous agents orchestrated through a unified dashboard, managing communications, scheduling, finance, research, and day-to-day workflows.

## Architecture

```
OpenClaw/
├── dashboard/          Next.js PWA — kanban board, agent roster, chat rail
├── apps/
│   ├── openclaw-shell/  Electron desktop shell (WIP)
│   └── runtime/         FastAPI backend (port 8420) — heartbeat, directives
├── packages/
│   ├── openclaw-orchestrator/  Agent orchestration hooks & overlay
│   ├── fireflies-tools/        Fireflies meeting integration
│   └── gmail-tools/            Gmail tooling (legacy — use GWS CLI)
├── domains/
│   └── finance/         Finance domain workspace
├── mockups/             Interactive HTML/CSS prototypes (SPA)
├── scripts/             Automation & verification scripts
├── docs/                Engineering policies, specs, research
└── .antigravity/        Agent configs, profiles, task system
```

## Agents

| Agent | Role | Domain |
|-------|------|--------|
| **CD** | Command & direction | Executive / orchestration |
| **Karoline** | Communications lead | Drafts, email, messaging |
| **Iris** | Attention & triage | Notifications, inbox routing |
| **Hermes** | Delivery & dispatch | Outbound comms, sends |
| **Kronos** (calendar) | Schedule management | Calendar, meetings, availability |
| **Marcus** (finance) | Financial operations | Invoicing, expenses, tracking |
| **Ada** (notes) | Knowledge & memory | Notes, documents, research capture |
| **Vesta** | Home & environment | Personal ops, routines |
| **Boswell** | Chronicle & records | Activity logs, history |
| **Vulcan** (build) | Engineering & build | Code, CI/CD, infrastructure |
| **Themis** (verifier) | Quality & verification | Reviews, acceptance, compliance |
| **Hypatia** (research) | Research & analysis | Deep dives, comparisons, reports |
| **Socrates** | Strategy & reasoning | Decision support, trade-offs |
| **Argus** (ops) | Operations & monitoring | System health, task routing |

## Dashboard

Next.js app with:
- **Kanban board** — tasks grouped by Needs You / Running / Blocked
- **Task detail view** — full description, acceptance criteria, notes, status controls
- **Agent roster** — live status cards for all 14 agents
- **Chat rail** — persistent conversation thread with CD
- **Gateway indicator** — real-time backend connection status

```bash
cd dashboard && npm run dev    # http://localhost:3000
```

## Runtime

FastAPI server providing heartbeat monitoring, runtime directives, and agent coordination.

```bash
cd apps/runtime && pip install -r requirements.txt && python server.py
```

## Mockups

Interactive SPA prototypes at `mockups/index.html` — responsive for desktop, tablet, and mobile. Covers morning brief, task cards, draft review with redraft chat, and agent roster views.

## Stack

- **Frontend**: Next.js 14, React, Tailwind CSS, TypeScript
- **Backend**: Python / FastAPI
- **Desktop**: Electron (planned)
- **Agents**: Claude Code + AntiGravity orchestration layer
- **Integrations**: Google Workspace (GWS CLI), Fireflies, Figma, Supabase, Vercel

## License

Private — all rights reserved.
