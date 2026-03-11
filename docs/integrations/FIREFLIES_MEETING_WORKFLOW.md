# Fireflies Meeting Workflow

## Goal
Use Fireflies.ai as the cross-platform meeting capture source so CD can turn meetings into notes, tasks, follow-ups, and dashboard updates.

## Desired workflow
1. Fireflies records or joins the meeting
2. transcript / summary / metadata becomes available
3. CD ingests that output
4. CD produces:
   - meeting summary
   - decisions made
   - action items
   - owners
   - follow-up queue
   - partner/team-shareable recap
5. dashboard updates with the resulting meeting outputs

## Core integration questions
- how do we retrieve meeting transcripts/summaries?
- does Fireflies offer webhook/API/export paths?
- what metadata is available (participants, meeting title, timestamps, action items, etc.)?
- what plan tier is required for the useful integration depth?

## Output model
### Private outputs
- raw meeting digest
- full notes
- open questions

### Leadership-shareable
- concise recap
- decisions / risks / next steps

### Team-shareable
- action items
- follow-ups
- tasks / experiment candidates

## Dashboard surfaces
- recent meetings
- notes ready
- action items extracted
- follow-ups pending
- unresolved questions

## Rule
Meeting capture is only valuable if it turns into action, not just transcripts.
