# Apps

This directory contains backend/runtime application roots.

Current canonical app roots:

- `runtime/` — Python runtime backend, heartbeat worker, and directive handling

Deliberate exception:

- the dashboard remains at the repo top level in `dashboard/` because it is the
  live served app and moving it currently adds more operational risk than value.

Rule:

- new backend/runtime applications belong under `apps/`
- do not create a second dashboard app root here unless the live service
  migration is bundled and verified in the same change
