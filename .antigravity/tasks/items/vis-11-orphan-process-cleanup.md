# Task: VIS-11 Orphan Process Cleanup

status: "done"
priority: high
owner: CD
owner_agent: CD
agent_type: codex
created: 2026-03-23
updated_at: 2026-03-23T18:12:00Z

## Summary
Ensure all four long-running shell services use consistent PID management and that stale processes from prior crashes are cleaned up on next launch.

## Next Step
Await harness write-back or repo-wide governance cleanup outside VIS-11 scope.

## Activity Log
- 2026-03-23: Claimed VIS-11 on branch `crd/VIS-11-orphan-process-cleanup`.
- 2026-03-23: Read local VIS-11 run artifacts for issue scope because no active OpenClaw queue manifest is currently present in the local harness state.
- 2026-03-23: Confirmed acceptance criteria from repo-local artifacts: all 4 long-running services write PID files; stale processes from a prior crash are cleaned up on next launch.
- 2026-03-23: Identified one remaining correctness issue: `GatewayProcessManager.stop()` removes the gateway PID file even when this session only attached to an already-running gateway.
- 2026-03-23: Added a regression test proving an attached-only gateway session must not remove the external PID file on stop.
- 2026-03-23: Patched `GatewayProcessManager.stop()` to remove the gateway PID file only when this session owns it.
- 2026-03-23: Verified touched-area typecheck with `pnpm --filter openclaw-shell typecheck` (pass).
- 2026-03-23: Verified targeted PID suites executed successfully with `pnpm --filter openclaw-shell exec vitest run src/main/gateway-process.test.ts src/main/provisioning/pid-management.test.ts src/main/__tests__/process-pid.test.ts --project node` (3 files, 10 tests passed).
- 2026-03-23: The package-level Vitest run still exits non-zero because unrelated pre-existing suites fail on Electron installation (`worker-manager.test.ts`, `vault-bridge.test.ts`).
- 2026-03-23: `harness validate /Volumes/Storage/OpenClaw` fails on missing repo-governance files and preflight hooks unrelated to VIS-11.
- 2026-03-23: `harness lint-stack /Volumes/Storage/OpenClaw` fails on existing repo-wide structure/function/visual debt unrelated to the PID change.
- 2026-03-23: `harness final-check /Volumes/Storage/OpenClaw` fails in `/Users/cderamos/dev-harness-core/scripts/final_check.sh` with `queue_active[@]: unbound variable`, an external harness runtime issue.
