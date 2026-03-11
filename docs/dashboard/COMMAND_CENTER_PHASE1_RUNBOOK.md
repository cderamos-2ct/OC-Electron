# Command Center Phase 1 Runbook

## Purpose
Tiny operator runbook for regenerating the current Phase 1 dashboard payload from workspace docs.

## Source inputs
- `STATUS.md`
- `TASKS.md`

## Generated output
- `COMMAND_CENTER_PHASE1_CURRENT.json`

## Refresh command
```bash
./refresh_phase1_payload.sh
```

## Refresh + validate command
```bash
./build_phase1_payload.sh
```

## Under the hood
The shell wrapper runs:
```bash
python3 ./render_phase1_payload.py
```

The build wrapper runs:
```bash
./refresh_phase1_payload.sh
python3 ./validate_phase1_payload.py
```

## What this does
- reads the current `STATUS.md`
- reads the current `TASKS.md`
- extracts the Phase 1 Operator Overview fields
- writes a fresh JSON payload to `COMMAND_CENTER_PHASE1_CURRENT.json`

## Current limitations
- `lastMeaningfulUpdate` is still `null`
- extraction depends on stable markdown section names
- decision summaries are still partly heuristic
- this is local workspace plumbing, not a production API

## Contract files
- `COMMAND_CENTER_PHASE1_DATA_CONTRACT.md` — human-readable contract
- `COMMAND_CENTER_PHASE1_SCHEMA.json` — machine-readable JSON Schema

## Operator rule
If the output looks wrong, fix the source docs or extraction logic.
Do not paper over bad source structure in the UI.
