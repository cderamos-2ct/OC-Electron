# Expensify Integration Plan

## Confirmed from Integration Server docs
Expensify Integration Server supports:
- **Expense creation** (`type=create`, `inputSettings.type=expenses`)
- **Report creation with expenses** (`type=create`, `inputSettings.type=report`)
- **Policy lookup** (`type=get`, `inputSettings.type=policy`)
- **Policy list lookup** (`type=get`, `inputSettings.type=policyList`)
- **Report status updates** (`type=update`, `inputSettings.type=reportStatus`)
- **Downloader** (`type=download`) for generated export files

## Most relevant jobs for us
### 1. Policy list getter
Use this first to discover accessible policy IDs.

### 2. Policy getter
Use this to fetch:
- categories
- tags
- tax rates
- report fields

This is critical so we do not send invalid categories/tax values.

### 3. Expense creator
This can create expenses directly in a user's account.
Supported fields include:
- merchant
- created
- amount (in cents)
- currency
- externalID
- category
- tag
- billable
- reimbursable
- comment
- reportID
- policyID
- tax

### 4. Report creator
This can create a report and attach expenses in one shot.
This may be cleaner if we want one report per batch/day/entity.

## Important restrictions found in docs
- `employeeEmail` / acting in a user account is restricted
- report creation requires domain/policy admin privileges
- some functionality must be enabled by Expensify / Concierge for the domain

## Recommended implementation order
1. Generate/store Expensify credentials
2. Test `policyList` job
3. Test `policy` getter for categories/tax/report fields
4. Decide whether to use:
   - direct `expenses` creation, or
   - `report` creation with embedded expenses
5. Only use browser automation if the account restrictions or receipt upload gaps block the API path

## Open question
The docs confirmed expense/report creation, but we still need to verify whether receipt image/PDF attachment upload is supported in the same API flow or whether that part must happen through the web UI.

## Current opinion
- Use API for structured expense creation if possible
- Use browser automation only for attachment upload if API receipt attachment is missing or too limited
