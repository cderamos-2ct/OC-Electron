#!/usr/bin/env python3
"""Shared runtime directive handling for chat and heartbeat flows."""

from __future__ import annotations

import json
import os
import re
import shlex
import subprocess
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Callable


@dataclass
class DirectiveOutcome:
    clean_text: str
    applied: list[str]


def _workspace_dir() -> Path:
    return Path(os.getenv("OPENCLAW_RUNTIME_WORKSPACE", "/Users/cderamos/.openclaw/workspace"))


def _storage_root() -> Path:
    return Path(os.getenv("OPENCLAW_STORAGE_ROOT", "/Volumes/Storage/OpenClaw"))


def _tasks_dir() -> Path:
    return _storage_root() / ".antigravity" / "tasks" / "items"


def _sync_script() -> Path:
    return _storage_root() / ".antigravity" / "tasks" / "scripts" / "sync-task-board.mjs"


def _agents_dir() -> Path:
    return _storage_root() / ".antigravity" / "agents"


def _agent_profiles_dir() -> Path:
    return _agents_dir() / "profiles"


def _workspace_skills_dir() -> Path:
    return _storage_root() / ".agents" / "skills"


def _runtime_spawn_logs_dir() -> Path:
    return _workspace_dir() / "runtime-spawn-logs"


def _agent_roster_sync_script() -> Path:
    return _storage_root() / "scripts" / "sync-openclaw-agent-roster.mjs"


def _daily_memory_path(now: datetime) -> Path:
    return _workspace_dir() / "memory" / f"{now.strftime('%Y-%m-%d')}.md"


def _promotion_target_path(target: str, now: datetime) -> Path | None:
    workspace = _workspace_dir()
    storage = _storage_root()
    targets = {
        "daily": _daily_memory_path(now),
        "longterm": workspace / "MEMORY.md",
        "relationship": storage / "docs" / "context" / "RELATIONSHIP.md",
        "use_cases": storage / "docs" / "context" / "USE_CASES.md",
        "learning": storage / "docs" / "context" / "LEARNING_SYSTEM.md",
        "status": workspace / "STATUS.md",
    }
    return targets.get(target)


def _parse_directive(line: str) -> tuple[str, dict[str, str]] | None:
    match = re.match(r"^\[(\w+)\s+(.+)\]$", line.strip())
    if not match:
        return None

    name = match.group(1).upper()
    args = match.group(2)
    values: dict[str, str] = {}
    try:
        tokens = shlex.split(args)
    except ValueError:
        return None
    for token in tokens:
        key, sep, value = token.partition("=")
        if not sep:
            continue
        values[key.strip().lower()] = value.strip()
    return name, values


def _ensure_markdown_header(file_path: Path, now: datetime) -> str:
    if file_path.exists():
        return file_path.read_text(encoding="utf8")
    if file_path.name == "MEMORY.md":
        return "# MEMORY.md - Long-Term Memory\n\n"
    if file_path.parent.name == "memory":
        return f"# {now.strftime('%Y-%m-%d')}\n\n"
    return f"# {file_path.name}\n\n"


def _append_runtime_entry(file_path: Path, text: str, now: datetime) -> None:
    file_path.parent.mkdir(parents=True, exist_ok=True)
    content = _ensure_markdown_header(file_path, now).rstrip()
    entry = f"- {now.isoformat()} cd: {text.strip()}"
    if entry in content:
        return
    if "## Runtime Updates" in content:
        updated = f"{content}\n{entry}\n"
    else:
        updated = f"{content}\n\n## Runtime Updates\n\n{entry}\n"
    file_path.write_text(updated, encoding="utf8")


def _list_task_files() -> list[Path]:
    task_dir = _tasks_dir()
    if not task_dir.exists():
        return []
    return sorted(path for path in task_dir.iterdir() if path.suffix == ".md")


def _frontmatter_field(content: str, key: str) -> str:
    match = re.search(rf"^{re.escape(key)}:\s*\"([^\"]*)\"", content, re.MULTILINE)
    return match.group(1) if match else ""


