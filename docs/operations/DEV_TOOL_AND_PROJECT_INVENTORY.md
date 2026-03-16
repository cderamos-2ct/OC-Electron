# Dev Tool and Project Inventory

## Snapshot date
2026-03-08

## 1) This Mac — installed/visible tools

### Confirmed on PATH
- `claude` → `/Users/cderamos/.local/bin/claude`
- `gemini` → `/opt/homebrew/bin/gemini`
- `gh` → `/opt/homebrew/bin/gh`
- `git` → `/usr/bin/git`
- `python3` → `/usr/bin/python3`
- `node` → `/opt/homebrew/bin/node`
- `npm` → `/opt/homebrew/bin/npm`
- `docker` → `/opt/homebrew/bin/docker`
- `docker-compose` → `/opt/homebrew/bin/docker-compose`
- `ssh` → `/usr/bin/ssh`
- `openclaw` → `/opt/homebrew/bin/openclaw`

### Confirmed versions
- Claude Code: `2.1.62`
- Gemini CLI: `0.32.1`
- GitHub CLI: `2.86.0`
- OpenClaw: `2026.3.7`

### Not currently on PATH
- `codex`
- `opencode`
- `pi`
- `pnpm`
- `code`

## 2) This Mac — visible local project roots

### `/Volumes/Storage/OpenClaw`
Observed as the real OpenClaw project/home base.

Markers found:
- `apps/runtime/requirements.txt`
- `packages/openclaw-orchestrator/package.json`
- `legacy/imported/antigravity-agent/requirements.txt`

### `/Volumes/Storage/antigravity`
Exists, but the quick local scan did not surface standard repo markers at shallow depth.
Needs deeper canonical-path/repo audit before treating it as a fully mapped dev root.

### Other visible local project-ish folders
- `/Volumes/Storage/mockup-generator` → `package.json`, `docker-compose.yml`
- `/Volumes/Storage/ShopVox Account Extraction` → `package.json`

## 3) GitHub — authenticated visibility

### GitHub auth
- `gh` authenticated as: `cderamos-2ct`
- scopes include: `repo`, `workflow`, `read:org`, `gist`

### Repos currently returned by `gh repo list cderamos-2ct`
- `cderamos-2ct/shopvox-extractor` — public — updated 2026-03-04
- `cderamos-2ct/clarity-dashboard` — private — updated 2026-02-27
- `cderamos-2ct/clarity` — private — updated 2026-01-09

## 4) Local dev server — `chris@192.168.1.170`

### Host info
- host: `dockerserver`
- home: `/home/chris`

### Visible top-level development surfaces
- `antigravity-agent/`
- `dev-harness-core/`
- `projects/`
- `docker/`
- `.claude/`
- `.codex/`
- `.gemini/`

### Project markers found on server
- `/home/chris/dev-harness-core/.git`
- `/home/chris/antigravity-agent/requirements.txt`
- `/home/chris/projects/GraphXDash/.git`
- `/home/chris/projects/GraphXDash/package.json`
- `/home/chris/projects/GraphXDash/docker-compose.yml`
- `/home/chris/docker/mariadb/docker-compose.yml`
- `/home/chris/docker/cloudflared/docker-compose.yml`
- `/home/chris/docker/redis/docker-compose.yml`
- `/home/chris/docker/postgres/docker-compose.yml`

### Tool visibility on server (from quick command-path check)
- `git` → present (`/usr/bin/git`)
- `docker` → present (`/usr/bin/docker`)
- `claude` → no path returned in the quick check
- `codex` → no path returned in the quick check
- `gemini` → no path returned in the quick check
- `gh` → no path returned in the quick check

### Important note
The server clearly has `.claude/`, `.codex/`, and `.gemini/` state directories, which suggests tooling/config may exist there even though the binaries were not returned on PATH in the quick command check. This needs a deeper server-side PATH/install audit before claiming exact tool availability there.

## 5) High-confidence conclusions
- On this Mac, **Claude Code + Gemini CLI + GitHub CLI are definitely available now**.
- On this Mac, **Codex is not currently callable by name**.
- GitHub visibility is live through `gh` and authenticated.
- The remote dev server has real project roots and dev surfaces, especially `antigravity-agent`, `dev-harness-core`, and `projects/GraphXDash`.
- The remote server likely has some Claude/Codex/Gemini state/config, but tool-path availability there still needs a cleaner audit.

## 6) Immediate next audit targets
1. identify the canonical antigravity repo/root locally and on the server
2. verify whether Codex exists off-PATH on this Mac
3. verify tool install/PATH state on the dev server more cleanly
4. add build/test/run conventions for the known project roots
5. decide which roots CD may operate in autonomously
