# Execution Loop Protocol

For each loop:
1. Claim one task.
2. Define measurable acceptance criteria.
3. Implement minimal scoped change.
4. Run verification matrix for impacted layers.
5. Execute agent lifecycle barrier if agents were spawned (`wait` all IDs, then `close` completed IDs).
6. Log one append-only entry to `.antigravity/progress.jsonl`.
