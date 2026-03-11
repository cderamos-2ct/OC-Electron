# Command Center Phase 1 Extraction Notes

## Goal
Define a sane interim extraction strategy for generating the Phase 1 dashboard payload from current workspace docs.

This is the bridge between:
- human-maintained markdown files now
- structured dashboard data later

## Source files
- `STATUS.md`
- `TASKS.md`
- optional supporting docs for decision summaries:
  - `CONFIG_HARDENING_NOTES.md`
  - `TELEGRAM_GROUP_POLICY_OPTIONS.md`

## Extraction strategy

### 1) Parse `STATUS.md` by section headers
Expected sections:
- `Now`
- `Current Focus`
- `Last Completed`
- `Waiting On`
- `Next`

Use markdown heading boundaries, not brittle line offsets.

### 2) Parse `TASKS.md` by section headers
Expected sections:
- `Running`
- `Queued`
- `Blocked`
- `Done`

Only the first three matter for Phase 1.

### 3) Normalize markdown bullets into arrays
Rules:
- top-level `- ` bullets become items
- indented bullets become item detail lines when relevant
- preserve ordering; current docs are already human-prioritized

## Field mapping rules

### `now.summary`
Take the full text under `STATUS.md` → `Now`.

### `now.focus`
Take top-level bullets from `STATUS.md` → `Current Focus`.

### `active[]`
Take top-level checklist items from `TASKS.md` → `Running`.
Map each to:
- `title`: checkbox text
- `status`: `running`
- `note`: optional inline parenthetical detail if present

### `decisionQueue[]`
Take top-level checklist items from `TASKS.md` → `Queued`.
Map each to:
- `title`: checkbox text
- `summary`: optional one-line derived summary
- `doc`: supporting doc path when obvious

Current obvious doc links:
- dashboard hardening → `CONFIG_HARDENING_NOTES.md`
- Telegram group policy → `TELEGRAM_GROUP_POLICY_OPTIONS.md`

### `need.items`
Build from two sources:
1. `TASKS.md` → `Blocked`
2. any queued items that require Christian decision rather than background work

Map blocked items as `kind=blocker`.
Map human decisions / approvals as `kind=decision` or `kind=approval`.

### `need.status`
Set in this order:
1. `blocked` if there are active blockers that materially stop current progress
2. `needs-input` if no active blocker, but human decisions/approvals exist
3. `nothing-needed` otherwise

### `recentCompletions[]`
Take the top-level bullets from `STATUS.md` → `Last Completed`.
Map each to:
- `title`: top-level completion statement
- `detail`: collapsed child bullets joined into a short summary if present

Important:
- keep only the most recent/high-signal items in the final payload
- do not dump the whole history if the section grows again

## Interim implementation rule
If extraction feels ambiguous, improve the source docs rather than writing a smarter garbage parser.

That means:
- keep section names stable
- keep bullet structure sane
- avoid mixing random prose into list sections

## Practical next step
The first implementation can be a tiny local transformer that reads `STATUS.md` + `TASKS.md` and emits the Phase 1 contract JSON.

It does not need fancy infra.
It just needs predictable source structure.
