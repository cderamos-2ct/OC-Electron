# Linear AI Assignment — Manual Verification Playbook

> Run this playbook whenever you suspect the Linear-driven AI dispatch system is broken,
> after changing `config.json` or webhook settings, or before a milestone cutover.

---

## 1. Pre-Flight Checks

### 1a. Router health

```bash
curl -sf http://localhost:9786/health && echo "OK" || echo "FAIL — router not running"
```

Expected: `OK`

If it fails:
```bash
cd apps/linear-agent-router
./start.sh
```

### 1b. Cloudflare tunnel active

```bash
cat apps/linear-agent-router/logs/tunnel.log | grep trycloudflare
```

Expected: a `https://<slug>.trycloudflare.com` URL.

If missing, restart via `./start.sh` and wait up to 15 seconds for the URL to appear.

### 1c. Linear webhook points to tunnel URL

1. Open **Linear → Settings → API → Webhooks**.
2. Confirm the webhook URL matches the tunnel URL from step 1b.
3. Confirm **Resource types** includes **Issues**.
4. Confirm the webhook is **enabled** (not paused).

### 1d. Environment variables present

```bash
grep -q LINEAR_WEBHOOK_SECRET apps/linear-agent-router/.env \
  && echo "Secret present" || echo "FAIL — .env missing secret"
```

### 1e. AI lane binaries available

```bash
command -v claude && echo "claude OK" || echo "claude MISSING"
command -v codex  && echo "codex OK"  || echo "codex MISSING"
command -v gemini && echo "gemini OK" || echo "gemini MISSING"
```

All three should resolve. A missing binary means that lane will silently drop tasks.

---

## 2. End-to-End Dispatch Test

This is the critical path. It confirms Linear → webhook → router → AI lane.

### Step 1 — Create a canary issue in Linear

- Title: `[VERIFY] Canary dispatch test — delete after`
- Project: **OpenClaw / Aegilume** (prefix `VIS`)
- State: **Backlog** or **Todo**
- No AI-lane label yet

### Step 2 — Watch the router log

```bash
tail -f apps/linear-agent-router/logs/router.log
```

### Step 3 — Add an AI-lane label

In Linear, add the label **Claude** to the canary issue.

### Step 4 — Confirm dispatch fired

Within ~5 seconds you should see a log entry like:

```
[VIS] Dispatching to Claude lane: "[VERIFY] Canary dispatch test..."
```

If nothing appears after 10 seconds:
- Check the webhook delivery log in **Linear → Settings → API → Webhooks → (webhook) → Recent deliveries**.
- A `200` response confirms Linear reached the router. A `4xx`/`5xx` or no delivery means the tunnel URL is stale or the router crashed.

### Step 5 — Delete the canary issue

Once dispatch is confirmed, delete (or cancel) the canary issue in Linear to avoid noise.

---

## 3. State Transition Verification

Verify the full implement → review → done cycle using a real low-risk issue.

| Step | Actor | Linear state | AI-lane label |
|------|-------|-------------|---------------|
| Issue opened | Human | Todo | Claude |
| Dispatch fires | Router | → In Progress | Claude |
| Implementation done | Claude | → In Review | Codex |
| Review approved | Codex | → Done | *(removed)* |
| Review rejected | Codex | → In Progress | Claude |

To spot-check without triggering a full run:
1. Open any recently completed issue in Linear.
2. Expand the **Activity** panel.
3. Confirm the state history shows `Todo → In Progress → In Review → Done`.
4. Confirm AI-lane labels were swapped at each handoff (not left stale).

A stale label (e.g., `Claude` remaining after move to `In Review`) means the implement prompt step 6 was not executed. File a bug.

---

## 4. Reviewer Rotation Verification

The expected rotation is defined in `apps/linear-agent-router/config.json`:

```
Claude → reviewer: Codex
Codex  → reviewer: Gemini
Gemini → reviewer: Claude
```

To verify manually:
1. Open a recently reviewed issue.
2. Check the Linear comment left by the implementing AI (should name the reviewer).
3. Confirm the reviewer label matches the rotation table above.

If the rotation is wrong, check `config.json → reviewerFor` and redeploy:
```bash
cd apps/linear-agent-router && ./stop.sh && ./start.sh
```

---

## 5. Webhook Signature Verification

The router validates `X-Linear-Signature` on every request. To confirm it is working:

1. In **Linear → Settings → API → Webhooks → Recent deliveries**, copy the raw payload of any recent delivery.
2. Manually send it without a valid signature:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" \
     -X POST http://localhost:9786/webhook \
     -H "Content-Type: application/json" \
     -d '{"action":"update","type":"Issue","data":{}}'
   ```
   Expected: `401` (invalid signature rejected).
3. A `200` on an unsigned payload means signature verification is disabled or broken — fix immediately.

---

## 6. Troubleshooting Reference

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| No log output after label add | Tunnel URL stale or webhook not updated | Restart `./start.sh`, update Linear webhook URL |
| `401` on all real deliveries | `LINEAR_WEBHOOK_SECRET` mismatch | Re-copy secret from Linear → Settings → API → Webhooks |
| Router crashes on startup | Missing `config.json` or bad JSON | Validate: `node -e "require('./config.json')"` |
| AI lane never fires despite dispatch log | CLI binary missing or not on PATH | Confirm `command -v claude` resolves in the router's shell environment |
| Issue stuck in "In Review" | Reviewer lane not picking up | Check reviewer binary available; manually trigger review prompt |
| Duplicate dispatch | Webhook registered twice | Remove duplicate from Linear webhook settings |
| `maxPerLane` exceeded warning | Too many concurrent tasks | Wait for active lanes to complete or increase `maxPerLane` in `config.json` |

---

## 7. Quick Reference — Key Paths

| Resource | Path |
|----------|------|
| Router config | `apps/linear-agent-router/config.json` |
| Webhook secret | `apps/linear-agent-router/.env` |
| Router log | `apps/linear-agent-router/logs/router.log` |
| Tunnel log | `apps/linear-agent-router/logs/tunnel.log` |
| Governance doc | `docs/ai-repo-governance.md` |
| Start / stop | `apps/linear-agent-router/start.sh` / `stop.sh` |
