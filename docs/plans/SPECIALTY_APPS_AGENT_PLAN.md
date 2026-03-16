# Specialty Apps Agent Plan

## Context
Christian manages several specialized business applications for Visual Graphx print production:
- **OnPrintShop** — web-to-print storefront / order management
- **OneVision** — prepress automation / preflight / color management
- Other vendor tools TBD (likely prepress, fulfillment, shipping)

## Recommendation: Single "Forge" Agent, Not Per-App Agents

### Why NOT one agent per app
- **Agent sprawl** — goes from 15 to 20+ fast, each needing maintenance and calibration
- **Low API coverage** — most print production tools are web-based without rich APIs; interactions would be limited to data prep, export formatting, and status interpretation
- **Burst usage patterns** — unlike email (constant) or calendar (daily), these apps are used in production workflow bursts, not continuously

### Proposed: Agent #16 — Hephaestus (Print Production / Vendor Tools)
Named for the Greek god of the forge and craftsmanship — fitting for print production tooling.

| Field | Value |
|-------|-------|
| Name | Hephaestus |
| Emoji | ⚒️ |
| Lane | production-tools |
| Model | Sonnet 4.6 (practical, task-oriented) |
| Fallback | Haiku 4.5 |

#### Responsibilities
- Know what each app does and when Christian uses it
- Prepare data FOR those apps (job tickets, preflight specs, order exports, imposition layouts)
- Interpret data FROM those apps (job status, production reports, error logs)
- Bridge between OpenClaw agents and vendor tool workflows
- Track login/access patterns and credential state

#### How it grows
As individual apps get APIs or MCP servers, Hephaestus gains tools rather than spawning new agents:
- OnPrintShop API → order management tools
- OneVision API → preflight/color tools
- Shipping API → fulfillment tracking tools

#### Cross-agent coordination
- **Marcus** (Finance) — production costs, job profitability
- **Argus** (Ops) — production queue health, bottlenecks
- **Pythia** (Data) — production reports, metrics exports
- **Karoline** (Comms) — customer order status inquiries

### When to revisit this decision
Create a dedicated per-app agent ONLY if:
1. The app gets a rich API with 10+ endpoints
2. The interaction frequency becomes daily/continuous
3. The domain knowledge required is deep enough to warrant isolation

### Timeline
- **Phase 1** (now): Document what apps exist and how Christian uses them
- **Phase 2** (when APIs available): Build Hephaestus with first tool integrations
- **Phase 3** (ongoing): Add tools as vendor APIs/MCP servers become available

## Status: PLANNED — awaiting API availability assessment
