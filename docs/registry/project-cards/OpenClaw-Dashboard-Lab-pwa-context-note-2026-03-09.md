# OpenClaw Dashboard Lab PWA Context Note — 2026-03-09

## Purpose
Capture the fact that the public dashboard bugs are being experienced in the **installed iPhone PWA** context, not just a normal Safari tab.

## Why this matters
The remaining blocker set should be treated as:
- standalone/PWA viewport behavior
- mobile keyboard + safe-area interaction
- installed-app asset/state behavior
- not just generic responsive web CSS

## Implication for future fixes
Any future mobile pass on the real public dashboard should explicitly consider:
- standalone display mode
- visualViewport behavior on iPhone
- safe-area insets
- PWA install/update behavior
- whether controls behave differently in installed mode vs browser-tab mode

## Rule
Do not assume a fix validated in a regular desktop browser or even a normal mobile browser tab will behave the same in the installed iPhone PWA.
