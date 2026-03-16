# Finance Workspace

This folder is intentionally separate from any generic Documents area.

## Why
Finance docs are easy to lose when mixed with general files. This workspace keeps invoices, receipts, statements, anomalies, and exports isolated.

## Layout
- `Inbox/` — raw files waiting to be processed
  - `email/` — files collected from finance email sweeps
  - `manual/` — files you drop in manually
  - `mobile/` — photos/scans from phone uploads
- `Review/` — low-confidence or incomplete items needing human review
- `Processed/` — temporary staging after intake
- `Documents/YYYY/MM/` — canonical stored finance documents
- `Exports/expensify/` — upload-ready exports
- `Exports/accounting/` — accounting handoff exports
- `Templates/` — reusable templates/forms
- `Logs/` — intake logs and processing notes
- `finance.db` — SQLite metadata/workflow database

## Naming convention
Canonical finance filenames should look like:
- `YYYY-MM-DD_vendor_doctype_reference.ext`
- Example: `2026-03-11_anthropic_invoice_8ZQDTVFZ-0005.pdf`

## Suggested rule
If it relates to money, billing, tax, reimbursement, payroll-adjacent plan admin, or account anomalies, it belongs here — not in generic Documents.
