# .antigravity/ Refresh Plan (Revised)

## Context
The `.antigravity/` directory is NOT a stale artifact to be scattered — it's the **canonical meta-layer** for agent orchestration. The `openclaw-orchestrator/` plugin, `dashboard/`, `server.py`, and `heartbeat.py` all read from it. The structure is correct. The **content** is outdated.

The core problem: `.antigravity/agents/` has 9 lane-based configs (cd, comms, build, etc.) but the real roster is **15 named agents** (Karoline, Vulcan, Calliope, Pythia, etc.). The configs, profiles, tasks, and governance docs need to be brought current — not relocated.

## Phase 1: Agent Registry Reconciliation (Critical)

The 9 old lane-based JSON configs need to become 15 named-agent configs:

| Old Config | Becomes | Notes |
|-----------|---------|-------|
| cd.json | cd.json | Keep — already correct |
| comms.json | karoline.json | Rename + add named identity |
| build.json | vulcan.json | Rename + add named identity |
| calendar.json | kronos.json | Rename + add named identity |
| finance.json | marcus.json | Rename + add named identity |
| notes.json | ada.json | Rename + add named identity |
| ops.json | argus.json | Rename + add named identity |
| research.json | hypatia.json | Rename + add named identity |
| verifier.json | themis.json | Rename + add named identity |
| *(new)* | iris.json | Channels — new config needed |
| *(new)* | hermes.json | Relationships — new config needed |
| *(new)* | vesta.json | Personal/Family — new config needed |
| *(new)* | socrates.json | Learning — new config needed |
| documents.json | calliope.json | Rename (just created) |
| data.json | pythia.json | Rename (just created) |

Profile directories also need renaming:
- `profiles/comms/` → `profiles/karoline/`
- `profiles/build/` → `profiles/vulcan/`
- etc.

### Validation
- Update `openclaw-orchestrator/` to read new filenames
- Update `dashboard/` agent card rendering
- Update `server.py` / `heartbeat.py` references
- Update all `roleFile` and `memoryPaths` in JSON configs

## Phase 2: Task Audit

48 RUN-* tasks likely have significant staleness. Action:
1. Audit each task — mark stale ones DON-* (done/abandoned)
2. Re-assign active tasks to named agents (not lane names)
3. Keep the task file format and location (it works)

## Phase 3: Governance Refresh

The governance docs (AGENT_OPERATING_MODEL, RULES, AUTONOMY_CONTRACT, VALIDATION_MATRIX) are still valid in concept but reference the old 9-agent model. Update to reflect:
- 15-agent roster with names
- Model routing for all 15 (4 providers, 7 tiers)
- Cross-agent dispatch patterns (Calliope/Pythia as shared specialists)

Consolidate duplicates:
- `agent-team/roles.yaml` + `rules/model-routing-policy.json` → single `agent-team/config.yaml`

## Phase 4: Cleanup Stale Content

Delete:
- Stub files: PLAN.md, STATE.md, SKILLS.md (empty/placeholder)
- `run-state.json` (stale since March 6)
- `memory.md` stub (references non-existent directory)
- `DON-*` tasks older than 2 weeks (archive, not delete)
- `BLK-*` tasks (review first — likely permanently stale)

## What Does NOT Change
- `.antigravity/` stays as the canonical orchestration layer
- Directory structure stays (agents/, tasks/, details/, agent-team/)
- Profile format stays (SOUL, DIRECTIVES, HEARTBEAT, MEMORY per agent)
- Task file format stays (markdown with status prefixes)
- All downstream consumers keep reading from `.antigravity/`

## Execution Order
1. Phase 1 first — everything downstream depends on correct agent configs
2. Phase 3 in parallel with Phase 1 (governance docs are independent)
3. Phase 2 after Phase 1 (tasks reference agent IDs)
4. Phase 4 last (cleanup after everything is current)

## Status: PLANNED — ready for execution when Christian approves
