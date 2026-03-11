#!/usr/bin/env python3
"""Auto-approve selected OpenClaw device pairing requests."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


DEFAULT_POLICY = {
    "pollSeconds": 5,
    "logNonMatches": False,
    "allowedClientIds": ["openclaw-control-ui"],
    "allowedClientModes": ["webchat"],
    "allowedPlatforms": ["iPhone"],
    "allowedRoles": ["operator"],
    "requiredScopes": ["operator.admin", "operator.approvals", "operator.pairing"],
    "allowedIpPrefixes": [],
}


def now_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def log(message: str) -> None:
    print(f"{now_utc()} {message}", flush=True)


def load_policy(path: Path) -> dict:
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(DEFAULT_POLICY, indent=2) + "\n", encoding="utf8")
        return dict(DEFAULT_POLICY)
    data = json.loads(path.read_text(encoding="utf8"))
    merged = dict(DEFAULT_POLICY)
    merged.update(data)
    return merged


def run_openclaw(*args: str) -> subprocess.CompletedProcess:
    cmd = ["openclaw", *args]
    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        env=os.environ.copy(),
        timeout=20,
        check=False,
    )


def list_pending_requests() -> list[dict]:
    result = run_openclaw("devices", "list", "--json")
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "openclaw devices list failed")
    payload = json.loads(result.stdout)
    return list(payload.get("pending", []))


def approve_request(request_id: str) -> tuple[bool, str]:
    result = run_openclaw("devices", "approve", request_id, "--json")
    if result.returncode != 0:
        return False, result.stderr.strip() or result.stdout.strip() or "approval failed"
    return True, result.stdout.strip()


def prefix_allowed(ip: str | None, prefixes: list[str]) -> bool:
    if not prefixes:
        return True
    if not ip:
        return False
    return any(ip.startswith(prefix) for prefix in prefixes)


def request_matches(request: dict, policy: dict) -> bool:
    if request.get("clientId") not in policy["allowedClientIds"]:
        return False
    if request.get("clientMode") not in policy["allowedClientModes"]:
        return False
    if request.get("platform") not in policy["allowedPlatforms"]:
        return False
    if request.get("role") not in policy["allowedRoles"]:
        return False
    scopes = set(request.get("scopes") or [])
    if not set(policy["requiredScopes"]).issubset(scopes):
        return False
    if not prefix_allowed(request.get("remoteIp"), policy.get("allowedIpPrefixes") or []):
        return False
    return True


def process_once(policy: dict, seen_nonmatches: set[str]) -> int:
    approvals = 0
    pending = list_pending_requests()
    if pending:
        log(f"pending requests: {len(pending)}")
    for request in pending:
        request_id = str(request.get("requestId") or "")
        if not request_id:
            continue
        if request_matches(request, policy):
            ok, detail = approve_request(request_id)
            if ok:
                approvals += 1
                log(
                    "approved request "
                    f"{request_id} device={request.get('deviceId')} platform={request.get('platform')} "
                    f"clientId={request.get('clientId')} ip={request.get('remoteIp')}"
                )
            else:
                log(f"approval failed for {request_id}: {detail}")
        elif policy.get("logNonMatches") and request_id not in seen_nonmatches:
            seen_nonmatches.add(request_id)
            log(
                "ignored request "
                f"{request_id} platform={request.get('platform')} clientId={request.get('clientId')} "
                f"clientMode={request.get('clientMode')} role={request.get('role')} ip={request.get('remoteIp')}"
            )
    return approvals


def main() -> int:
    parser = argparse.ArgumentParser(description="Auto-approve selected OpenClaw device pairings")
    parser.add_argument(
        "--policy",
        default=str(Path.home() / ".openclaw" / "openclaw-device-autoapprove-policy.json"),
        help="Path to JSON policy file",
    )
    parser.add_argument("--once", action="store_true", help="Run one poll cycle and exit")
    args = parser.parse_args()

    policy = load_policy(Path(args.policy).expanduser())
    seen_nonmatches: set[str] = set()

    if args.once:
        process_once(policy, seen_nonmatches)
        return 0

    log(f"auto-approver started with policy={args.policy}")
    while True:
        try:
            process_once(policy, seen_nonmatches)
        except Exception as exc:  # pragma: no cover - operational fallback
            log(f"loop error: {exc}")
        time.sleep(max(1, int(policy.get("pollSeconds", 5) or 5)))


if __name__ == "__main__":
    sys.exit(main())
