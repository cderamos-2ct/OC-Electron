# Senior Agent Team

Roles:
- `planner`: decomposes work into runnable tasks with dependencies.
- `architect`: owns boundaries, risk, and cross-cutting decisions.
- `executor`: implements scoped code changes quickly.
- `reviewer`: checks correctness and maintainability.
- `security-reviewer`: validates trust boundaries and unsafe patterns.
- `verifier`: performs final large-context consistency and regression checks.

Baseline workflow:
1. Planner selects a runnable task.
2. Architect validates scope and risks.
3. Executor implements.
4. Reviewer and security reviewer validate when relevant.
5. Verifier checks whole-task integrity.
6. Consensus is recorded before release or handoff.
