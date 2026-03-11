# Storage-First Operating Plan

## Purpose
Fundamentally change CD's file/storage behavior so the small internal drive is not used as the default long-term home.

## Core rule
- Runtime workspace (`/Users/cderamos/.openclaw/workspace`) = lean execution layer
- Storage-backed OpenClaw home (`/Volumes/Storage/OpenClaw`) = primary durable home

## What stays in runtime workspace
Only what is needed for:
- active execution
- current-session control
- memory continuity files used by OpenClaw runtime
- lightweight working files that are actively being edited

## What belongs on Storage
- durable docs
- plans
- phases
- specs
- roadmaps
- integration docs
- project registry/control docs
- learning artifacts
- understanding memos
- operational references/runbooks/checklists
- dashboard development artifacts that matter beyond the current session

## Practical implication
When in doubt:
- if it is durable and strategic, place it in `/Volumes/Storage/OpenClaw/docs/...`
- if it is transient and execution-local, it can live in runtime workspace

## Next structural shift
The docs tree under `/Volumes/Storage/OpenClaw/docs` should become the canonical source for durable artifacts, organized around:
- `plans/`
- `phases/`
- `specs/`
- `ops/`
- `integrations/`
- `learning/`
- `context/`
- `understanding/`
- `registry/`
- `ui-ux/`

## Rule
Do not optimize for convenience at the cost of filling the internal drive with durable project state.
