# Daily Digest Data Model

## Purpose
Define the structured data shape for the persistent executive daily digest in the dashboard.

The digest should not just be a chat summary.
It should be a durable, dashboard-native object that can be refreshed, linked, and acted on.

---

## Top-level shape

```json
{
  "generatedAt": "2026-03-08T09:36:00-07:00",
  "digestDate": "2026-03-09",
  "scope": "today|tomorrow",
  "calendar": {
    "events": []
  },
  "prep": {
    "items": []
  },
  "emails": {
    "important": []
  },
  "tasks": {
    "top": []
  },
  "followUps": {
    "pending": []
  },
  "attention": {
    "alerts": []
  }
}
```

---

## Sections

### 1) `calendar.events`
Purpose:
- meetings/events for the digest window

Fields:
- title
- start
- end
- people
- sourceLink
- notesLink
- urgency

### 2) `prep.items`
Purpose:
- what Christian should prepare before meetings or commitments

Fields:
- title
- why
- dueBy
- sourceLink
- relatedEvent
- urgency

### 3) `emails.important`
Purpose:
- highest-value inbox items

Fields:
- sender
- subject
- summary
- link
- urgency
- source

### 4) `tasks.top`
Purpose:
- most important reminders/tasks for the digest window

Fields:
- title
- source
- due
- link
- urgency

### 5) `followUps.pending`
Purpose:
- unresolved follow-ups needing attention

Fields:
- title
- source
- who
- bestNextAction
- timing
- link
- urgency

### 6) `attention.alerts`
Purpose:
- items deserving proactive emphasis/toasts/banners

Fields:
- title
- body
- kind
- urgency
- link

---

## Rules
- every digest item should link back to the host app/site when possible
- digest should support `today` and `tomorrow` views
- digest should be compact, high-signal, and actionable
- digest should be persisted in dashboard state, not only emitted as chat text

---

## Immediate implementation note
The first version can be hydrated from:
- calendar scripts
- mail scripts
- reminders/tasks sources
- follow-up queue
- status/tasks context

The UI should then render the digest as cards/lists with host-app links.
