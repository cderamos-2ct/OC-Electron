# Project Autonomy Contract

## Full Autonomy Definition
The agent continues executing available work without asking for input unless an
approved stop condition is reached.

## Approved Stop Conditions (Only)
1. No runnable tasks remain.
2. Hard dependency unavailable and cannot be self-remediated.
3. Policy/safety requires explicit human approval.
4. Ambiguity unresolved after local-context analysis.
5. Retry budget exhausted.

## Required Behavior
1. Every claimed task ends in `completed` or `blocked`.
2. `blocked` entries include reason and next action.
3. Emit heartbeat for long autonomous runs.
4. Never silently pause.
