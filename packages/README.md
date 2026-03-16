# Packages

This directory contains reusable package/plugin code.

Current canonical package roots:

- `openclaw-orchestrator/` — repo-local orchestration plugin/tooling package

Rule:

- package manifests, source, and package-local docs live here
- do not mix live app runtime state, exports, or operator scratch files into
  package directories
