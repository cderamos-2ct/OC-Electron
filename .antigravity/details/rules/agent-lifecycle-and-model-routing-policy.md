# Agent Lifecycle and Model Routing Policy

- Status: active
- Scope: repository-wide orchestration and completion gates

## Policy
1. Max active spawned agents per loop: `4` with `2` reserved slots.
2. Every spawned agent must be `wait`ed and `close`d before next spawn batch.
3. Cap errors trigger lifecycle cleanup before any retry.
4. Multi-model work must record model-role mapping:
- `gpt-5.3-codex-spark`: primary execution
- `gpt-5-codex`: execution escalation
- `claude-opus-4.6` / `claude-sonnet-4.6`: architecture and review
- `gemini-3.1-pro-preview-deep-think`: large-context verification
- harness policy engine: final pass/fail arbitration
