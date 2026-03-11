# PROJECT_REGISTRY.md

## Purpose
Shared registry of the projects/tools CD should know about, reference, and manage with Christian.

This should become the canonical high-level list for:
- what exists
- where it lives
- what tool access exists
- what needs deeper mapping
- what active plans/tasks belong to each project

---

## Tool visibility corrections

### Codex
- **Visible:** yes
- **Path:** `/opt/homebrew/bin/codex`
- Earlier inventory was incomplete/wrong on this point.

### Gemini CLI
- **Visible:** yes
- **Path:** `/opt/homebrew/bin/gemini`

### AntiGravity IDE CLI
- **Visible:** yes, but not currently on PATH by default in the main shell inventory
- **Observed path:** `/Users/cderamos/.antigravity/antigravity/bin/antigravity`
- Related local state also exists under:
  - `/Users/cderamos/.antigravity`
  - `/Volumes/Storage/antigravity`

### GitHub org visibility
- `gh` auth indicates active org membership in **VisualGraphxLLC** with role `admin`
- org repos should be queried explicitly by org name, not inferred from personal repo listing only

---

## Project list

### 1) OpenClaw
- **Role:** assistant/control/dashboard ecosystem
- **Primary path:** `/Volumes/Storage/OpenClaw`
- **Runtime workspace:** `/Users/cderamos/.openclaw/workspace`
- **Status:** active / mapped
- **Key docs:** learning system, dashboard plans, dev control map, inventories
- **Next:** wire learning + dev-control inventories into dashboard payloads

### 2) Antigravity
- **Role:** Gemini IDE / related operating environment and associated project surface
- **Observed paths:**
  - `/Volumes/Storage/antigravity`
  - `/Users/cderamos/antigravity`
  - `/Users/cderamos/.antigravity`
- **CLI path observed:** `/Users/cderamos/.antigravity/antigravity/bin/antigravity`
- **Status:** partially mapped / canonical root still needs confirmation
- **Next:** determine which antigravity path is canonical for actual development/control

### 3) Clarity
- **Role:** internal product/framework initiative
- **GitHub repo:** `cderamos-2ct/clarity`
- **Status:** visible in GitHub; internal understanding work in progress through source docs
- **Next:** map local/remote repo roots and connect to understanding/experiment docs

### 4) Clarity Dashboard
- **Role:** dashboard/UI related to Clarity
- **GitHub repo:** `cderamos-2ct/clarity-dashboard`
- **Status:** visible in GitHub
- **Next:** identify local/remote working root and build/test conventions

### 5) ShopVox Extractor
- **Role:** extraction-related project
- **GitHub repo:** `cderamos-2ct/shopvox-extractor`
- **Local candidate path:** `/Volumes/Storage/ShopVox Account Extraction`
- **Status:** partially mapped
- **Next:** confirm whether local folder and GitHub repo correspond directly

### 6) GraphXDash
- **Role:** project on dev server
- **Remote path:** `/home/chris/projects/GraphXDash`
- **Markers:** `.git`, `package.json`, `docker-compose.yml`
- **Status:** remotely visible, not yet deeply mapped
- **Next:** inventory build/test/run conventions on the dev server

### 7) dev-harness-core
- **Role:** project on dev server
- **Remote path:** `/home/chris/dev-harness-core`
- **Markers:** `.git`
- **Status:** remotely visible, not yet deeply mapped
- **Next:** inspect repo purpose + conventions

### 8) antigravity-agent
- **Role:** project on dev server
- **Remote path:** `/home/chris/antigravity-agent`
- **Markers:** `requirements.txt`
- **Status:** remotely visible, not yet deeply mapped
- **Next:** inspect structure, git status, and role in the broader ecosystem

### 9) mockup-generator
- **Role:** local project candidate
- **Local path:** `/Volumes/Storage/mockup-generator`
- **Markers:** `package.json`, `docker-compose.yml`
- **Status:** visible locally
- **Next:** determine whether this is active/current and who owns it

---

## Shared management model
For each project we should eventually track:
- canonical path
- git remote / repo mapping
- primary tool(s)
- build/test/run commands
- active tasks
- active plans
- shareable outputs
- whether CD can operate autonomously there

---

## Immediate next projects to map deeper
1. Antigravity (canonical root + CLI behavior)
2. GraphXDash (server-side conventions)
3. Clarity / clarity-dashboard (local/remote roots + repo mapping)
4. ShopVox extractor (repo/local path confirmation)
