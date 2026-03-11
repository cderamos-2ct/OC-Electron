# Command Center Phase 1 Data Contract

## Goal
Define the minimal structured data shape needed to render the Phase 1 Operator Overview without scraping random prose at runtime.

This is not the final API.
It is the contract the first useful dashboard should target.

## Top-level shape

```json
{
  "generatedAt": "2026-03-08T05:25:00-07:00",
  "now": {
    "summary": "...",
    "focus": ["..."],
    "lastMeaningfulUpdate": null
  },
  "need": {
    "status": "nothing-needed|needs-input|blocked",
    "items": [
      {
        "title": "...",
        "detail": "...",
        "kind": "blocker|approval|decision"
      }
    ]
  },
  "active": [
    {
      "title": "...",
      "status": "running|queued|blocked",
      "note": "..."
    }
  ],
  "recentCompletions": [
    {
      "title": "...",
      "detail": "..."
    }
  ],
  "decisionQueue": [
    {
      "title": "...",
      "summary": "...",
      "doc": "..."
    }
  ]
}
```

## Field-by-field meaning

### `generatedAt`
Timestamp for dashboard freshness.

### `now.summary`
Short plain-language answer to: what is CD doing right now?

Source now:
- `STATUS.md` → `Now`

### `now.focus`
Array of current focus lanes.

Source now:
- `STATUS.md` → `Current Focus`

### `now.lastMeaningfulUpdate`
Timestamp of the last meaningful operator update.

Source now:
- not captured cleanly yet

Practical note:
- okay to leave `null` until visibility files or heartbeat logging expose this explicitly

### `need.status`
One of:
- `nothing-needed`
- `needs-input`
- `blocked`

Heuristic for now:
- `blocked` if there are material blocked items preventing forward progress now
- `needs-input` if queued decisions / approvals exist but work can still continue
- `nothing-needed` if there is no current blocker or decision requiring Christian

### `need.items`
Explicit items Christian may need to act on.

Sources now:
- `TASKS.md` blocked section
- `TASKS.md` queued section
- `STATUS.md` waiting / next

### `active[]`
Current work items for the Active Work card.

Sources now:
- `TASKS.md` running section

### `recentCompletions[]`
Condensed completion items, newest and most important first.

Sources now:
- `STATUS.md` → `Last Completed`

Practical note:
- keep this intentionally small
- dashboard should not display the entire historical universe here

### `decisionQueue[]`
Non-urgent but unresolved decisions.

Sources now:
- `TASKS.md` queued section
- supporting docs such as:
  - `CONFIG_HARDENING_NOTES.md`
  - `TELEGRAM_GROUP_POLICY_OPTIONS.md`

## Mapping from current docs

### `STATUS.md`
Provides:
- `now.summary`
- `now.focus`
- `recentCompletions[]`
- some signal for `need.items`

### `TASKS.md`
Provides:
- `active[]`
- blocked items
- queued decisions

## Intentional non-goals for Phase 1
- raw log streaming
- transcript inspection
- provider-specific health dumps
- direct config editing
- every integration under the sun

## Why this matters
If the dashboard is built directly on prose blobs forever, it will become brittle garbage.
This contract creates a clean seam:
- docs can still be the truth source for now
- UI can render a stable shape
- later automation can replace manual doc parsing without redesigning the screen
