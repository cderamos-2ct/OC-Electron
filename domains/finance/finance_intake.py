#!/usr/bin/env python3
import hashlib
import os
import re
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path

BASE = Path('/Volumes/Storage/OpenClaw/domains/finance')
DB = BASE / 'finance.db'
INBOXES = [BASE / 'Inbox' / 'manual', BASE / 'Inbox' / 'mobile', BASE / 'Inbox' / 'email']
REVIEW = BASE / 'Review'
DOCS = BASE / 'Documents'

DOC_TYPE_PATTERNS = {
    'invoice': re.compile(r'invoice|inv[-_ ]?\d+', re.I),
    'receipt': re.compile(r'receipt', re.I),
    'statement': re.compile(r'statement', re.I),
}
VENDOR_PATTERNS = [
    ('Anthropic', re.compile(r'anthropic', re.I)),
    ('SanMar', re.compile(r'sanmar', re.I)),
    ('Calsak Plastics', re.compile(r'calsak|plastics', re.I)),
    ('Square', re.compile(r'square', re.I)),
]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def classify(filename: str):
    vendor = 'Unknown'
    doc_type = 'unknown'
    for v, pat in VENDOR_PATTERNS:
        if pat.search(filename):
            vendor = v
            break
    for t, pat in DOC_TYPE_PATTERNS.items():
        if pat.search(filename):
            doc_type = t
            break
    return vendor, doc_type


def slug(s: str) -> str:
    s = s.lower()
    s = re.sub(r'[^a-z0-9]+', '_', s)
    return s.strip('_') or 'unknown'


def canonical_name(src: Path, vendor: str, doc_type: str):
    today = datetime.now().strftime('%Y-%m-%d')
    stem = src.stem
    m = re.search(r'(INV[-_ ]?\d+|\d{4,}|[A-Z0-9]{6,}-\d{4})', stem, re.I)
    ref = slug(m.group(1)) if m else slug(stem)[:40]
    return f"{today}_{slug(vendor)}_{slug(doc_type)}_{ref}{src.suffix.lower()}"


def ensure_month_dir():
    now = datetime.now()
    target = DOCS / now.strftime('%Y') / now.strftime('%m')
    target.mkdir(parents=True, exist_ok=True)
    return target


def already_seen(conn, digest):
    row = conn.execute('SELECT id, file_path FROM documents WHERE sha256=?', (digest,)).fetchone()
    return row


def main():
    conn = sqlite3.connect(DB)
    moved = 0
    month_dir = ensure_month_dir()
    for inbox in INBOXES:
        if not inbox.exists():
            continue
        for path in sorted(inbox.iterdir()):
            if not path.is_file():
                continue
            digest = sha256_file(path)
            existing = already_seen(conn, digest)
            if existing:
                dup = REVIEW / f'duplicate_{path.name}'
                shutil.move(str(path), dup)
                print(f'DUPLICATE -> {dup}')
                continue
            vendor, doc_type = classify(path.name)
            dest_name = canonical_name(path, vendor, doc_type)
            dest = month_dir / dest_name
            counter = 2
            while dest.exists():
                dest = month_dir / f"{dest.stem}_{counter}{dest.suffix}"
                counter += 1
            shutil.move(str(path), dest)
            conn.execute(
                'INSERT INTO documents (original_filename, stored_filename, file_path, sha256, source, vendor_guess, doc_type, received_at, processed_at, notes) VALUES (?,?,?,?,?,?,?,?,?,?)',
                (path.name, dest.name, str(dest), digest, f'inbox:{inbox.name}', vendor, doc_type, datetime.now().isoformat(), datetime.now().isoformat(), 'Auto-ingested from inbox')
            )
            moved += 1
            print(f'INGESTED -> {dest}')
    conn.commit()
    conn.close()
    print(f'Processed {moved} new file(s)')


if __name__ == '__main__':
    main()
