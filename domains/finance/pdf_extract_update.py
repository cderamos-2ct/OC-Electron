#!/usr/bin/env python3
import re
import sqlite3
import subprocess
from pathlib import Path

DB = '/Volumes/Storage/OpenClaw/domains/finance/finance.db'

RULES = {
    'Anthropic': {
        'amount': re.compile(r'Amount due\s+\$([0-9,]+\.\d{2})', re.I | re.S),
        'tax': re.compile(r'Tax[^\$]*\$([0-9,]+\.\d{2})', re.I),
        'date': re.compile(r'Date of issue\s+([A-Za-z]+ \d{1,2}, \d{4})', re.I),
        'due': re.compile(r'Date due\s+([A-Za-z]+ \d{1,2}, \d{4})', re.I),
    },
    'SanMar': {
        'amount': re.compile(r'Sales subtotal\s+amount\s+([0-9,]+\.\d{2})', re.I | re.S),
        'surcharge': re.compile(r'Credit card\s+surcharge\s+([0-9,]+\.\d{2})', re.I | re.S),
        'date': re.compile(r'Invoice Date:\s*([0-9/]+)', re.I),
        'due': re.compile(r'Due Date:\s*([0-9/]+)', re.I),
    },
    'Calsak Plastics': {
        'amount': re.compile(r'USD Total Order Amount\s+([0-9,]+\.\d{2})', re.I | re.S),
        'tax': re.compile(r'Sales Tax\s+([0-9,]+\.\d{2})', re.I | re.S),
        'date': re.compile(r'Invoice Date:\s*([0-9/]+)', re.I),
        'due': re.compile(r'Net Due Date\s+([0-9/]+)', re.I),
    },
}

def pdf_text(path: str) -> str:
    return subprocess.check_output(['pdftotext', path, '-'], text=True)

def num(s):
    return float(s.replace(',', '')) if s else None

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
rows = conn.execute('''
SELECT e.id, e.vendor, d.file_path
FROM expenses e
LEFT JOIN documents d ON d.id=e.document_id
WHERE d.file_path IS NOT NULL
''').fetchall()

for r in rows:
    vendor = r['vendor']
    path = r['file_path']
    if vendor not in RULES or not Path(path).exists():
        continue
    text = pdf_text(path)
    rules = RULES[vendor]
    updates = {}
    for field, pat in rules.items():
        m = pat.search(text)
        if m:
            updates[field] = m.group(1)
    amount = num(updates.get('amount')) if 'amount' in updates else None
    tax = num(updates.get('tax')) if 'tax' in updates else None
    notes = []
    if 'surcharge' in updates:
        notes.append(f"credit_card_surcharge={updates['surcharge']}")
    if amount is not None or tax is not None or 'due' in updates:
        current = conn.execute('SELECT notes FROM expenses WHERE id=?', (r['id'],)).fetchone()['notes'] or ''
        extra = ('; '.join(notes)).strip()
        merged = '; '.join([x for x in [current, extra] if x])
        conn.execute('UPDATE expenses SET amount=COALESCE(amount,?), tax=COALESCE(tax,?), due_date=COALESCE(due_date,?), notes=? WHERE id=?',
                     (amount, tax, updates.get('due'), merged, r['id']))
        print(f"updated expense {r['id']} {vendor}: amount={amount} tax={tax} due={updates.get('due')}")

conn.commit()
conn.close()
