# Docs Canonicalization Plan

## Purpose

The docs tree currently contains several duplicate documents across:

- `docs/specs/`
- `docs/integrations/`
- `docs/dashboard/`
- `docs/phases/`
- `docs/operations/`

This file defines which location should win when duplicates exist.

## Canonical-home rules

### Product/UI/dashboard specs

Canonical home:

- `docs/specs/dashboard/`

Supporting material:

- `docs/dashboard/` for implementation notes, runbooks, and builder-specific planning
- `docs/phases/` may summarize dashboard work, but should link back to the canonical spec

### Integration contracts and workflows

Canonical home:

- `docs/specs/integrations/` for stable contracts/specs
- `docs/integrations/` for execution plans, workflows, and operational integration notes

`docs/phases/` may retain historical snapshots, but it should not become the
authoritative copy once a spec or workflow matures.

### Learning system specs

Canonical home:

- `docs/specs/learning/`
- `docs/learning/` for operating docs, queues, templates, and ongoing system material

### Operations

Canonical home:

- `docs/operations/`

Operations docs may reference specs and plans, but should not restate entire specs.

## Known duplicate clusters

### Dashboard phase 1

- `docs/specs/dashboard/COMMAND_CENTER_PHASE1_SPEC.md`
- `docs/dashboard/COMMAND_CENTER_PHASE1_SPEC.md`
- `docs/phases/phase-1-core-operator/COMMAND_CENTER_PHASE1_SPEC.md`

Canonical target:

- `docs/specs/dashboard/COMMAND_CENTER_PHASE1_SPEC.md`

### Dashboard phase 1 data contract

- `docs/specs/dashboard/COMMAND_CENTER_PHASE1_DATA_CONTRACT.md`
- `docs/dashboard/COMMAND_CENTER_PHASE1_DATA_CONTRACT.md`
- `docs/phases/phase-1-core-operator/COMMAND_CENTER_PHASE1_DATA_CONTRACT.md`

Canonical target:

- `docs/specs/dashboard/COMMAND_CENTER_PHASE1_DATA_CONTRACT.md`

### Daily digest

- `docs/integrations/DAILY_DIGEST_DASHBOARD_MODULE.md`
- `docs/phases/phase-2-executive-awareness/DAILY_DIGEST_DASHBOARD_MODULE.md`
- `docs/integrations/DAILY_DIGEST_DATA_MODEL.md`
- `docs/specs/integrations/DAILY_DIGEST_DATA_MODEL.md`

Canonical targets:

- workflow/module plan: `docs/integrations/DAILY_DIGEST_DASHBOARD_MODULE.md`
- stable data model: `docs/specs/integrations/DAILY_DIGEST_DATA_MODEL.md`

### Executive assistant

- `docs/integrations/EXECUTIVE_ASSISTANT_INTEGRATION_PLAN.md`
- `docs/operations/EXECUTIVE_ASSISTANT_INTEGRATION_PLAN.md`

Canonical target:

- `docs/integrations/EXECUTIVE_ASSISTANT_INTEGRATION_PLAN.md`

### Fireflies

- `docs/specs/integrations/FIREFLIES_INTEGRATION_SPEC.md`
- `docs/integrations/FIREFLIES_INTEGRATION_SPEC.md`
- `docs/phases/phase-3-learning-meeting-intel/FIREFLIES_INTEGRATION_SPEC.md`

Canonical target:

- `docs/specs/integrations/FIREFLIES_INTEGRATION_SPEC.md`

### Gmail linking

- `docs/specs/integrations/GMAIL_LINKING_PLAN.md`
- `docs/integrations/GMAIL_LINKING_PLAN.md`

Canonical target:

- `docs/specs/integrations/GMAIL_LINKING_PLAN.md`

### Voice roadmap

- `docs/integrations/VOICE_LAYER_ROADMAP.md`
- `docs/phases/phase-5-voice/VOICE_LAYER_ROADMAP.md`

Canonical target:

- `docs/integrations/VOICE_LAYER_ROADMAP.md`

## Next cleanup rule

When touching one of these duplicate areas:

1. update the canonical file first
2. convert duplicate copies into short stubs or archive/history references where safe
3. update `docs/DOCS_INDEX.md` so it points at the canonical home
