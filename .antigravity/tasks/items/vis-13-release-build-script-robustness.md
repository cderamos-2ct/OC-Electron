# Task: VIS-13 Release Build Script Robustness

status: "done"
priority: high
owner: CD
owner_agent: CD
agent_type: codex
created: 2026-03-23
updated_at: 2026-03-23T19:28:00Z

## Summary
Clarify and complete VIS-13 by fixing the actual remaining release-path bug: `apps/openclaw-shell/scripts/build-dashboard.sh` exits early when symlink dereferencing encounters a broken link inside `.next/standalone`.

## Next Step
Await review or follow-up only if the release workflow still shows failures beyond the fixed symlink case.

## Activity Log
- 2026-03-23: Read VIS-13 through the local Linear API via the configured dev-harness client and token.
- 2026-03-23: Confirmed `.github/workflows/openclaw-shell-release.yml` already contains the dashboard build, vendor binary download, and validation steps described in the issue.
- 2026-03-23: Reproduced the remaining failure in `scripts/build-dashboard.sh`: `realpath` inside the symlink-dereference loop exits non-zero on a broken standalone symlink under `set -e`.
- 2026-03-23: Patched `scripts/build-dashboard.sh` so broken symlinks are tolerated and removed instead of aborting the standalone build helper.
- 2026-03-23: Verified `bash -n apps/openclaw-shell/scripts/build-dashboard.sh` passes.
- 2026-03-23: Verified a focused broken-symlink reproduction under `set -euo pipefail` passes (`broken_symlink_cleanup_ok`).
- 2026-03-23: Verified the real packaging helper path with `cd apps/openclaw-shell && bash scripts/build-dashboard.sh && bash scripts/validate-build.sh` (pass).
- 2026-03-23: Updated Linear via API: commented on VIS-12 that the issue is stale as written; moved VIS-13 to `In Review` with the implemented fix and verification evidence.
- 2026-03-23: Ran an opposing Claude review artifact for VIS-12 and VIS-13; Claude reported no findings and classified VIS-12 as stale/complete and VIS-13 as complete/fixed.
- 2026-03-23: Updated Linear via API again with the final review verdicts and moved both VIS-12 and VIS-13 to `Done`.
