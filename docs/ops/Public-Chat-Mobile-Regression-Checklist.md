# Public Chat Mobile Regression Checklist

## Purpose
Fast validation checklist for the real public dashboard chat on iPhone/PWA.

Target surface:
- `https://cd.visualgraphx.com/chat`
- real repo: `/Volumes/Storage/DOCKER/openclaw-dashboard-lab/openclaw-dashboard`

## Blocking checks

### 1) Reset / remount behavior
- Open Chat
- Select a non-default session
- Type a draft
- Wait for an incoming/new message or reconnect event
- Confirm:
  - current session stays selected
  - draft text is still present
  - screen does not jump back or visually reload

### 2) Bottom anchoring
- Open a long thread
- Send a message
- Receive a new reply
- Confirm:
  - latest messages remain visible
  - no manual scroll-to-bottom is required just to continue reading

### 3) Keyboard / composer visibility
- Tap into composer on iPhone/PWA
- Open keyboard
- Type multiple lines
- Confirm:
  - composer remains visible above keyboard
  - send button remains visible
  - current thread remains readable while typing

### 4) Attachment flow
- Attach image only
- Attach image + text
- Confirm:
  - attach control is visible and usable on mobile
  - preview appears
  - send works
  - preview clears after send

### 5) Width / clipping
- Use chat on iPhone portrait
- Confirm:
  - no horizontal clipping of current chat
  - chat bubbles use width sensibly
  - no content hidden off the right edge

## Rule
A fix does not count just because code changed.
It counts only if these mobile checks pass on the real PWA.
