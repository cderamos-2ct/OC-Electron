# Fireflies First Meeting Handoff

## Purpose
Define the exact information Christian should send/provide from the first Fireflies-captured meeting so CD can test the downstream workflow cleanly.

## Best-case handoff
Send any of these, in descending order of usefulness:

### Option A — Fireflies link + summary
- Fireflies meeting link
- AI summary
- action items if Fireflies extracted them

### Option B — Fireflies export
- transcript export
- summary export
- action items/export if available

### Option C — minimal manual handoff
- meeting title
- who attended
- meeting date/time
- Fireflies summary or transcript text
- any known follow-up expectations

---

## Minimum fields I want from the first test meeting
- **meeting title**
- **date/time**
- **participants**
- **source link** (Fireflies link if possible)
- **summary**
- **transcript** (full or partial)
- **action items** if Fireflies provides them
- **whether Christian attended**
- **meeting type**:
  - internal
  - external/client
  - attended
  - unattended

---

## What CD will produce from that handoff
From the first meeting handoff, CD should generate:
- concise executive summary
- key decisions
- action items with likely owners
- follow-up queue items
- open questions
- dashboard-ready meeting output shape
- notes on what Fireflies did well vs poorly

---

## What we are testing
The first handoff is meant to validate:
1. transcript quality
2. summary usefulness
3. action-item usefulness
4. attended vs unattended practicality
5. how much cleanup CD has to do
6. whether Fireflies is worth deeper automation

---

## Rule
Do not overcomplicate the first test.
Get one real meeting through the pipeline, inspect the output, then tighten the system.
