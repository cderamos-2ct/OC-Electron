# Orchestrator Tooling

Preferred tools for orchestration sessions:
- `orchestrator_status`: summarize overlay state
- `task_list`: list runnable or blocked tasks
- `task_claim`: claim a task for a role or worker
- `task_update`: update status, notes, results, and votes
- `role_route`: resolve the preferred provider/model for a role
- `consensus_check`: evaluate policy votes and CI status

Discipline:
- Use task tools before free-form status narration.
- Persist task transitions as they happen.
- Keep votes and quality gates explicit.
- Use subagents for role separation; use the overlay for coordination.
