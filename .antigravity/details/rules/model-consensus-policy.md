# Model Consensus Policy

- Status: active
- Scope: repository-wide model routing and consensus outcomes

## Role Ownership
1. `executor`: `gpt-5.3-codex-spark`, escalates to `gpt-5-codex`.
2. `architect`: `claude-opus-4.6` (primary), `claude-sonnet-4.6` (secondary).
3. `verifier`: `gemini-3.1-pro-preview-deep-think`.

## Consensus Contract
1. Required votes: executor, architect, verifier.
2. Required non-model gate: CI pass.
3. Decision authority: harness policy engine.
4. Blockers fail consensus immediately:
- security high/critical
- design-system gate fail
- lint-stack fail
- missing required vote
