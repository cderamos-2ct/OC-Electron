# Executive Assistant Integration Plan

## Purpose
Turn the executive-assistant vision into a practical integration roadmap across:
- email deep links
- tasks/reminders/calendar visibility
- Fireflies meeting capture
- persistent daily digest in the dashboard
- proactive notifications/alerts
- longer-term voice/AirPods interaction

This plan assumes the dashboard becomes the control/attention layer, not a full replacement for every host application.

---

## 1) Guiding principle

### The dashboard should orchestrate, not clone
The dashboard should:
- surface what matters
- summarize and prioritize
- provide direct links into the host system
- hold shared state, context, and follow-up logic

The dashboard should **not** try to rebuild Gmail, Calendar, Reminders, Fireflies, Drive, and every other app from scratch.

---

## 2) Integration track A — Email/task/calendar deep links

### Goal
Every surfaced item should be actionable from the dashboard, not just informational.

### Email
Needed outcome:
- each important email surfaced with:
  - sender
  - subject
  - summary
  - **Open in Gmail** link

Implementation options:
1. best: direct Gmail permalink from message/thread metadata
2. good: derive link from Gmail message/thread id
3. fallback: prebuilt Gmail search URL

### Calendar
Needed outcome:
- dashboard digest items link back to the event host/source when possible
- direct link to meeting platform or calendar event context

### Tasks / reminders
Needed outcome:
- dashboard task items link back to the source system when possible
- if native deep links are ugly/impossible, use the dashboard as summary + task key/reference

### Why this matters
Without direct links, the dashboard becomes a dead-end summary panel.
With direct links, it becomes a real operating console.

---

## 3) Integration track B — Fireflies meeting intelligence

### Goal
Use Fireflies as the meeting capture source across platforms.

### Desired workflow
1. meeting is captured by Fireflies
2. transcript / summary / metadata becomes available
3. CD processes that into:
   - concise meeting notes
   - decisions made
   - action items
   - owners
   - deadlines
   - follow-up drafts
4. dashboard updates with:
   - meeting recap
   - unresolved follow-ups
   - tasks created from the meeting

### Why Fireflies is a good fit
- cross-platform capture
- less custom plumbing than rolling our own meeting listening stack first
- provides a structured input for follow-up intelligence

### Output artifacts
- meeting brief
- task/reminder creation
- follow-up queue
- partner/team-shareable recap

---

## 4) Integration track C — Persistent daily digest

### Goal
The daily digest should live in the dashboard as a persistent executive surface, not vanish into chat history.

### Digest sections
- today / tomorrow calendar
- important prep needed
- important emails
- top tasks/reminders
- meeting follow-ups waiting
- blockers / decisions

### Chat's role
Chat should become:
- alert
- nudge
- summary delivery

But the dashboard should be the home.

### Why this matters
A digest hidden in chat is easy to lose.
A digest pinned in the dashboard becomes a real control surface.

---

## 5) Integration track D — Proactive attention layer

### Goal
Let the dashboard actively get Christian's attention when something matters.

### Mechanisms
- toast notifications
- badges
- banners
- alert cards
- escalating reminders for truly important items

### Good alert triggers
- important email
- meeting tomorrow requiring prep
- meeting in 60/15 min
- uncaptured post-meeting actions
- urgent overdue task
- real blocker on active work

### Bad alert triggers
- low-value promos
- duplicate status noise
- every random message
- non-urgent clutter

---

## 6) Integration track E — Voice / AirPods roadmap

### Goal
Long-term: make CD conversational and always-available enough that Christian can use voice as a primary control/briefing interface.

### Desired outcome
- Christian can talk naturally through AirPods
- CD can respond, brief, capture tasks, and surface context
- interaction feels like an operating layer, not a gimmick

### Required components
- audio input path
- speech-to-text
- text-to-speech
- low-friction invocation model
- dashboard/context integration
- notification/interruption logic

### Priority note
Voice should come **after**:
- digest
- deep links
- meeting capture
- notifications

Otherwise it will be flashy but structurally dumb.

---

## 7) Recommended implementation order

### Phase 1 — Deep links + persistent digest
- fix Gmail linking
- expose task/calendar/email items with host-app links
- add persistent digest module to dashboard

### Phase 2 — Meeting intelligence
- define Fireflies input path
- create meeting-notes → tasks/follow-ups flow
- surface post-meeting action queues in dashboard

### Phase 3 — Proactive alerts
- add notifications/toasts/badges
- tune triggers to avoid noise

### Phase 4 — Voice layer
- design AirPods/voice workflow on top of the above systems

---

## 8) Concrete next implementation artifacts
- `GMAIL_LINKING_PLAN.md`
- `FIREFLIES_MEETING_WORKFLOW.md`
- `DAILY_DIGEST_DASHBOARD_MODULE.md`
- `ATTENTION_LAYER_PLAN.md`
- `VOICE_LAYER_ROADMAP.md`

---

## Rule
The executive assistant system should reduce friction and context switching.

If it only produces summaries without links, follow-up, or proactive attention management, it is not finished.
