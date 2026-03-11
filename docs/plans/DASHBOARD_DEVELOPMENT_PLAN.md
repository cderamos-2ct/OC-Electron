# Dashboard Development Plan

## Purpose
Define the canonical durable development plan for the dashboard inside the Storage-backed OpenClaw project home.

This plan assumes:
- runtime workspace stays lean
- durable dashboard artifacts live under `/Volumes/Storage/OpenClaw/docs`
- UI/UX review should explicitly involve Claude and Gemini, not GPT-5.4 alone

## Canonical docs structure
- `docs/plans/` → high-level plans and roadmaps
- `docs/phases/` → phased implementation breakdown
- `docs/specs/` → data contracts, payloads, integration specs, module definitions
- `docs/ops/` → runbooks, checklists, inventories
- `docs/ui-ux/` → design reviews, layout critiques, interaction flows, model comparisons

## Model-routing rule for dashboard work
### GPT-5.4
Use for:
- orchestration
- data contracts
- payload structures
- integration logic
- task/status scaffolding

### Claude
Use for:
- UI/UX quality
- product interaction critique
- layout/readability improvements
- copy/tone polish for interfaces

### Gemini
Use for:
- alternative UI/product perspective
- design exploration
- cross-checking usability and flow decisions

## Core build lanes
1. operator/dashboard base layer
2. CTO learning module
3. executive-assistant layer
4. meeting intelligence / Fireflies layer
5. attention/notification layer
6. longer-term voice layer

## Rule
If a dashboard feature matters beyond immediate execution, its durable plan/spec belongs in Storage-backed docs first.