def _find_existing_task(title: str) -> str | None:
    normalized = title.strip().casefold()
    for file_path in _list_task_files():
        raw = file_path.read_text(encoding="utf8")
        existing_title = _frontmatter_field(raw, "title")
        status = _frontmatter_field(raw, "status")
        if existing_title.strip().casefold() != normalized:
            continue
        if status not in {"done", "failed", "cancelled"}:
            return _frontmatter_field(raw, "id") or file_path.stem
    return None


def _find_task_path(task_id: str) -> Path | None:
    file_path = _tasks_dir() / f"{task_id}.md"
    return file_path if file_path.exists() else None


def _normalize_agent_id(raw: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", raw.strip().lower()).strip("-")
    return value or "specialist"


def _next_task_id(prefix: str) -> str:
    pattern = re.compile(rf"^{re.escape(prefix)}-(\d+)$")
    ids: list[int] = []
    for file_path in _list_task_files():
        match = pattern.match(file_path.stem)
        if match:
            ids.append(int(match.group(1)))
    next_number = max(ids, default=0) + 1
    return f"{prefix}-{next_number:03d}"


def _render_list_block(name: str, values: list[str]) -> str:
    if not values:
        return f"{name}:\n"
    return f"{name}:\n" + "\n".join(f'- "{value}"' for value in values) + "\n"


def _append_mailbox_entry(agent_id: str, mailbox: str, entry: dict) -> None:
    profile_dir = _agent_profiles_dir() / agent_id
    profile_dir.mkdir(parents=True, exist_ok=True)
    file_path = profile_dir / mailbox
    with file_path.open("a", encoding="utf8") as handle:
        handle.write(json.dumps(entry) + "\n")


def _scaffold_agent_profile(agent: dict) -> None:
    profile_dir = _agent_profiles_dir() / agent["id"]
    profile_dir.mkdir(parents=True, exist_ok=True)

    def write_default(name: str, content: str) -> None:
        file_path = profile_dir / name
        if not file_path.exists():
            file_path.write_text(content, encoding="utf8")

    write_default(
        "SOUL.md",
        f"# {agent['name']} Soul\n\nYou are {agent['name']}, the {agent.get('lane', 'specialist')} agent.\n\n{agent.get('description') or 'Operate within your lane and hand work back clearly.'}\n",
    )
    write_default(
        "MEMORY.md",
        f"# {agent['name']} Memory\n\nDurable memory for {agent['name']}.\n\n- Preserve lane-specific facts, patterns, and recurring issues.\n",
    )
    write_default(
        "HEARTBEAT.md",
        f"# {agent['name']} Heartbeat\n\n- Review {agent.get('lane', 'lane')} work.\n- Surface blockers early.\n- Promote durable memory and create tasks when needed.\n",
    )
    write_default(
        "DIRECTIVES.md",
        (
            f"# {agent['name']} Directives\n\n"
            "## Responsibilities\n"
            + ("\n".join(f"- {item}" for item in agent.get("responsibilities", [])) or "- Work inside your lane.")
            + "\n\n## Escalation\n"
            + f"- Escalate to {agent.get('escalatesTo') or 'cd'} when work leaves your lane or needs a cross-agent decision.\n"
        ),
    )
    write_default("INBOX.jsonl", "")
    write_default("OUTBOX.jsonl", "")
    (profile_dir / "artifacts").mkdir(parents=True, exist_ok=True)


def _create_agent_record(payload: dict) -> str:
    agent_id = _normalize_agent_id(payload.get("id") or payload.get("lane") or payload.get("name") or "")
    agent_path = _agents_dir() / f"{agent_id}.json"
    if agent_path.exists():
        return agent_id

    runtime_agent_id = payload.get("runtime_agent_id") or ("main" if agent_id == "cd" else agent_id)
    kind = payload.get("kind") or "persistent"
    persistent = payload.get("persistent")
    if persistent is None:
        persistent = kind == "persistent"
    startup_policy = payload.get("startup_policy") or ("start-on-demand-and-reconcile" if persistent else "manual")
    spawn_mode = payload.get("spawn_mode") or "isolated-session"
    session_label = payload.get("session_label") or f"agent:{runtime_agent_id}:main"
    role_file = str(_agents_dir() / f"{agent_id}.md")
    duties = payload.get("job_duties") or payload.get("responsibilities") or []
    handoff_rules = payload.get("handoff_rules") or [
        f"Own {payload.get('lane') or agent_id} lane work first.",
        f"Escalate cross-lane work to {payload.get('escalates_to') or 'cd'}.",
    ]

    agent = {
      "id": agent_id,
      "name": payload.get("name") or agent_id.title(),
      "emoji": payload.get("emoji") or "🤖",
      "lane": payload.get("lane") or agent_id,
      "status": payload.get("status") or "planned",
      "runtimeAgentId": runtime_agent_id,
      "default": False,
      "description": payload.get("description") or f"Own the {agent_id} lane.",
      "responsibilities": payload.get("responsibilities") or duties,
      "jobDuties": duties,
      "monitorSurfaces": payload.get("monitor_surfaces") or [],
      "communicationChannels": payload.get("communication_channels") or [],
      "tools": payload.get("tools") or [],
      "memoryPaths": payload.get("memory_paths") or [],
      "modelProvider": payload.get("provider"),
      "defaultModel": payload.get("model"),
      "fallbackModel": payload.get("fallback_model"),
      "reasoningLevel": payload.get("reasoning"),
      "authProfile": payload.get("auth_profile") or "default",
      "canSpawnSubagents": payload.get("subagents", "false").lower() in {"1", "true", "yes", "on"},
      "subagentModel": payload.get("subagent_model"),
      "subagentMaxDepth": int(payload.get("subagent_depth", "1") or "1"),
      "subagentUseCases": payload.get("subagent_use_cases") or [],
      "taskTags": payload.get("tags") or [agent_id],
      "escalatesTo": payload.get("escalates_to") or "cd",
      "kind": kind,
      "persistent": persistent,
      "spawnMode": spawn_mode,
      "startupPolicy": startup_policy,
      "sessionLabel": session_label,
      "roleFile": role_file,
      "handoffRules": handoff_rules,
    }
    _agents_dir().mkdir(parents=True, exist_ok=True)
    agent_path.write_text(json.dumps(agent, indent=2) + "\n", encoding="utf8")
    _scaffold_agent_profile(agent)
    _sync_agent_roster_views()
    return agent_id


def _rewrite_task_frontmatter(task_path: Path, replacements: dict[str, str]) -> None:
    raw = task_path.read_text(encoding="utf8")
    updated = raw
    for key, value in replacements.items():
        updated = re.sub(rf"^{re.escape(key)}:\s*\".*\"$", f'{key}: "{value}"', updated, flags=re.MULTILINE)
    task_path.write_text(updated, encoding="utf8")


def _append_activity_log(task_path: Path, line: str) -> None:
    raw = task_path.read_text(encoding="utf8")
    if "## Activity Log" in raw:
        updated = raw.replace("## Activity Log\n\n", f"## Activity Log\n\n{line}\n", 1)
    else:
        updated = f"{raw.rstrip()}\n\n## Activity Log\n\n{line}\n"
    task_path.write_text(updated, encoding="utf8")


def _update_task_state(
    task_id: str,
    *,
    status: str | None = None,
    owner_agent: str | None = None,
    agent_type: str | None = None,
    note: str | None = None,
) -> bool:
    task_path = _find_task_path(task_id)
    if not task_path:
        return False
    replacements = {"updated_at": datetime.utcnow().isoformat()}
    if status:
        replacements["status"] = status
    if owner_agent:
        replacements["owner_agent"] = owner_agent
    if agent_type:
        replacements["agent_type"] = agent_type
    _rewrite_task_frontmatter(task_path, replacements)
    if note:
        _append_activity_log(task_path, f"- {datetime.utcnow().isoformat()} cd: {note}")
    return True


def _run_gateway_call(method: str, params: dict, expect_final: bool = False) -> bool:
    args = [
        "openclaw",
        "gateway",
        "call",
        method,
        "--json",
        "--params",
        json.dumps(params),
    ]
    if expect_final:
        args.append("--expect-final")
    result = subprocess.run(
        args,
        capture_output=True,
        text=True,
        timeout=20,
        env=os.environ.copy(),
    )
    return result.returncode == 0


def _spawn_agent_via_cli(
    *,
    agent_id: str,
    task: str,
    timeout_seconds: int,
    thinking: str | None = None,
) -> dict | None:
    try:
        log_dir = _runtime_spawn_logs_dir()
        log_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.utcnow().strftime("%Y%m%dT%H%M%S%fZ")
        log_path = log_dir / f"{agent_id}-{stamp}.json"
        args = [
            "openclaw",
            "agent",
            "--agent",
            "main" if agent_id == "cd" else agent_id,
            "--message",
            task,
            "--json",
        ]
        if timeout_seconds > 0:
            args.extend(["--timeout", str(timeout_seconds)])
        if thinking:
            args.extend(["--thinking", thinking])
        with log_path.open("w", encoding="utf8") as handle:
            subprocess.Popen(
                args,
                cwd=str(_storage_root()),
                stdout=handle,
                stderr=subprocess.STDOUT,
                env=os.environ.copy(),
                start_new_session=True,
            )
        return {
            "ok": True,
            "logPath": str(log_path),
            "childSessionKey": f"agent:{'main' if agent_id == 'cd' else agent_id}:main",
        }
    except Exception:
        return None


def _infer_owner_agent(title: str, tags: list[str], source: str) -> str:
    haystack = " ".join([title.lower(), source.lower(), *[tag.lower() for tag in tags]])
    if re.search(r"(fireflies|meeting-note|meeting notes|notes workflow|memo|notebook)", haystack):
        return "notes"
    if re.search(r"(email|gmail|teams|imessage|message|telegram|reply|contact|communication)", haystack):
        return "comms"
    if re.search(r"(calendar|meeting|schedule|reminder|brief)", haystack):
        return "calendar"
    if re.search(r"(notes|memo|document|docs|meeting-note|fireflies|digest)", haystack):
        return "notes"
    if re.search(r"(research|learning|notebooklm|cto|source|pomodoro)", haystack):
        return "research"
    if re.search(r"(dashboard|runtime|gateway|cloudflare|tunnel|device auth|service|launchctl|ops)", haystack):
        return "ops"
    if re.search(r"(build|typescript|ui|api|implementation|code|fix)", haystack):
        return "build"
    if re.search(r"(verify|verification|review|quality|regression|test)", haystack):
        return "verifier"
    return "cd"


def _create_task(
    *,
    title: str,
    summary: str,
    priority: str,
    owner_agent: str,
    agent_type: str,
    source: str,
    tags: list[str],
    prefix: str,
    now: datetime,
) -> str:
    existing = _find_existing_task(title)
    if existing:
        return existing

    resolved_owner = owner_agent or _infer_owner_agent(title, tags, source)
    task_id = _next_task_id(prefix)
    task_path = _tasks_dir() / f"{task_id}.md"
    task_path.parent.mkdir(parents=True, exist_ok=True)
    timestamp = now.isoformat()
    content = (
        "---\n"
        f'id: "{task_id}"\n'
        f'title: "{title.strip()}"\n'
        'status: "queued"\n'
        f'priority: "{priority}"\n'
        f'owner_agent: "{resolved_owner}"\n'
        f'agent_type: "{agent_type}"\n'
        f'created_at: "{timestamp}"\n'
        f'updated_at: "{timestamp}"\n'
        f'source: "{source}"\n'
        "depends_on:\n"
        "blocked_by:\n"
        f"{_render_list_block('tags', tags)}"
        "artifacts:\n"
        "---\n\n"
        "## Summary\n\n"
        f"{summary.strip() or title.strip()}\n\n"
        "## Current State\n\n"
        "- State: queued\n"
        "- Next action: review, claim, and execute.\n\n"
        "## Acceptance\n\n"
        f"- [ ] Resolve: {title.strip()}\n\n"
        "## Activity Log\n\n"
        f"- {timestamp} cd: Task created automatically from runtime directive.\n\n"
        "## Notes\n\n"
        f"Auto-created by runtime directive from `{source}`.\n"
    )
    task_path.write_text(content, encoding="utf8")
    return task_id


def _sync_task_views() -> None:
    script_path = _sync_script()
    if not script_path.exists():
        return
    subprocess.run(
        [os.getenv("NODE_BINARY", "node"), str(script_path)],
        cwd=str(_storage_root()),
        check=True,
        capture_output=True,
        text=True,
    )


def _sync_agent_roster_views() -> None:
    script_path = _agent_roster_sync_script()
    if not script_path.exists():
        return
    subprocess.run(
        [os.getenv("NODE_BINARY", "node"), str(script_path)],
        cwd=str(_storage_root()),
        check=True,
        capture_output=True,
        text=True,
    )


def process_runtime_directives(
    response: str,
    *,
    remember_callback: Callable[[str, str], None] | None = None,
    source: str = "runtime",
) -> DirectiveOutcome:
    now = datetime.utcnow()
    clean_lines: list[str] = []
    applied: list[str] = []
    task_mutated = False

    for raw_line in response.splitlines():
        line = raw_line.strip()
        directive = _parse_directive(line)
        if directive is None:
            clean_lines.append(raw_line)
            continue

        name, args = directive

        try:
            if name == "REMEMBER":
                key = args.get("key", "").strip()
                value = args.get("value", "").strip()
                if key and value and remember_callback:
                    remember_callback(key, value)
                    applied.append(f"remember:{key}")
                continue

            if name == "PROMOTE":
                target = args.get("target", "").strip().lower()
                text = args.get("text", "").strip()
                file_path = _promotion_target_path(target, now)
                if target and text and file_path:
                    _append_runtime_entry(file_path, text, now)
                    applied.append(f"promote:{target}")
                continue

            if name == "DELEGATE":
                agent_id = _normalize_agent_id(args.get("agent", ""))
                task_id = args.get("task", "").strip()
                task_path = _find_task_path(task_id)
                if agent_id and task_path:
                    now_iso = now.isoformat()
                    _rewrite_task_frontmatter(
                        task_path,
                        {
                            "owner_agent": agent_id,
                            "agent_type": "orchestrator" if agent_id == "cd" else agent_id,
                            "updated_at": now_iso,
                        },
                    )
                    _append_activity_log(task_path, f"- {now_iso} cd: Delegated task to {agent_id}.")
                    send_body = args.get("body", "").strip() or f"Please take ownership of task {task_id}."
                    _send_agent_message(
                        from_agent_id=args.get("from", "cd").strip() or "cd",
                        to_agent_id=agent_id,
                        subject=args.get("subject", f"Task delegation: {task_id}").strip() or f"Task delegation: {task_id}",
                        body=send_body,
                        task_ids=[task_id],
                        kind="delegation",
                    )
                    applied.append(f"delegate:{task_id}:{agent_id}")
                    task_mutated = True
                continue

            if name == "REQUEST_REVIEW":
                reviewer = _normalize_agent_id(args.get("reviewer", ""))
                task_id = args.get("task", "").strip()
                if reviewer and task_id and _update_task_state(
                    task_id,
                    status="review",
                    note=f"Requested review from {reviewer}.",
                ):
                    _send_agent_message(
                        from_agent_id=args.get("from", "cd").strip() or "cd",
                        to_agent_id=reviewer,
                        subject=args.get("subject", f"Review request: {task_id}").strip() or f"Review request: {task_id}",
                        body=args.get("body", "").strip() or f"Please review task {task_id}.",
                        task_ids=[task_id],
                        kind="review-request",
                    )
                    applied.append(f"request-review:{task_id}:{reviewer}")
                    task_mutated = True
                continue

            if name == "NEEDS_REVISION":
                owner = _normalize_agent_id(args.get("owner", ""))
                task_id = args.get("task", "").strip()
                if owner and task_id and _update_task_state(
                    task_id,
                    status="in_progress",
                    owner_agent=owner,
                    agent_type="orchestrator" if owner == "cd" else owner,
                    note=f"Review requested revision from {owner}.",
                ):
                    _send_agent_message(
                        from_agent_id=args.get("reviewer", "cd").strip() or "cd",
                        to_agent_id=owner,
                        subject=args.get("subject", f"Revision requested: {task_id}").strip() or f"Revision requested: {task_id}",
                        body=args.get("body", "").strip() or "Please revise this work and resubmit for review.",
                        task_ids=[task_id],
                        kind="revision-request",
                    )
                    applied.append(f"needs-revision:{task_id}:{owner}")
                    task_mutated = True
                continue

            if name == "APPROVE":
                task_id = args.get("task", "").strip()
                next_status = args.get("status", "done").strip() or "done"
                if task_id and _update_task_state(
                    task_id,
                    status=next_status,
                    note=args.get("note", "").strip() or "Approved.",
                ):
                    applied.append(f"approve:{task_id}:{next_status}")
                    task_mutated = True
                continue

            if name == "CREATE_CRON":
                name_value = args.get("name", "").strip() or "Agent Task"
                schedule_kind = args.get("kind", "every").strip() or "every"
                wake_mode = args.get("wake", "now").strip() or "now"
                session_target = args.get("session", "isolated").strip() or "isolated"
                agent_id = args.get("agent", "").strip() or None
                message = args.get("message", "").strip()
                payload = {"kind": "agentTurn", "message": message, "lightContext": True}
                schedule: dict[str, object]
                if schedule_kind == "cron":
                    schedule = {"kind": "cron", "expr": args.get("expr", "").strip(), "tz": args.get("tz", "").strip() or None}
                    if not schedule["expr"]:
                        continue
                    if not schedule["tz"]:
                        schedule.pop("tz", None)
                elif schedule_kind == "at":
                    at_value = args.get("at", "").strip()
                    if not at_value:
                        continue
                    schedule = {"kind": "at", "at": at_value}
                else:
                    every_ms = int(args.get("every_ms", "0") or "0")
                    if every_ms <= 0:
                        continue
                    schedule = {"kind": "every", "everyMs": every_ms}
                cron_params = {
                    "name": name_value,
                    "schedule": schedule,
                    "sessionTarget": session_target,
                    "wakeMode": wake_mode,
                    "payload": payload,
                    "enabled": args.get("enabled", "true").strip().lower() not in {"false", "0", "off"},
                }
                if agent_id:
                    cron_params["agentId"] = agent_id
                if _run_gateway_call("cron.add", cron_params):
                    applied.append(f"create-cron:{name_value}")
                else:
                    applied.append(f"directive_error:create-cron:{name_value}")
                continue

            if name == "SPAWN_SUBAGENT":
                target_agent = _normalize_agent_id(args.get("agent", ""))
                task_text = args.get("task", "").strip()
                if target_agent and task_text:
                    result = _spawn_agent_via_cli(
                        agent_id=target_agent,
                        task=task_text,
                        timeout_seconds=int(args.get("timeout", "0") or "0"),
                        thinking=args.get("thinking", "").strip() or None,
                    )
                    if result and result.get("ok"):
                        child_session = str(result.get("childSessionKey", "") or "")
                        log_path = str(result.get("logPath", "") or "")
                        _send_agent_message(
                            from_agent_id=args.get("from", "cd").strip() or "cd",
                            to_agent_id=target_agent,
                            subject=args.get("subject", f"Spawned subagent for {target_agent}").strip() or f"Spawned subagent for {target_agent}",
                            body=args.get("body", "").strip() or f"Native subagent started for task: {task_text}",
                            task_ids=[item for item in args.get("tasks", "").split(",") if item.strip()],
                            artifact_paths=[item for item in [child_session, log_path] if item],
                            kind="subagent-spawn",
                        )
                        applied.append(f"spawn-subagent:{target_agent}")
                    else:
                        applied.append(f"directive_error:spawn-subagent:{target_agent}")
                continue

            if name == "SPAWN_TEAM":
                session_key = args.get("session", "main").strip() or "main"
                team_agents = [_normalize_agent_id(item) for item in args.get("agents", "").split(",") if item.strip()]
                task_template = args.get("task", "").strip()
                for target_agent in team_agents:
                    if not target_agent or not task_template:
                        continue
                    result = _spawn_agent_via_cli(
                        agent_id=target_agent,
                        task=task_template.replace("{agent}", target_agent),
                        timeout_seconds=int(args.get("timeout", "0") or "0"),
                        thinking=args.get("thinking", "").strip() or None,
                    )
                    if result and result.get("ok"):
                        applied.append(f"spawn-team:{target_agent}")
                    else:
                        applied.append(f"directive_error:spawn-team:{target_agent}")
                continue

            if name == "SKILL_GAP":
                title = args.get("title", "").strip() or "Capability gap"
                owner = _normalize_agent_id(args.get("agent", "cd"))
                summary = args.get("summary", "").strip() or title
                tags = sorted({"skill-gap", "capability", owner, *[tag.strip() for tag in args.get("tags", "").split(",") if tag.strip()]})
                task_id = _create_task(
                    title=title,
                    summary=summary,
                    priority=args.get("priority", "medium").strip().lower() or "medium",
                    owner_agent=owner,
                    agent_type="capability-gap",
                    source=args.get("source", f"{source}:skill-gap").strip() or f"{source}:skill-gap",
                    tags=tags,
                    prefix="CAP",
                    now=now,
                )
                _append_skill_note(owner, f"{datetime.utcnow().isoformat()} capability gap: {title}")
                applied.append(f"skill-gap:{task_id}")
                task_mutated = True
                continue

            if name == "INSTALL_SKILL":
                slug = args.get("slug", "").strip()
                agent_id = _normalize_agent_id(args.get("agent", "cd"))
                if slug:
                    skills_dir = _workspace_skills_dir()
                    skills_dir.mkdir(parents=True, exist_ok=True)
                    result = subprocess.run(
                        [
                            "clawhub",
                            "--workdir",
                            str(_storage_root()),
                            "--dir",
                            ".agents/skills",
                            "install",
                            slug,
                            "--no-input",
                        ],
                        capture_output=True,
                        text=True,
                        timeout=60,
                        env=os.environ.copy(),
                    )
                    if result.returncode == 0:
                        _append_skill_note(agent_id, f"{datetime.utcnow().isoformat()} installed marketplace skill `{slug}`")
                        _send_agent_message(
                            from_agent_id=args.get("from", "cd").strip() or "cd",
                            to_agent_id=agent_id,
                            subject=args.get("subject", f"Installed skill: {slug}").strip() or f"Installed skill: {slug}",
                            body=args.get("body", "").strip() or f"Marketplace skill `{slug}` is now available in `.agents/skills`.",
                            artifact_paths=[str(skills_dir / slug)],
                            kind="skill-install",
                        )
                        applied.append(f"install-skill:{slug}")
                    else:
                        applied.append(f"directive_error:install-skill:{slug}")
                continue

            if name == "MESSAGE":
                to_agent = _normalize_agent_id(args.get("to", ""))
                from_agent = _normalize_agent_id(args.get("from", "cd"))
                if to_agent:
                    _send_agent_message(
                        from_agent_id=from_agent,
                        to_agent_id=to_agent,
                        subject=args.get("subject", "").strip() or "Agent message",
                        body=args.get("body", "").strip(),
                        task_ids=[item for item in args.get("tasks", "").split(",") if item.strip()],
                        artifact_paths=[item for item in args.get("artifacts", "").split(",") if item.strip()],
                        kind=args.get("kind", "handoff").strip() or "handoff",
                    )
                    applied.append(f"message:{from_agent}:{to_agent}")
                continue

            if name == "HIRE_AGENT":
                split = lambda key: [item.strip() for item in args.get(key, "").split("|") if item.strip()]
                agent_id = _create_agent_record(
                    {
                        "name": args.get("name", "").strip(),
                        "lane": args.get("lane", "").strip(),
                        "description": args.get("description", "").strip(),
                        "provider": args.get("provider", "").strip() or None,
                        "model": args.get("model", "").strip() or None,
                        "fallback_model": args.get("fallback", "").strip() or None,
                        "auth_profile": args.get("auth", "").strip() or "default",
                        "reasoning": args.get("reasoning", "").strip() or None,
                        "subagents": args.get("subagents", "false"),
                        "subagent_model": args.get("subagent_model", "").strip() or None,
                        "subagent_depth": args.get("subagent_depth", "1").strip() or "1",
                        "tags": split("tags"),
                        "responsibilities": split("duties"),
                        "job_duties": split("duties"),
                        "monitor_surfaces": split("surfaces"),
                        "communication_channels": split("channels"),
                        "subagent_use_cases": split("subagent_use_cases"),
                        "escalates_to": args.get("escalates_to", "").strip() or "cd",
                        "kind": args.get("kind", "").strip() or "persistent",
                        "persistent": args.get("persistent", "true").strip().lower() not in {"false", "0", "off"},
                        "spawn_mode": args.get("spawn_mode", "").strip() or "isolated-session",
                        "startup_policy": args.get("startup_policy", "").strip() or "start-on-demand-and-reconcile",
                        "session_label": args.get("session_label", "").strip() or None,
                        "handoff_rules": split("handoff_rules"),
                    }
                )
                applied.append(f"hire:{agent_id}")
                continue

            if name == "REFINE_AGENT":
                agent_id = _normalize_agent_id(args.get("agent", ""))
                if agent_id:
                    profile_dir = _agent_profiles_dir() / agent_id
                    if profile_dir.exists():
                        note = args.get("note", "").strip() or "Refined packet based on latest work."
                        directives_path = profile_dir / "DIRECTIVES.md"
                        directives = directives_path.read_text(encoding="utf8") if directives_path.exists() else f"# {agent_id} Directives\n\n"
                        directives_path.write_text(directives.rstrip() + f"\n\n## Runtime Refinements\n- {note}\n", encoding="utf8")
                        _sync_agent_roster_views()
                        applied.append(f"refine-agent:{agent_id}")
                continue

            if name in {"IMPROVEMENT", "TASK"}:
                title = args.get("title", "").strip()
                if not title:
                    continue
                summary = args.get("summary", "").strip() or title
                priority = args.get("priority", "medium").strip().lower()
                if priority not in {"high", "medium", "low"}:
                    priority = "medium"
                tags = [tag.strip() for tag in args.get("tags", "").split(",") if tag.strip()]
                if name == "IMPROVEMENT":
                    tags = sorted({"improvement", "autonomy", "process", *tags})
                    task_id = _create_task(
                        title=title,
                        summary=summary,
                        priority=priority,
                        owner_agent=args.get("owner", "cd").strip() or "cd",
                        agent_type="improvement",
                        source=f"{source}:improvement",
                        tags=tags,
                        prefix="IMP",
                        now=now,
                    )
                    applied.append(f"improvement:{task_id}")
                    task_mutated = True
                else:
                    task_id = _create_task(
                        title=title,
                        summary=summary,
                        priority=priority,
                        owner_agent=args.get("owner", "cd").strip() or "cd",
                        agent_type=args.get("agent_type", "orchestrator").strip() or "orchestrator",
                        source=args.get("source", source).strip() or source,
                        tags=tags,
                        prefix="AUT",
                        now=now,
                    )
                    applied.append(f"task:{task_id}")
                    task_mutated = True
                continue
        except Exception:
            applied.append(f"directive_error:{name.lower()}")
            continue

        clean_lines.append(raw_line)

    if task_mutated:
        try:
            _sync_task_views()
        except Exception:
            applied.append("directive_error:sync")

    clean_text = "\n".join(line for line in clean_lines if line.strip()).strip()
    return DirectiveOutcome(clean_text=clean_text, applied=applied)


def _send_agent_message(
    *,
    from_agent_id: str,
    to_agent_id: str,
    subject: str,
    body: str,
    task_ids: list[str] | None = None,
    artifact_paths: list[str] | None = None,
    kind: str = "handoff",
) -> None:
    timestamp = datetime.utcnow().isoformat()
    entry = {
        "id": f"msg-{timestamp}",
        "at": timestamp,
        "from": from_agent_id,
        "to": to_agent_id,
        "kind": kind,
        "subject": subject,
        "body": body,
        "taskIds": task_ids or [],
        "artifactPaths": artifact_paths or [],
    }
    _append_mailbox_entry(to_agent_id, "INBOX.jsonl", entry)
    _append_mailbox_entry(from_agent_id, "OUTBOX.jsonl", entry)


def _append_skill_note(agent_id: str, note: str) -> None:
    profile_dir = _agent_profiles_dir() / agent_id
    profile_dir.mkdir(parents=True, exist_ok=True)
    skills_path = profile_dir / "SKILLS.md"
    current = skills_path.read_text(encoding="utf8") if skills_path.exists() else f"# {agent_id} Skills\n\n"
    skills_path.write_text(current.rstrip() + f"\n\n- {note}\n", encoding="utf8")
