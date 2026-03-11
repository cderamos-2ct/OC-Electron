# Command Center Build Order

## Goal
Translate the ecosystem/integration mapping work into a sane implementation order for the future dashboard / command center.

## Phase 1 — Core operator surface
Ship the minimum thing that answers:
- what is CD doing right now?
- what is blocked?
- what changed?
- what needs Christian?

### Inputs
- session state / chat history
- active work status
- queued work
- blockers
- recent completions
- approvals / risk gates

### Backing sources
- gateway session state
- `STATUS.md`
- `TASKS.md`
- session / transcript metadata

## Phase 2 — Executive awareness layer
Add the stuff Christian will actually check daily.

### Inputs
- inbox summary
- calendar next events
- reminders/tasks summary
- recent important contacts/messages

### Backing sources
- mail scripts
- calendar script
- reminders script
- contacts lookup
- messages metadata (`imsg`)

## Phase 3 — Personal knowledge layer
Add memory and reference surfaces so the dashboard acts like a second brain instead of a control panel.

### Inputs
- notes summary / recent notes
- memory highlights
- major decisions / architecture notes
- session binding / routing visibility

### Backing sources
- Apple Notes via `memo`
- `MEMORY.md` / daily memory files where appropriate
- `SESSION_MODEL_NOTES.md`
- future explicit session-binding data

## Phase 4 — Operations / integration health
Show whether the ecosystem is actually healthy.

### Inputs
- channel integration health
- auth/config state
- plugin/integration readiness
- file migration lane progress

### Backing sources
- OpenClaw status / control UI data
- `ECOSYSTEM_INTEGRATION_MAP.md`
- move logs / migration docs
- channel/plugin config state

## Phase 5 — Deep operator tools
Only after the summary layers are good.

### Inputs
- logs
- raw event feed
- agent/subagent orchestration
- advanced config editing
- detailed routing / transcript inspection

## Product rule
Do not start by making the dashboard more technical.
Start by making it more situationally useful.

The order is:
1. state
2. attention
3. action
4. health
5. deep debugging
