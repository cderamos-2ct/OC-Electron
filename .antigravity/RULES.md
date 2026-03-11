# Repository Autonomy Rules

Keep index files short. Details live under:
- `.antigravity/details/rules/`
- `.antigravity/details/memory/`
- `.antigravity/details/tasks/`
- `.antigravity/details/plans/`
- `.antigravity/details/skills/`

## Active Detail Links
- `.antigravity/details/rules/agent-lifecycle-and-model-routing-policy.md` (active)
- `.antigravity/details/rules/model-consensus-policy.md` (active)

## Agent Lifecycle + Cap Discipline (Hard)
1. Maximum active spawned agents per orchestration loop: `4`.
- Reserve `2` thread slots for critic/verifier or recovery work.
2. Every spawned agent must be explicitly awaited and explicitly closed in the same loop.
3. If spawn fails due cap/thread limit:
- Stop spawning.
- Run lifecycle barrier (`wait` active IDs, then `close` all completed agents).
- Resume with reduced parallelism.
4. No new spawn batch if prior batch IDs are unresolved from the previous loop.
5. Model-routing accountability is mandatory for multi-model tasks:
- `gpt-5.3-codex-spark`: primary executor lane.
- `gpt-5-codex`: executor escalation lane for higher-risk changes.
- `claude-opus-4.6` / `claude-sonnet-4.6`: architecture and review lanes.
- `gemini-3.1-pro-preview-deep-think`: repository-wide consistency verifier.
- Harness policy engine: deterministic consensus arbiter.

## Full Autonomy Contract (Hard)
1. Continue autonomous execution until an approved stop condition is reached.
2. Approved stop conditions:
- no runnable tasks remain,
- hard dependency unavailable and not self-remediable,
- policy/safety requires explicit human approval,
- unresolved ambiguity after local-context analysis,
- retry budget exhausted.
3. Never silently pause; always emit explicit stop reason and next action.
4. Every claimed task must end in `completed` or `blocked`.

## Senior Agent Team Management (Hard)
1. Planner + architect + executor + reviewer roles are mandatory for complex work.
2. Security reviewer is required for auth, boundary, or sensitive-data changes.
3. Visual QA reviewer is required for UI-facing changes.
4. Release manager gate is required before merge-ready status.

## Full Dev Linting Stack (Hard)
1. Type-level checks (TypeScript/typed backends where applicable).
2. Structure checks (file size, style policy, architecture conventions).
3. Function checks (oversized/complex function detection).
4. Visual checks (Playwright or configured visual command).
5. Gate command: `harness lint-stack <repo>`

## Task Quality Gate (Hard)
1. Every autonomy-loop task must run `harness task-quality-gate` before completion.
2. Required per-task checks: rules overlay, DS spec, no monoliths, lint stack, visual verification, app smoke.
3. Gate output must be appended to `.antigravity/task-quality-gates.jsonl`.
4. Human-readable status must be updated in `.antigravity/TASK_STATUS.md`.

## CI Gate Enforcement (Hard)
1. Pull requests and `main` pushes must run harness gate workflow.
2. Required CI commands: `harness validate <repo>` and `harness lint-stack <repo>`.
3. No merge-ready status when the harness gate workflow is failing or missing.

## Role Evidence Gate (Hard)
1. Each autonomy-loop claimed task must initialize role-evidence artifacts.
2. Completed/blocked tasks with `roleEvidenceRequired=true` must include role entries for:
- `planner`, `lead-architect`, `executor`, `reviewer`, `release-manager`
3. Optional role entries become required when task `requiredRoles` includes:
- `security-reviewer`, `qa-visual`
4. Role evidence entries must include task key, role, outcome, artifact path, and timestamp.

## Deterministic Consensus Gate (Hard)
1. Use `.harness/model-routing-policy.json` as the SSOT for model-role routing.
2. Required votes: executor + architect + verifier.
3. Final pass/fail is decided by harness policy rules, never by a single model.
4. Any blocked gate (`security`, `design-system`, `lint-stack`, missing vote) fails consensus.
