# Validation Matrix

## Required Layers
1. Static checks.
2. Behavioral checks.
3. Workflow checks.
4. Visual checks (if UI changes).
5. Agent lifecycle + model-routing gate (required for multi-agent or multi-model tasks).
- Spawn-cap discipline enforced (`<=4` active spawned agents per loop, with reserved headroom).
- Lifecycle barrier evidence required (`wait` + `close` for all spawned IDs before loop completion).
- Model routing evidence required for execution/review/arbitration roles.
- Gate script: `bash scripts/verify-harness-agent-lifecycle-rules.sh`
6. Full autonomy contract gate.
- Approved stop conditions enforced and logged.
- Heartbeat file must exist during long autonomous runs.
- Gate script: `bash scripts/verify-harness-autonomy-rules.sh`
7. Full dev linting stack gate.
- Type + structure + function + visual checks must execute.
- Gate script: `bash scripts/verify-harness-lint-stack.sh`
8. Per-task quality gate.
- Every task must run quality checks before completion.
- Gate command: `harness task-quality-gate <repo> --task-id <id> --cycle <n>`.
- Results ledger: `.antigravity/task-quality-gates.jsonl`.
- Human status file: `.antigravity/TASK_STATUS.md`.
9. CI harness gate workflow.
- `.github/workflows/harness-gates.yml` must exist and execute on PR + `main` push.
- Gate runner script: `bash scripts/ci-harness-gates.sh`
10. Role execution evidence gate.
- Completed/blocked tasks marked `roleEvidenceRequired=true` must include per-role evidence entries.
- Gate script: `bash scripts/verify-harness-role-evidence.sh`
11. Deterministic model-routing policy gate.
- `.harness/model-routing-policy.json` must exist and include executor/architect/verifier + consensus keys.
- Gate script: `bash scripts/verify-harness-model-routing.sh`
