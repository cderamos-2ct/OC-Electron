# Task: VIS-147 Home view should remove placeholder operator metrics and show honest live data

status: done
priority: high
owner: VIS-147
owner_agent: CD
agent_type: codex
created: 2026-03-24
updated_at: 2026-03-24T11:20:00Z

## Summary
Implement VIS-147 in Home view by replacing placeholder operator metric cards and pseudo-loading behavior with backend-backed counts and explicit empty/error states.

## Activity Log
- 2026-03-24T10:30:00Z: Task claimed and created for VIS-147 development work.
- 2026-03-24T11:05:00Z: Updated HomeView to remove deceptive placeholder metrics, enforce backend-backed per-card states (loading/error/disconnected), and added focused HomeView tests for connected/disconnected/error scenarios.
- 2026-03-24T11:20:00Z: Completed focused test run for HomeView (`vitest run src/renderer/views/home/HomeView.test.tsx`) with all 4 cases passing.
