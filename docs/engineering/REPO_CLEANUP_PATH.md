# Repo Cleanup Path

## Goal

Turn `/Volumes/Storage/OpenClaw` into a maintainable single-repo system without
breaking the live dashboard/runtime again.

## Main problems observed

1. The repo mixes source, policy, durable docs, imported legacy projects, and
   runtime exhaust.
2. The runtime app has moved under `apps/runtime/`, but some documentation and
   assumptions still point at the former top-level files (`server.py`,
   `heartbeat.py`, `runtime_directives.py`).
3. `docs/` contains imported legacy projects and symlinked external content that
   do not belong in canonical documentation.
4. `.antigravity/` contains both canonical policy and generated/runtime mirrors.
5. The finance workspace now lives under `domains/finance/`, and mutable domain
   data needs to stay separate from tracked source/docs.
6. The live dashboard was previously served from a different repo, which created
   wrong-repo edits.

## Phase 1: Lock the boundaries now

Do now:

- keep `dashboard/` as the only live dashboard code root
- keep `.antigravity/agents/*.json` and tracked profile docs as canonical org state
- keep `.antigravity/tasks/items/*.md` as canonical task state
- keep `docs/` as canonical durable docs only
- keep runtime chatter ignored

Acceptance:

- engineers know which root is live
- edits land in one repo
- rollback-critical agent files are tracked

## Phase 2: Remove obvious repo pollution

Status: completed for the first pass.

Move or archive out of canonical docs:

- `docs/AI-wingman/` -> `legacy/imported/AI-wingman/`
- `docs/antigravity-agent/` -> `legacy/imported/antigravity-agent/`
- `docs/archive/` -> `legacy/imported/archive/`
- `docs/antigravity` symlink to external repo -> `legacy/links/antigravity`

Current result:

- `docs/` contains durable docs only
- legacy/imported projects live under dedicated `legacy/` boundaries

## Phase 3: Create real app/package boundaries

Status: partially completed.

Completed moves:

- former root runtime files → `apps/runtime/`
- `openclaw-orchestrator/` → `packages/openclaw-orchestrator/`
- `Finance/` → `domains/finance/`

Remaining coordinated moves:

- `.antigravity/` → `system/.antigravity/` only if all references are updated together

Do not do the remaining moves incrementally without coordinated service/import
updates.

## Phase 4: Reduce duplicate docs

Current duplication exists across:

- `docs/dashboard/`
- `docs/specs/dashboard/`
- `docs/operations/`
- `docs/integrations/`
- `docs/phases/`

Policy:

- one canonical home per document type
- phase docs should link to specs, not duplicate them
- operations docs should reference specs/plans, not restate them

## Phase 5: Separate source from generated views

Keep generated outputs out of tracked structure when possible:

- task board generated views
- runtime mirrors
- evidence snapshots
- domain workspace runtime DBs / exports / logs

If a generated file must remain tracked, document why.

## Recommendation

Next structural pass should focus on:

1. removing stale docs references to the old root paths
2. tightening ignore rules for mutable domain/runtime outputs
3. reducing duplicate docs by choosing canonical homes and demoting mirrors/history copies
