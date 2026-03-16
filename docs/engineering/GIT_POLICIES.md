# Git Policies

## Repository model

`/Volumes/Storage/OpenClaw` is now the canonical Git repo for the unified
system.

The old dashboard repo is no longer the live service root and should be treated
as a fallback/archive history source until explicitly retired.

## Branch rules

- default branch: `main`
- working branches must use the `crd/` prefix when created for feature work
- do not create ad hoc nested repos inside the canonical repo

## Commit rules

Each commit must preserve one of these boundaries:

1. dashboard UI/server change
2. orchestration/system policy change
3. docs/policy change
4. runtime script/service change

Avoid commits that mix all four unless the change truly spans the whole stack.

## Never commit

- `.env` and local secrets
- databases
- logs
- `.openclaw/`, `.omx/`, `.omc/`
- generated runtime mirrors
- task board generated views
- agent mailboxes and artifact outputs
- imported local credential dumps or external scratch projects

## Before committing

Minimum checks:

- repo root is `/Volumes/Storage/OpenClaw`
- live service path matches the repo path you edited
- generated/runtime junk is not staged
- dashboard changes build successfully when applicable
- task/doc changes point at the correct canonical files

## Commit message policy

Use short, direct summaries:

- `dashboard: fix mobile chat composer`
- `runtime: harden device auto-approval`
- `system: add coworker roster sync`
- `docs: define repo structure policy`

## Reorg policy

No broad directory moves directly on a dirty feature branch.

Structural moves should happen in dedicated commits with:

- path migration plan
- service-path update
- verification steps
- rollback path
