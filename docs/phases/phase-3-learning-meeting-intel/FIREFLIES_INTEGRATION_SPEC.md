# Fireflies Integration Spec

## Purpose
Define how Fireflies.ai should plug into the executive-assistant system and dashboard.

This spec assumes Fireflies is the **meeting capture source**, while CD/dashboard handle:
- cleanup
- summarization
- action extraction
- follow-up generation
- persistent visibility

---

## 1) Plan assumption

### Recommended tier
**Business**

### Why
Business appears to be the minimum tier that makes this worth integrating seriously because it unlocks the useful automation depth:
- API access
- stronger integrations/automation
- better workflow possibilities for CRM/task sync and downstream systems

### Not recommended as primary choice
- **Free** → too limited
- **Pro** → likely too manual for the intended dashboard/EA workflow
- **Enterprise** → only if scale/compliance/admin needs justify it later

---

## 2) Fireflies role in the system

Fireflies should be treated as:
- the recorder
- the transcriber
- the first-pass meeting intelligence source

It should **not** be treated as the full executive-assistant layer.

CD/dashboard should still own:
- final meeting summary
- what actually matters to Christian
- tasks/reminders created from the meeting
- follow-up queue
- persistent dashboard history

---

## 3) Desired data flow

### High-level flow
1. meeting happens
2. Fireflies records/transcribes
3. Fireflies signals transcript completion
4. CD retrieves the transcript/summary/metadata
5. CD produces structured outputs
6. dashboard and task/follow-up systems update

### Practical implementation model
Likely pattern based on current research:
- Fireflies webhook/event indicates transcript completion
- a follow-up API call fetches the full transcript + summary + metadata

This is a **push-pull** model, not a pure fire-and-forget push.

---

## 4) Data we want from Fireflies

### Minimum useful meeting record
- meeting title
- date/time
- participants
- transcript
- summary
- action items (if Fireflies provides them)
- recording/media links if available
- source meeting URL if available

### Nice-to-have metadata
- speaker attribution
- meeting platform
- sentiment / topic markers
- who promised what
- links back to the Fireflies record

---

## 5) CD-side outputs

For each meeting, CD should generate some or all of:

### Private operator output
- concise meeting summary
- what changed
- unresolved questions
- Christian-specific follow-ups

### Leadership-shareable output
- key decisions
- strategic implications
- risk/issues
- next steps

### Team-shareable output
- action items
- owners
- due dates
- experiment/task candidates

### System outputs
- dashboard meeting card
- follow-up queue entry
- task/reminder creation where appropriate
- daily digest inclusion if relevant

---

## 6) Dashboard module behavior

The dashboard should eventually expose:

### Recent meetings
- title
- when it happened
- summary status
- action-item count
- open follow-ups

### Meeting outputs
- notes ready
- follow-up draft ready
- tasks created
- unresolved questions

### Drill-through actions
- open Fireflies record
- open transcript/notes
- open follow-up queue
- open linked task/reminder items

---

## 7) Task/reminder integration behavior

### Meeting-derived tasks should become one of:
- Apple Reminder / native task
- dashboard action item
- project backlog item
- follow-up draft

### Decision rule
Do not dump every sentence into a task system.
Only create tasks for:
- commitments
- explicit follow-ups
- prep items
- deadlines
- decisions needing action

---

## 8) Risks / caveats

### 1) Over-trusting first-pass AI output
Fireflies output should be treated as input, not final truth.

### 2) API/webhook model complexity
If transcript retrieval is webhook + API fetch, we need the plumbing to be clean.

### 3) Identity matching
Participants/owners may need normalization to avoid garbage task ownership.

### 4) Transcript != useful summary
A transcript alone is not the goal.
The goal is decisions, tasks, follow-ups, and dashboard state.

---

## 9) Implementation phases

### Phase 1 — manual-assisted flow
- use Fireflies as the meeting transcript source
- manually pull/process outputs into summaries and tasks
- validate whether the outputs are actually useful

### Phase 2 — semi-automated flow
- transcript-complete trigger
- automated fetch of transcript/summary metadata
- CD-generated meeting brief + action extraction

### Phase 3 — full dashboard integration
- recent meetings module
- follow-up queue
- task creation / sync
- digest integration

---

## 10) Next artifacts to build
- `MEETING_OUTPUT_TEMPLATE.md`
- `FOLLOW_UP_QUEUE.md`
- `DAILY_DIGEST_DATA_MODEL.md`
- optional future: `FIREFLIES_PAYLOAD_MAP.json`

---

## Rule
Fireflies should reduce meeting friction and improve follow-through.
If it only gives us transcripts and no action layer, the integration is incomplete.
