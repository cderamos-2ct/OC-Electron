# OpenClaw Dashboard Lab Live Mobile Blockers — 2026-03-08

## Reality check
Despite multiple public-dashboard passes, Christian reports the live PWA is still effectively broken on iPhone.

## Live blockers still reported
1. screenshot/file attachment still not working in the lived experience
2. incoming/new chat messages still cause the screen/chat experience to refresh/reset
3. user still has to scroll to the bottom to see the current conversation
4. composer/keyboard/mobile bottom-area behavior is still not good enough

## Important interpretation
This means code changes alone are not yet producing sufficient user-visible improvement.
The mobile dashboard should still be treated as broken until these are resolved in real use.

## Latest mitigation attempts already landed
- public chat attachment first pass
- session persistence improvements
- history-load guard to reduce reset behavior
- mobile dock hidden on `/chat`
- shell height/overflow loosened on mobile
- overlay/header density pass

## Rule
Future progress updates should be judged by lived PWA behavior, not by the number of code patches landed.
