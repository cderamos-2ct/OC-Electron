# LEARNING_MODULE_INPUTS.md

## Purpose
Define the durable inputs that should feed the CTO learning module in the dashboard.

This is the bridge between:
- the learning docs/artifacts already being created
- the eventual dashboard module that exposes the learning system everywhere

## Primary source files

### Core system docs
- `INCOMING_CTO_LEARNING_SYSTEM.md`
- `INCOMING_CTO_LEARNING_OPERATING_PACKAGE.md`
- `LEARNING_SYSTEM.md`

### Active learning / understanding docs
- `CLARITY_IDP_UNDERSTANDING.md`
- `RESEARCH_QUEUE.md`
- `NOTEBOOKLM_SOURCE_PLAN.md`
- `EXPERIMENT_BACKLOG.md`
- `CTO_WEEKLY_BRIEF_TEMPLATE.md`

### Visibility docs
- `STATUS.md`
- `TASKS.md`

---

## Dashboard fields to populate

### 1) Learning focus
Populate from:
- current active learning lane in `LEARNING_SYSTEM.md`
- current source digestion progress in `CLARITY_IDP_UNDERSTANDING.md`
- relevant running tasks in `TASKS.md`

Suggested shape:
- primary focus
- current domain
- current thesis

### 2) Research queue
Populate from:
- `RESEARCH_QUEUE.md`

Suggested shape:
- title
- format
- why this matters now
- target output
- status

### 3) Understanding progress
Populate from:
- `CLARITY_IDP_UNDERSTANDING.md`

Suggested shape:
- current high-confidence read
- open questions
- immediate next reads

### 4) NotebookLM state
Populate from:
- `NOTEBOOKLM_SOURCE_PLAN.md`

Suggested shape:
- active notebook
- next notebook pack
- target output from pack
- pack rule / mode note if useful

### 5) Weekly output state
Populate from:
- latest generated weekly brief once it exists
- until then, from template + task state

Suggested shape:
- weekly brief status
- next brief due
- current takeaway summary

### 6) Experiment pipeline
Populate from:
- `EXPERIMENT_BACKLOG.md`

Suggested shape:
- counts by status
- top ready/captured items
- next recommended experiment to refine

### 7) Cadence mode
Populate from:
- current operating choice (`default`, `busy-day`, `deep-work`)
- eventually manual or inferred state

For now:
- may be set manually in the future dashboard or from a small state file later

---

## Minimal first dashboard payload for learning module

```json
{
  "learning": {
    "focus": {
      "primary": "incoming CTO",
      "currentDomain": "Clarity / IDP / platform strategy",
      "currentThesis": "..."
    },
    "queue": [
      {
        "title": "...",
        "format": "internal-doc",
        "why": "...",
        "targetOutput": "...",
        "status": "active"
      }
    ],
    "understanding": {
      "highConfidenceRead": ["..."],
      "openQuestions": ["..."],
      "nextReads": ["..."]
    },
    "notebooklm": {
      "activeNotebook": "...",
      "nextPack": "...",
      "targetOutput": "..."
    },
    "experiments": {
      "captured": 0,
      "refined": 0,
      "ready": 0,
      "assigned": 0,
      "tested": 0
    },
    "weekly": {
      "status": "not-started|draft|ready|shared",
      "nextFocus": "..."
    }
  }
}
```

---

## Implementation note
The first version does not need full automation.
It can be hydrated from these docs with the same philosophy used for the Phase 1 operator payload:
- stable source docs
- stable extraction rules
- improve source structure when parsing gets ambiguous

## Rule
The learning module should show:
- what Christian is learning
- why it matters
- what is changing
- what should be tested

If it becomes just a content list, it failed.
