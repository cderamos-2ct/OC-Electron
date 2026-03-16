#!/usr/bin/env python3
import csv
import sqlite3
from pathlib import Path
from datetime import datetime

BASE = Path('/Volumes/Storage/OpenClaw/domains/finance')
DB = BASE / 'finance.db'
OUTDIR = BASE / 'Exports' / 'expensify'
OUTDIR.mkdir(parents=True, exist_ok=True)
outfile = OUTDIR / f"expensify_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
rows = conn.execute('''
SELECT e.id, e.vendor, e.amount, e.expense_date, e.category, e.notes, d.file_path
FROM expenses e
LEFT JOIN documents d ON d.id = e.document_id
WHERE e.workflow_status IN ('approved','extracted','new')
  AND e.expensify_status = 'not_exported'
ORDER BY e.id
''').fetchall()

with outfile.open('w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['expense_id','merchant','amount','date','category','comment','file_path'])
    for r in rows:
        w.writerow([r['id'], r['vendor'], r['amount'] or '', r['expense_date'] or '', r['category'] or '', r['notes'] or '', r['file_path'] or ''])

print(outfile)
print(f'{len(rows)} row(s) exported')
conn.close()
