# OpenClaw Dashboard Lab Scroll Anchor Note — 2026-03-08

## Finding
The real public chat in the Next.js dashboard repo already includes a bottom-anchor node (`messagesEndRef`) and attempts to scroll it into view.

## Implication
The still-live user report — needing to manually scroll to the bottom to see current chat — is not caused by the anchor being missing.

The more likely cause remains:
- viewport/keyboard interaction
- scroll-container height behavior
- update timing/reconnect behavior
- over-constrained mobile layout during live changes

## Rule
Do not spend the next pass re-adding another scroll anchor.
That is not the real issue.
