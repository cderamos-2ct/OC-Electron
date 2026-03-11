# Fireflies Test Matrix

## Purpose
Verify what Fireflies can actually do in Christian's environment before trusting assumptions or marketing language.

This matrix is designed to answer:
- can Fireflies join meetings Christian attends?
- can it join meetings Christian does **not** attend?
- what breaks because of lobby/bot restrictions?
- what works on free vs Business?

---

## Core test categories

### 1) Attended internal meeting
Goal:
- verify the bot joins cleanly when Christian is present
- transcript/summary quality check
- confirm notes are usable

### 2) Unattended meeting on Christian's calendar
Goal:
- verify whether Fireflies/Fred can join and capture without Christian physically attending
- confirm what permissions/settings are required

### 3) Client/external meeting
Goal:
- see whether external org restrictions, lobby policies, or bot settings interfere

### 4) Different meeting platforms
Goal:
- test behavior differences across:
  - Google Meet
  - Teams
  - Zoom

### 5) Post-meeting output quality
Goal:
- verify transcript usefulness
- verify summary/action quality
- determine what CD still needs to clean up

---

## Test template

### Test name

### Platform
- Meet / Teams / Zoom / other

### Meeting type
- internal / external / client / unattended / attended

### Plan tier
- free / business

### Bot joined?
- yes / no / partial

### Restrictions encountered
- lobby
- host approval
- external bot blocked
- calendar visibility issue
- integration issue
- unknown

### Transcript quality
- strong / usable / weak / failed

### Summary quality
- strong / usable / weak / failed

### Action-item usefulness
- strong / usable / weak / failed

### Did Christian attend?
- yes / no

### Did follow-up outputs work?
- summary
- tasks
- follow-up queue
- dashboard relevance

### Notes

---

## First tests to run

### Test 1 — attended internal meeting
- easiest baseline
- prove transcript and output usefulness first

### Test 2 — unattended internal meeting
- key question Christian explicitly cares about
- determines whether Fred can cover meetings he does not physically join

### Test 3 — attended external/client meeting
- checks restrictions and social/operational fit

### Test 4 — unattended external/client meeting
- highest-friction scenario
- likely where restrictions or norms may break the workflow

---

## Rule
Do not assume unattended-meeting behavior is reliable until it is tested in Christian's real environment.
