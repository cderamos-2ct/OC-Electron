# Expensify Integration Notes

## What looks workable
Expensify exposes an Integration Server API documented here:
- https://integrations.expensify.com/Integration-Server/doc/

The docs indicate:
- authentication uses `partnerUserID` and `partnerUserSecret`
- requests POST to:
  - `https://integrations.expensify.com/Integration-Server/ExpensifyIntegrations`
- the payload is passed in `requestJobDescription`

## Caveat
The main `https://www.expensify.com/api` route is Cloudflare-protected and not useful for direct scripted intake from this environment.

## Likely best path
1. Use the documented Integration Server API if your Expensify plan/account supports the needed jobs.
2. If the API does not support receipt creation/upload the way we want, use browser automation as fallback.

## Browser automation opinion
Playwright can likely automate:
- login
- navigate to receipt/expense pages
- upload files
- fill merchant/date/amount/category/comments

But Playwright/browser automation is more brittle than API and should be fallback, not primary integration.

## Current export strategy
For now we generate an export-ready CSV from the finance DB and keep linked file paths for each expense.
This gives us a stable handoff whether we later use API or browser automation.
