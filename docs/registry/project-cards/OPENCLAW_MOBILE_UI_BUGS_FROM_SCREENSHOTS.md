# OpenClaw Mobile UI Bugs From Screenshots

## Source screenshots reviewed
- `OpenClaw Chat Screen issue - Mobile.png`
- `OpenClaw Dashboard Issue - Mobile UI:UX.png`

## Priority issues confirmed visually

### 1) Critical — bottom dock overlaps chat composer when keyboard is active
Visible symptom:
- the floating bottom navigation dock rides up and sits directly on top of the chat input/composer area when typing

Impact:
- user cannot reliably see the input, the typed text, or the send button
- chat is effectively broken on mobile in this state

### 2) High — overlay/menu transparency causes text bleed-through
Visible symptom:
- the Conversations slide-out/menu surface is too transparent, letting the background chat text bleed through heavily

Impact:
- severe readability problem
- foreground and background content visually collide

### 3) High — mobile width/layout still exceeds the viewport
Visible symptom:
- chat/shell layout appears to overrun the screen width; content is clipped or pushed off the right side

Impact:
- poor readability
- likely horizontal overflow / bad small-screen containment

### 4) Medium — bottom content is obscured by the floating dock
Visible symptom:
- bottom-most content is partially hidden beneath the dock

Impact:
- poor reading/scanning experience
- insufficient bottom padding for scroll/content areas

### 5) Medium — header consumes too much vertical space on mobile
Visible symptom:
- top chat/header area is tall and wastes space on iPhone

Impact:
- lower information density
- more scrolling than necessary

## Implementation implication
The current first mobile pass was not sufficient.
The next real fixes should target:
- dock/composer/keyboard interaction
- overlay opacity/backdrop treatment
- mobile width containment / overflow handling
- bottom padding for scrolling content
- compacting mobile header height
