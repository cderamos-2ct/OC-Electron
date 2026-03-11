# Agent ↔ Dashboard Sync Plan

## Goal

Make every chief-of-staff session and the dashboard read the same durable org model so agent identity, lane ownership, and runtime visibility stop drifting.

## Canonical layers

1. **Registry / desired state**
   - `.antigravity/agents/*.json`
2. **Observed runtime state**
   - `.antigravity/runtime/sessions.json`
3. **Assignment state**
   - `.antigravity/tasks/items/*.md`
   - generated view: `.antigravity/tasks/index.json`

## Join model

For each dashboard card / agent lane:
- load registry entry by `id`
- join runtime state by `agent id`
- join active task ownership by `owner_agent`

## Health model

Dashboard and chief-of-staff should compute one of:
- `healthy` — desired + observed aligned
- `idle` — alive, no task assigned
- `busy` — alive, task assigned
- `missing` — registry expects availability/running but no live session
- `drifted` — live session label/model/role differs from registry intent
- `orphaned` — runtime session exists with no registry entry

## Hiring workflow

Permanent hire:
1. create `agents/<id>.json`
2. create `agents/profiles/<id>/DIRECTIVES.md`
3. assign stable `sessionLabel`
4. decide `startupPolicy` and `desiredStatus`
5. reconcile runtime state
6. surface new dashboard card

Temporary hire:
1. create task-scoped id
2. assign temporary session label
3. attach task owner and lifecycle
4. archive/retire after completion

## Session startup behavior for CD

On startup, chief-of-staff should:
1. read `.antigravity/agents/*.json`
2. read `.antigravity/runtime/sessions.json`
3. read `.antigravity/tasks/index.json`
4. reconcile desired vs observed vs assigned
5. report org status in one compact summary

## Next implementation step

Add a reconciler that updates `.antigravity/runtime/sessions.json` from live `sessions_list` results using `sessionLabel` as the matching key.
