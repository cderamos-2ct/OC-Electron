# Gmail Linking Plan

## Goal
Ensure every important email surfaced by CD can include a direct link that opens in Gmail or the browser instead of only a subject line and summary.

## Desired outcome
For each surfaced email:
- sender
- subject
- summary
- direct Gmail link when possible
- fallback Gmail search link when not

## Link priority
1. exact Gmail thread/message permalink
2. link derived from Gmail thread/message id
3. prebuilt Gmail search URL

## Likely implementation paths

### Path A — improve the mail script
Extend the current Gmail/mail script to return:
- Gmail thread id
- message id
- direct web URL if available

### Path B — Gmail API metadata
Use Gmail API to retrieve:
- message id
- thread id
- labels/snippet
- linkable identifiers

Then build a URL pattern like:
- `https://mail.google.com/mail/u/0/#inbox/<thread-or-message-id>`

### Path C — fallback search link
If exact link is unavailable, generate:
- Gmail search by subject/from/date/id

## Dashboard behavior
Every email card should expose:
- `Open in Gmail`
- optional `Search in Gmail` fallback

## Rule
A summary without an open-link is friction.
We should remove that friction.
